import { BrowserWindow, net } from "electron";
import {
  JiraIssuesRequestSchema,
  JiraIssuePageSchema,
  JiraIssueTargetSchema,
  JiraTransitionSchema,
  JiraTransitionRequestSchema,
  JiraConnectionStatusSchema,
  JiraSiteSchema,
  JiraProjectsRequestSchema,
  JiraProjectPageSchema,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import { DesktopEnvironment } from "../../app/DesktopEnvironment.ts";
import { ElectronSafeStorage } from "../../electron/ElectronSafeStorage.ts";
import { ElectronShell } from "../../electron/ElectronShell.ts";
import { makeJiraConnection } from "../../integrations/JiraConnection.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

class JiraConnectionError extends Schema.TaggedError<JiraConnectionError>()("JiraConnectionError", {
  message: Schema.String,
}) {}

export const installJiraIpc = Effect.fn("desktop.ipc.installJira")(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const storage = yield* ElectronSafeStorage;
  const shell = yield* ElectronShell;
  const ipc = yield* DesktopIpc.DesktopIpc;
  const requireEncryption = Effect.gen(function* () {
    const available = yield* storage.isEncryptionAvailable;
    if (!available) {
      return yield* Effect.fail(
        new JiraConnectionError({
          message: "Secure credential storage is unavailable on this machine.",
        }),
      );
    }
  });
  const credentialsPath = environment.path.join(environment.stateDir, "jira-credentials.enc");
  const connection = makeJiraConnection({
    // Use Chromium networking, as other desktop requests do, to honor the host's proxy setup.
    fetch: (input, init) => net.fetch(input instanceof URL ? input.href : input, init),
    read: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const bytes = yield* fs
            .readFile(credentialsPath)
            .pipe(
              Effect.catch((error) =>
                error.reason._tag === "NotFound" ? Effect.succeed(undefined) : Effect.fail(error),
              ),
            );
          if (!bytes) return undefined;
          yield* requireEncryption;
          return yield* storage.decryptString(bytes);
        }),
      ),
    write: (value) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* requireEncryption;
          const encrypted = yield* storage.encryptString(value);
          yield* fs.makeDirectory(environment.stateDir, { recursive: true });
          const temporaryPath = `${credentialsPath}.tmp`;
          yield* fs.writeFile(temporaryPath, encrypted, { mode: 0o600 });
          yield* fs.rename(temporaryPath, credentialsPath);
        }),
      ),
    remove: () => Effect.runPromise(fs.remove(credentialsPath, { force: true })),
    openExternal: (url) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* requireEncryption;
          if (!(yield* shell.openExternal(url))) {
            return yield* Effect.fail(
              new JiraConnectionError({
                message: "Could not open Atlassian sign-in in your browser.",
              }),
            );
          }
        }),
      ),
  });
  const diagnosticsPath = environment.path.join(environment.logDir, "jira-v1-diagnostics.log");
  const withDiagnostics = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } finally {
      if (connection.diagnostics()) {
        await Effect.runPromise(
          Effect.gen(function* () {
            yield* fs.makeDirectory(environment.logDir, { recursive: true });
            yield* fs.writeFileString(diagnosticsPath, connection.diagnostics(), { mode: 0o600 });
          }),
        ).catch(() => {}); // Diagnostics must not mask the connection result.
      }
    }
  };
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_AGENT_TOOLS_CHANNEL,
      payload: Schema.Void,
      result: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
      handler: () =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.listAgentTools()),
          catch: () =>
            new JiraConnectionError({
              message: "Could not discover Jira agent tools. Test the connection in Settings.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_AGENT_CALL_CHANNEL,
      payload: Schema.Struct({
        name: Schema.String,
        expiresAt: Schema.Finite,
        arguments: Schema.Record(Schema.String, Schema.Unknown),
      }),
      result: Schema.Unknown,
      handler: (input) =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.callAgentTool(input)),
          catch: () =>
            new JiraConnectionError({
              message:
                "Jira tool request failed. A dispatched write may have completed; check Jira before retrying. See Jira diagnostics in Settings.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_SITES_CHANNEL,
      payload: Schema.Void,
      result: Schema.Array(JiraSiteSchema),
      handler: () =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.listSites()),
          catch: (cause) =>
            new JiraConnectionError({
              message: cause instanceof Error ? cause.message : "Could not load Jira sites.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_PROJECTS_CHANNEL,
      payload: JiraProjectsRequestSchema,
      result: JiraProjectPageSchema,
      handler: (input) =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.listProjects(input)),
          catch: (cause) =>
            new JiraConnectionError({
              message: cause instanceof Error ? cause.message : "Could not load Jira projects.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_ISSUES_CHANNEL,
      payload: JiraIssuesRequestSchema,
      result: JiraIssuePageSchema,
      handler: (input) =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.listIssues(input)),
          catch: (cause) =>
            new JiraConnectionError({
              message: cause instanceof Error ? cause.message : "Jira request failed.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_TRANSITIONS_CHANNEL,
      payload: JiraIssueTargetSchema,
      result: Schema.Array(JiraTransitionSchema),
      handler: (input) =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.getTransitions(input)),
          catch: (cause) =>
            new JiraConnectionError({
              message: cause instanceof Error ? cause.message : "Jira request failed.",
            }),
        }),
    }),
  );
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.JIRA_TRANSITION_CHANNEL,
      payload: JiraTransitionRequestSchema,
      result: Schema.Void,
      handler: (input) =>
        Effect.tryPromise({
          try: () => withDiagnostics(() => connection.transitionIssue(input)),
          catch: (cause) =>
            new JiraConnectionError({
              message: cause instanceof Error ? cause.message : "Jira request failed.",
            }),
        }),
    }),
  );
  for (const [channel, action] of [
    [Channels.JIRA_STATUS_CHANNEL, "status"],
    [Channels.JIRA_CONNECT_CHANNEL, "connect"],
    [Channels.JIRA_TEST_CHANNEL, "test"],
    [Channels.JIRA_DISCONNECT_CHANNEL, "disconnect"],
  ] as const) {
    yield* ipc.handle(
      DesktopIpc.makeIpcMethod({
        channel,
        payload: Schema.Void,
        result: JiraConnectionStatusSchema,
        handler: () =>
          Effect.tryPromise({
            try: async () => {
              const result =
                action === "status"
                  ? await connection.status()
                  : await withDiagnostics(() => connection[action]());
              if (action !== "status") {
                for (const window of BrowserWindow.getAllWindows())
                  window.webContents.send(Channels.JIRA_CHANGED_CHANNEL);
              }
              const diagnostics =
                connection.diagnostics() ||
                (await Effect.runPromise(fs.readFileString(diagnosticsPath)).catch(() => ""));
              return { ...result, diagnostics, diagnosticsPath };
            },
            catch: (cause) =>
              new JiraConnectionError({
                message: cause instanceof Error ? cause.message : "Jira connection failed.",
              }),
          }),
      }),
    );
  }
});
