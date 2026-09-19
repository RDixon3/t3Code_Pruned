import {
  ServiceNowConnectionStatusSchema,
  ServiceNowConnectionConfigSchema,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import { DesktopEnvironment } from "../../app/DesktopEnvironment.ts";
import { ElectronSafeStorage } from "../../electron/ElectronSafeStorage.ts";
import { ElectronShell } from "../../electron/ElectronShell.ts";
import { makeServiceNowConnection } from "../../integrations/ServiceNowConnection.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import * as Channels from "../channels.ts";

class ServiceNowConnectionError extends Schema.TaggedError<ServiceNowConnectionError>()(
  "ServiceNowConnectionError",
  {
    message: Schema.String,
  },
) {}

export const installServiceNowIpc = Effect.fn("desktop.ipc.installServiceNow")(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const storage = yield* ElectronSafeStorage;
  const shell = yield* ElectronShell;
  const ipc = yield* DesktopIpc.DesktopIpc;
  const credentialsPath = environment.path.join(environment.stateDir, "serviceNow-credentials.enc");
  const requireEncryption = Effect.gen(function* () {
    const available = yield* storage.isEncryptionAvailable;
    if (!available) {
      return yield* Effect.fail(
        new ServiceNowConnectionError({
          message: "Secure credential storage is unavailable on this machine.",
        }),
      );
    }
  });
  const connection = makeServiceNowConnection({
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
              new ServiceNowConnectionError({
                message: "Could not open ServiceNow sign-in in your browser.",
              }),
            );
          }
        }),
      ),
  });
  yield* ipc.handle(
    DesktopIpc.makeIpcMethod({
      channel: Channels.SERVICENOW_CONNECT_CHANNEL,
      payload: ServiceNowConnectionConfigSchema,
      result: ServiceNowConnectionStatusSchema,
      handler: (config) =>
        Effect.tryPromise({
          try: () => connection.connect(config),
          catch: (cause) =>
            new ServiceNowConnectionError({
              message: cause instanceof Error ? cause.message : "ServiceNow connection failed.",
            }),
        }),
    }),
  );
  for (const [channel, action] of [
    [Channels.SERVICENOW_STATUS_CHANNEL, connection.status],

    [Channels.SERVICENOW_TEST_CHANNEL, connection.test],
    [Channels.SERVICENOW_DISCONNECT_CHANNEL, connection.disconnect],
  ] as const) {
    yield* ipc.handle(
      DesktopIpc.makeIpcMethod({
        channel,
        payload: Schema.Void,
        result: ServiceNowConnectionStatusSchema,
        handler: () =>
          Effect.tryPromise({
            try: action,
            catch: (cause) =>
              new ServiceNowConnectionError({
                message: cause instanceof Error ? cause.message : "ServiceNow connection failed.",
              }),
          }),
      }),
    );
  }
});
