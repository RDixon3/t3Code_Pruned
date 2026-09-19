import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { isJiraAgentToolName } from "@t3tools/contracts";
// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalDate:off -- MCP SDK adapter owns a Node loopback callback and uses the SDK's Fetch/Promise interfaces.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JiraConnectionStatus } from "@t3tools/contracts";
import * as NodeCrypto from "node:crypto";
import {
  jiraStoryPointFields,
  jiraProjectQuery,
  parseJiraIssues,
  parseJiraTransitions,
} from "./jiraIssues.ts";
import { listenForOAuth } from "./oauthCallback.ts";
import { jiraToolData, parseJiraSites, parseJiraProjects } from "./jiraDiscovery.ts";
import { describeJiraError, makeJiraDiagnostics } from "./jiraDiagnostics.ts";

export const listenForJiraOAuth = (state: string, signal: AbortSignal) =>
  listenForOAuth(state, signal, { path: "/jira/callback", port: 0, name: "Jira" });

type Credentials = {
  redirectUrl: string;
  client?: ReturnType<typeof OAuthClientInformationSchema.parse> | undefined;
  tokens?: ReturnType<typeof OAuthTokensSchema.parse> | undefined;
};

/** One app connection, independent of agent providers and project/thread state. */
export function makeJiraConnection(deps: {
  fetch?: typeof globalThis.fetch;
  read: () => Promise<string | undefined>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  probe?: (provider: OAuthClientProvider, signal: AbortSignal) => Promise<void>;
  finishAuth?: (provider: OAuthClientProvider, code: string, signal: AbortSignal) => Promise<void>;
}) {
  const endpoint = "https://mcp.atlassian.com/v1/mcp";
  const diagnostics = makeJiraDiagnostics();
  let stage = "idle";
  let pending:
    | { abort: AbortController; done: Promise<JiraConnectionStatus>; discovery: boolean }
    | undefined;
  let checkedAt: string | null = null;
  let connectionGeneration = 0;
  const load = async (): Promise<Credentials | undefined> => {
    const raw = await deps.read();
    if (!raw) return undefined;
    const value = JSON.parse(raw);
    const redirect = new URL(value.redirectUrl);
    if (
      redirect.protocol !== "http:" ||
      redirect.hostname !== "127.0.0.1" ||
      redirect.pathname !== "/jira/callback"
    ) {
      throw new Error("Saved Jira connection is invalid. Disconnect and sign in again.");
    }
    return {
      redirectUrl: redirect.href,
      client: OAuthClientInformationSchema.parse(value.client),
      tokens: OAuthTokensSchema.parse(value.tokens),
    };
  };
  const status = async (): Promise<JiraConnectionStatus> => ({
    connected: Boolean(await load()),
    checkedAt,
  });
  const transport = (provider: OAuthClientProvider, signal: AbortSignal) =>
    new StreamableHTTPClientTransport(new URL(endpoint), {
      authProvider: provider,
      fetch: async (url, init) => {
        const address = new URL(url instanceof Request ? url.url : String(url));
        const response = await (deps.fetch ?? globalThis.fetch)(url, {
          ...init,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(30_000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        }).catch((error: unknown) => {
          diagnostics.add(
            "HTTP failed",
            `${init?.method ?? "GET"} ${address.origin}${address.pathname}; ${describeJiraError(error)}`,
          );
          throw error;
        });
        diagnostics.add(
          "HTTP",
          `${init?.method ?? "GET"} ${address.origin}${address.pathname} → ${response.status}; protocol=${new Headers(init?.headers).get("mcp-protocol-version") ?? "negotiating"}; content-type=${response.headers.get("content-type") ?? "none"}; request-id=${response.headers.get("x-request-id") ?? response.headers.get("atl-traceid") ?? "none"}`,
        );
        return response;
      },
    });
  const probe =
    deps.probe ??
    (async (provider, signal) => {
      const client = new Client({ name: "t3-code-jira", version: "1.0.0" });
      try {
        stage = "initialize";
        // SDK 1.x's concrete transport declares optional members as T | undefined.
        await client.connect(transport(provider, signal) as Transport, { signal, timeout: 30_000 });
        diagnostics.add(
          stage,
          JSON.stringify({
            server: client.getServerVersion(),
            capabilities: client.getServerCapabilities(),
          }),
        );
        stage = "tools/list";
        let cursor: string | undefined;
        const cursors = new Set<string>();
        const tools = [];
        do {
          const page = await client.listTools(cursor ? { cursor } : {}, {
            signal,
            timeout: 30_000,
          });
          diagnostics.add(
            stage,
            `page=${cursors.size + 1}; tools=${page.tools.length}; more=${Boolean(page.nextCursor)}`,
          );
          for (const tool of page.tools) {
            diagnostics.add(
              "tool",
              JSON.stringify({
                name: tool.name,
                inputType: tool.inputSchema.type,
                properties: Object.keys(tool.inputSchema.properties ?? {}),
                required: tool.inputSchema.required ?? [],
                outputSchema: Boolean(tool.outputSchema),
                annotations: tool.annotations,
              }),
            );
            tools.push(tool);
          }
          cursor = page.nextCursor;
          if (cursor && (cursors.has(cursor) || cursors.size >= 49))
            throw new Error("Tool discovery returned a repeated cursor or exceeded 50 pages.");
          if (cursor) cursors.add(cursor);
        } while (cursor);
        diagnostics.add(
          stage,
          `Complete: ${tools.length} advertised tools. Discovery does not verify every tool invocation.`,
        );
        const resourcesTool = tools.find((tool) => tool.name === "getAccessibleAtlassianResources");
        if (resourcesTool && !resourcesTool.inputSchema.required?.length) {
          stage = "tools/call getAccessibleAtlassianResources";
          const result = await client.callTool(
            { name: resourcesTool.name, arguments: {} },
            undefined,
            { signal, timeout: 30_000 },
          );
          diagnostics.add(
            stage,
            `isError=${Boolean(result.isError)}; resultKeys=${Object.keys(result).join(",")}`,
          );
          if (result.isError) {
            const content = Array.isArray(result.content) ? result.content : [];
            for (const item of content)
              if (item.type === "text" && typeof item.text === "string")
                diagnostics.add("tool error", item.text);
            throw new Error("Atlassian resource discovery returned a tool error. See diagnostics.");
          }
        } else
          diagnostics.add(
            "tools/call",
            "Skipped: no parameter-free resource discovery tool advertised. No issue tools were invoked.",
          );
      } finally {
        await client.close();
      }
    });
  const finishAuth =
    deps.finishAuth ??
    (async (provider, code, signal) => {
      const connection = transport(provider, signal);
      try {
        await connection.finishAuth(code);
      } finally {
        await connection.close();
      }
    });
  const run = (
    interactive: boolean,
    operation?: (provider: OAuthClientProvider, signal: AbortSignal) => Promise<void>,
  ): Promise<JiraConnectionStatus> => {
    if (pending)
      return operation || pending.discovery
        ? Promise.reject(new Error("Jira is busy. Try again when the current operation finishes."))
        : pending.done;
    const abort = new AbortController();
    const signal = AbortSignal.any([
      abort.signal,
      AbortSignal.timeout(interactive ? 300_000 : operation ? 75_000 : 45_000),
    ]);
    const done = (async () => {
      checkedAt = null;
      diagnostics.reset();
      stage = "credentials";
      diagnostics.add(
        "run",
        `${new Date().toISOString()} ${interactive ? "Connect" : operation ? "Discovery" : "Test"} ${endpoint}`,
      );
      const saved = interactive ? undefined : await load();
      diagnostics.add(
        "credentials",
        saved ? "Using stored credentials for this endpoint." : "Starting fresh authorization.",
      );
      if (!interactive && !saved) throw new Error("Connect to Jira first.");
      const state = NodeCrypto.randomUUID();
      const callback = interactive ? await listenForJiraOAuth(state, signal) : undefined;
      const credentials: Credentials = saved ?? { redirectUrl: callback!.redirectUrl };
      diagnostics.protect(
        state,
        credentials.tokens?.access_token,
        credentials.tokens?.refresh_token,
        credentials.client?.client_id,
        credentials.client?.client_secret,
      );
      let verifier: string | undefined;
      let redirected = false;
      const provider: OAuthClientProvider = {
        redirectUrl: credentials.redirectUrl,
        clientMetadata: {
          client_name: "CoCo Jira v1",
          redirect_uris: [credentials.redirectUrl],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        state: () => state,
        clientInformation: () => credentials.client,
        saveClientInformation: (client) => {
          diagnostics.protect(client.client_id, client.client_secret);
          credentials.client = client;
        },
        tokens: () => credentials.tokens,
        saveTokens: async (tokens) => {
          signal.throwIfAborted();
          credentials.tokens = tokens;
          diagnostics.protect(tokens.access_token, tokens.refresh_token);
          // Persist rotated refresh tokens even if a subsequent MCP probe fails.
          await deps.write(JSON.stringify(credentials));
          diagnostics.add("OAuth", "Tokens received and saved. MCP verification pending.");
        },
        saveCodeVerifier: (value) => {
          diagnostics.protect(value);
          verifier = value;
        },
        codeVerifier: () => {
          if (!verifier) throw new Error("Jira sign-in expired. Try again.");
          return verifier;
        },
        redirectToAuthorization: async (url) => {
          if (!interactive) throw new Error("Jira sign-in expired. Reconnect to continue.");
          if (
            url.protocol !== "https:" ||
            !(url.hostname === "atlassian.com" || url.hostname.endsWith(".atlassian.com"))
          ) {
            throw new Error("Unexpected Atlassian sign-in address.");
          }
          redirected = true;
          diagnostics.add("OAuth", "Opening Atlassian authorization in browser.");
          await deps.openExternal(url.href);
        },
      };
      try {
        try {
          await (operation ?? probe)(provider, signal);
        } catch (error) {
          if (!(error instanceof UnauthorizedError) || !redirected || !callback) throw error;
          stage = "OAuth token exchange";
          const code = await callback.code;
          diagnostics.protect(code);
          await finishAuth(provider, code, signal);
          await (operation ?? probe)(provider, signal);
        }
        signal.throwIfAborted();
        if (!credentials.tokens || !credentials.client)
          throw new Error("Atlassian did not complete authorization.");
        checkedAt = new Date().toISOString();
        diagnostics.add("result", "MCP checks passed.");
        return { connected: true, checkedAt };
      } finally {
        callback?.close();
      }
    })()
      .catch((cause: unknown) => {
        diagnostics.add(`FAILED ${stage}`, describeJiraError(cause));
        if (cause && typeof cause === "object" && "code" in cause)
          diagnostics.add("error code", String(cause.code));
        throw new Error(
          `Jira failed at ${stage}. ${
            diagnostics
              .text()
              .split("\n")
              .findLast((line) => line.startsWith("FAILED")) ?? "See diagnostics."
          }`,
        );
      })
      .finally(() => {
        pending = undefined;
      });
    pending = { abort, done, discovery: Boolean(operation) };
    return done;
  };
  const withClient = async <T>(operation: (client: Client, signal: AbortSignal) => Promise<T>) => {
    // All Jira consumers share refresh tokens. Serialize operations and cancel queued work on disconnect.
    const generation = connectionGeneration;
    let current = pending;
    while (current) {
      await current.done.catch(() => {});
      if (generation !== connectionGeneration)
        throw new Error("Jira request cancelled by disconnect.");
      current = pending;
    }
    let data!: T;
    await run(false, async (provider, signal) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const client = new Client({ name: "t3-code-jira", version: "1.0.0" });
        try {
          stage = "initialize";
          try {
            await client.connect(transport(provider, signal) as Transport, {
              signal,
              timeout: 30_000,
            });
          } catch (error) {
            if (
              !(error instanceof McpError) ||
              error.code !== ErrorCode.RequestTimeout ||
              signal.aborted
            )
              throw error;
            if (attempt === 0) {
              diagnostics.add(
                "initialize",
                "Timed out before any tool call; retrying once with a fresh connection.",
              );
              continue;
            }
            throw new Error(
              "Atlassian did not respond while opening the Jira connection after two attempts. Try refreshing later, or test the connection in Settings → Integrations → Jira. No Jira tool was called.",
            );
          }
          data = await operation(client, signal);
          return;
        } finally {
          await client.close();
        }
      }
    });
    return data;
  };
  const callTool = async (
    client: Client,
    signal: AbortSignal,
    name: string,
    args: Record<string, unknown>,
  ) => {
    stage = `tools/call ${name}`;
    const result = await client.callTool({ name, arguments: args }, undefined, {
      signal,
      timeout: 30_000,
    });
    diagnostics.add(stage, `isError=${Boolean(result.isError)}`);
    return result;
  };
  const discover = <T>(
    name: string,
    args: Record<string, unknown>,
    parse: (value: unknown) => T,
    allowEmpty = false,
  ) =>
    withClient(async (client, signal) => {
      const result = await callTool(client, signal, name, args);
      return parse(allowEmpty && !result.isError ? undefined : jiraToolData(result));
    });
  let agentToolNames = new Set<string>();
  const pointFields = new Map<string, string[]>();
  return {
    listAgentTools: () =>
      withClient(async (client, signal) => {
        const tools = [];
        const cursors = new Set<string>();
        let cursor: string | undefined;
        do {
          stage = "tools/list";
          const page = await client.listTools(cursor ? { cursor } : {}, {
            signal,
            timeout: 30_000,
          });
          tools.push(...page.tools.filter((tool) => isJiraAgentToolName(tool.name)));
          cursor = page.nextCursor;
          if (cursor && (cursors.has(cursor) || cursors.size >= 49))
            throw new Error("Jira tool discovery returned a repeated cursor or exceeded 50 pages.");
          if (cursor) cursors.add(cursor);
        } while (cursor);
        agentToolNames = new Set(tools.map((tool) => tool.name));
        diagnostics.add("tools/list", `Jira agent tools=${tools.length}`);
        return tools;
      }),
    callAgentTool: (input: {
      name: string;
      expiresAt: number;
      arguments: Record<string, unknown>;
    }) => {
      if (!agentToolNames.has(input.name))
        return Promise.reject(
          new Error("Jira tool is unavailable. Refresh the Jira connection in Settings."),
        );
      return withClient(async (client, signal) => {
        if (Date.now() >= input.expiresAt)
          throw new Error("Jira request expired before execution.");
        try {
          return await callTool(client, signal, input.name, input.arguments);
        } catch {
          throw new Error(
            "Jira agent tool failed. A dispatched write may have completed; check Jira before retrying.",
          );
        }
      });
    },
    listSites: () => discover("getAccessibleAtlassianResources", {}, parseJiraSites),
    listProjects: async ({ cloudId, startAt }: { cloudId: string; startAt: number }) => {
      if (!cloudId.trim() || !Number.isSafeInteger(startAt) || startAt < 0)
        throw new Error("Invalid Jira project request.");
      return discover("getVisibleJiraProjects", { cloudId, startAt, maxResults: 50 }, (value) =>
        parseJiraProjects(value, startAt),
      );
    },
    listIssues: async (input: { cloudId: string; projectKey: string; nextPageToken?: string }) => {
      const cacheKey = JSON.stringify([input.cloudId, input.projectKey]);
      // Search does not support names expansion; fetch one issue to resolve custom field IDs.
      if (!pointFields.has(cacheKey) || !input.nextPageToken) {
        const issueKey = await discover(
          "searchJiraIssuesUsingJql",
          {
            cloudId: input.cloudId,
            jql: jiraProjectQuery(input.projectKey),
            maxResults: 1,
            fields: ["summary"],
          },
          (value) => {
            if (
              !value ||
              typeof value !== "object" ||
              !("issues" in value) ||
              !Array.isArray(value.issues)
            )
              throw new Error("Jira returned an unsupported issue discovery response.");
            const first: unknown = value.issues[0];
            return first &&
              typeof first === "object" &&
              "key" in first &&
              typeof first.key === "string"
              ? first.key
              : null;
          },
        );
        const fields = issueKey
          ? await discover(
              "getJiraIssue",
              {
                cloudId: input.cloudId,
                issueIdOrKey: issueKey,
                fields: ["*all"],
                expand: "names",
                responseContentFormat: "adf",
              },
              jiraStoryPointFields,
            )
          : [];
        pointFields.set(cacheKey, fields);
      }
      const fields = pointFields.get(cacheKey) ?? [];
      return discover(
        "searchJiraIssuesUsingJql",
        {
          cloudId: input.cloudId,
          jql: jiraProjectQuery(input.projectKey),
          maxResults: 100,
          fields: ["summary", "issuetype", "status", "assignee", "priority", ...fields],
          ...(input.nextPageToken ? { nextPageToken: input.nextPageToken } : {}),
        },
        (value) => parseJiraIssues(value, input.nextPageToken, fields),
      );
    },
    getTransitions: (input: { cloudId: string; issueKey: string }) =>
      discover(
        "getTransitionsForJiraIssue",
        { cloudId: input.cloudId, issueIdOrKey: input.issueKey },
        parseJiraTransitions,
      ),
    transitionIssue: (input: { cloudId: string; issueKey: string; transitionId: string }) =>
      discover(
        "transitionJiraIssue",
        {
          cloudId: input.cloudId,
          issueIdOrKey: input.issueKey,
          transition: { id: input.transitionId },
        },
        () => undefined,
        true,
      ),
    diagnostics: diagnostics.text,
    status,
    connect: () => run(true),
    test: () => run(false),
    disconnect: async (): Promise<JiraConnectionStatus> => {
      connectionGeneration++;
      agentToolNames.clear();
      pointFields.clear();
      const current = pending;
      current?.abort.abort();
      await current?.done.catch(() => {});
      await deps.remove();
      checkedAt = null;
      return { connected: false, checkedAt };
    },
  };
}
