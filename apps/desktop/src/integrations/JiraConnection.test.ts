import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
// @effect-diagnostics globalFetch:off -- Exercises the real OAuth loopback callback; no external network or account access.
import { describe, expect, it, vi } from "vite-plus/test";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { listenForJiraOAuth, makeJiraConnection } from "./JiraConnection.ts";

const saved = JSON.stringify({
  redirectUrl: "http://127.0.0.1:12345/jira/callback",
  client: { client_id: "test-client" },
  tokens: { access_token: "old-token", refresh_token: "refresh-token", token_type: "Bearer" },
});

function fixture(initial?: string) {
  let value = initial;
  let opened = 0;
  const deps = {
    read: async () => value,
    write: async (next: string) => {
      value = next;
    },
    remove: async () => {
      value = undefined;
    },
    openExternal: async () => {
      opened++;
    },
  };
  return { deps, value: () => value, opened: () => opened };
}

describe("Jira connection", () => {
  it("retries an initialization timeout once before dispatching any tools", async () => {
    const connect = vi
      .spyOn(Client.prototype, "connect")
      .mockRejectedValueOnce(new McpError(ErrorCode.RequestTimeout, "Request timed out"))
      .mockResolvedValue(undefined);
    const close = vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    const call = vi
      .spyOn(Client.prototype, "callTool")
      .mockResolvedValue({ content: [{ type: "text", text: "[]" }] });
    try {
      const connection = makeJiraConnection(fixture(saved).deps);
      expect(await connection.listSites()).toEqual([]);
      expect(connect).toHaveBeenCalledTimes(2);
      expect(close).toHaveBeenCalledTimes(2);
      expect(call).toHaveBeenCalledTimes(1);
      expect(connection.diagnostics()).toContain("retrying once");
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("stops after a second initialization timeout without calling tools", async () => {
    const connect = vi
      .spyOn(Client.prototype, "connect")
      .mockRejectedValue(new McpError(ErrorCode.RequestTimeout, "Request timed out"));
    vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    const call = vi.spyOn(Client.prototype, "callTool");
    try {
      await expect(makeJiraConnection(fixture(saved).deps).listSites()).rejects.toThrow(
        "after two attempts",
      );
      expect(connect).toHaveBeenCalledTimes(2);
      expect(call).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("does not replay a tool call that times out after initialization", async () => {
    const connect = vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    const call = vi
      .spyOn(Client.prototype, "callTool")
      .mockRejectedValue(new McpError(ErrorCode.RequestTimeout, "Request timed out"));
    try {
      await expect(
        makeJiraConnection(fixture(saved).deps).transitionIssue({
          cloudId: "cloud",
          issueKey: "KAN-1",
          transitionId: "done",
        }),
      ).rejects.toThrow("Request timed out");
      expect(connect).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
    }
  });
  it("forwards discovered Jira tools and raw results without exposing credentials or unrelated tools", async () => {
    const f = fixture(saved);
    const calls: unknown[] = [];
    const tool = {
      name: "editJiraIssue",
      description: "Edit an issue",
      inputSchema: { type: "object", properties: { fields: { type: "object" } } },
      annotations: { destructiveHint: true },
    };
    const raw = {
      content: [{ type: "text", text: "private issue data" }],
      structuredContent: { key: "TEAM-1" },
      isError: true,
    };
    const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "GET") return new Response(null, { status: 405 });
      const message = JSON.parse(String(init?.body));
      if (message.method === "notifications/initialized")
        return new Response(null, { status: 202 });
      let result: unknown;
      if (message.method === "initialize")
        result = {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "test", version: "1" },
        };
      else if (message.method === "tools/list")
        result = message.params?.cursor
          ? { tools: [tool] }
          : {
              tools: [{ name: "getConfluencePage", inputSchema: { type: "object" } }],
              nextCursor: "next",
            };
      else if (message.method === "tools/call") {
        calls.push(message.params);
        result = raw;
      } else throw new Error(`Unexpected method ${message.method}`);
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    });
    try {
      const connection = makeJiraConnection(f.deps);
      expect(await connection.listAgentTools()).toEqual([tool]);
      await expect(
        connection.callAgentTool({
          name: "getConfluencePage",
          arguments: {},
          expiresAt: Number.MAX_SAFE_INTEGER,
        }),
      ).rejects.toThrow("unavailable");
      await expect(
        connection.callAgentTool({ name: tool.name, arguments: {}, expiresAt: 0 }),
      ).rejects.toThrow("expired");
      expect(
        await connection.callAgentTool({
          name: tool.name,
          arguments: { fields: { summary: "private input" } },
          expiresAt: Number.MAX_SAFE_INTEGER,
        }),
      ).toEqual(raw);
      expect(calls).toHaveLength(1);
      expect(connection.diagnostics()).not.toContain("private");
      expect(connection.diagnostics()).not.toContain("old-token");
      expect(f.opened()).toBe(0);
      await connection.disconnect();
      await expect(
        connection.callAgentTool({
          name: tool.name,
          arguments: {},
          expiresAt: Number.MAX_SAFE_INTEGER,
        }),
      ).rejects.toThrow("unavailable");
    } finally {
      mock.mockRestore();
    }
  });

  it("discovers sites and paginated projects with saved credentials without opening sign-in", async () => {
    const f = fixture(saved);
    const calls: unknown[] = [];
    const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "GET") return new Response(null, { status: 405 });
      const message = JSON.parse(String(init?.body));
      if (message.method === "notifications/initialized")
        return new Response(null, { status: 202 });
      let result: unknown;
      if (message.method === "initialize")
        result = {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "test", version: "1" },
        };
      else if (message.method === "tools/call") {
        calls.push(message.params);
        const data =
          message.params.name === "getAccessibleAtlassianResources"
            ? [{ id: "cloud", name: "Team", url: "https://team.atlassian.net/" }]
            : {
                values: [{ id: "100", key: "TEAM", name: "Team" }],
                startAt: message.params.arguments.startAt,
                isLast: message.params.arguments.startAt > 0,
              };
        result = { content: [{ type: "text", text: JSON.stringify(data) }] };
      } else throw new Error(`Unexpected method ${message.method}`);
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    });
    try {
      const connection = makeJiraConnection(f.deps);
      const [sites, projects] = await Promise.all([
        connection.listSites(),
        connection.listProjects({ cloudId: "cloud", startAt: 0 }),
      ]);
      expect(sites).toEqual([{ id: "cloud", name: "Team", url: "https://team.atlassian.net" }]);
      expect(projects.nextStartAt).toBe(1);
      expect(
        (await connection.listProjects({ cloudId: "cloud", startAt: 1 })).nextStartAt,
      ).toBeNull();
      expect(calls).toEqual([
        { name: "getAccessibleAtlassianResources", arguments: {} },
        {
          name: "getVisibleJiraProjects",
          arguments: { cloudId: "cloud", startAt: 0, maxResults: 50 },
        },
        {
          name: "getVisibleJiraProjects",
          arguments: { cloudId: "cloud", startAt: 1, maxResults: 50 },
        },
      ]);
      expect(f.opened()).toBe(0);
      expect(f.value()).toBe(saved);
      expect(connection.diagnostics()).not.toContain("old-token");
      expect(connection.diagnostics()).not.toContain("Team");
    } finally {
      mock.mockRestore();
    }
  });

  it.each(["tool-error", "malformed", "cancel"])(
    "handles discovery %s without changing saved auth unexpectedly",
    async (outcome) => {
      const f = fixture(saved);
      const started = Promise.withResolvers<void>();
      const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        if (init?.method === "GET") return new Response(null, { status: 405 });
        const message = JSON.parse(String(init?.body));
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        let result: unknown;
        if (message.method === "initialize")
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "test", version: "1" },
          };
        else if (message.method === "tools/call") {
          started.resolve();
          if (outcome === "cancel")
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(new Error("Cancelled")), {
                once: true,
              });
            });
          result = {
            isError: outcome === "tool-error",
            content: [{ type: "text", text: "private response" }],
          };
        } else throw new Error(`Unexpected method ${message.method}`);
        return Response.json({ jsonrpc: "2.0", id: message.id, result });
      });
      try {
        const connection = makeJiraConnection(f.deps);
        const listing = connection.listSites();
        const rejected = expect(listing).rejects.toThrow("Jira failed at tools/call");
        await started.promise;
        if (outcome === "cancel") {
          const queued = expect(connection.listSites()).rejects.toThrow("cancelled by disconnect");
          await connection.disconnect();
          await queued;
        }
        await rejected;
        expect(f.value()).toBe(outcome === "cancel" ? undefined : saved);
        expect(f.opened()).toBe(0);
        expect(connection.diagnostics()).not.toContain("private response");
      } finally {
        mock.mockRestore();
      }
    },
  );

  it("loads project work and executes only the selected Jira transition", async () => {
    const f = fixture(saved);
    const calls: unknown[] = [];
    let failTransition = false;
    const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "GET") return new Response(null, { status: 405 });
      const message = JSON.parse(String(init?.body));
      if (message.method === "notifications/initialized")
        return new Response(null, { status: 202 });
      let result: unknown;
      if (message.method === "initialize")
        result = {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "test", version: "1" },
        };
      else if (message.method === "tools/call") {
        calls.push(message.params);
        if (message.params.name === "transitionJiraIssue")
          result = { content: [], isError: failTransition };
        else
          result = {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  message.params.name === "getTransitionsForJiraIssue"
                    ? { transitions: [{ id: "42", name: "Start" }] }
                    : message.params.name === "getJiraIssue"
                      ? { names: { customfield_12345: "Story point estimate" } }
                      : {
                          issues:
                            message.params.arguments.maxResults === 1
                              ? [{ key: "TEAM-1" }]
                              : [
                                  {
                                    id: "1",
                                    key: "TEAM-1",
                                    fields: {
                                      summary: "Estimated task",
                                      issuetype: { name: "Task" },
                                      status: { name: "To Do", statusCategory: { key: "new" } },
                                      customfield_12345: 5,
                                    },
                                  },
                                ],
                          isLast: true,
                        },
                ),
              },
            ],
          };
      } else throw new Error(`Unexpected method ${message.method}`);
      return Response.json({ jsonrpc: "2.0", id: message.id, result });
    });
    try {
      const connection = makeJiraConnection(f.deps);
      expect(
        await connection.listIssues({
          cloudId: "cloud",
          projectKey: "TEAM",
          nextPageToken: "page2",
        }),
      ).toMatchObject({ issues: [{ key: "TEAM-1", storyPoints: 5 }], nextPageToken: null });
      expect(await connection.getTransitions({ cloudId: "cloud", issueKey: "TEAM-1" })).toEqual([
        { id: "42", name: "Start" },
      ]);
      expect(calls).toHaveLength(4);
      await connection.transitionIssue({
        cloudId: "cloud",
        issueKey: "TEAM-1",
        transitionId: "42",
      });
      expect(calls).toEqual([
        {
          name: "searchJiraIssuesUsingJql",
          arguments: {
            cloudId: "cloud",
            jql: 'project = "TEAM" ORDER BY updated DESC, key ASC',
            maxResults: 1,
            fields: ["summary"],
          },
        },
        {
          name: "getJiraIssue",
          arguments: {
            cloudId: "cloud",
            issueIdOrKey: "TEAM-1",
            fields: ["*all"],
            expand: "names",
            responseContentFormat: "adf",
          },
        },
        {
          name: "searchJiraIssuesUsingJql",
          arguments: {
            cloudId: "cloud",
            jql: 'project = "TEAM" ORDER BY updated DESC, key ASC',
            maxResults: 100,
            fields: ["summary", "issuetype", "status", "assignee", "priority", "customfield_12345"],
            nextPageToken: "page2",
          },
        },
        {
          name: "getTransitionsForJiraIssue",
          arguments: { cloudId: "cloud", issueIdOrKey: "TEAM-1" },
        },
        {
          name: "transitionJiraIssue",
          arguments: { cloudId: "cloud", issueIdOrKey: "TEAM-1", transition: { id: "42" } },
        },
      ]);
      failTransition = true;
      await expect(
        connection.transitionIssue({ cloudId: "cloud", issueKey: "TEAM-1", transitionId: "42" }),
      ).rejects.toThrow("tool error");
      expect(calls).toHaveLength(6);
      expect(f.value()).toBe(saved);
      expect(f.opened()).toBe(0);
    } finally {
      mock.mockRestore();
    }
  });

  it("requires an existing connection for pickers", async () => {
    const f = fixture();
    await expect(makeJiraConnection(f.deps).listSites()).rejects.toThrow("Connect to Jira first");
    expect(f.opened()).toBe(0);
  });

  it.each(["success", "tool-error", "invalid-schema"])(
    "reports post-auth discovery and tool outcomes: %s",
    async (outcome) => {
      const f = fixture(saved);
      const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        if (init?.method === "GET") return new Response(null, { status: 405 });
        const message = JSON.parse(String(init?.body));
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        let result: unknown;
        if (message.method === "initialize")
          result = {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "atlassian-test", version: "2" },
          };
        else if (message.method === "tools/list") {
          result =
            outcome === "invalid-schema"
              ? { tools: [{ name: "broken", inputSchema: { type: "string" } }] }
              : message.params?.cursor
                ? { tools: [{ name: "other", inputSchema: { type: "object" } }] }
                : {
                    tools: [
                      {
                        name: "getAccessibleAtlassianResources",
                        inputSchema: { type: "object", properties: {} },
                      },
                    ],
                    nextCursor: "next",
                  };
        } else if (message.method === "tools/call")
          result = {
            isError: outcome === "tool-error",
            content: [
              {
                type: "text",
                text: outcome === "tool-error" ? "MCP permission denied; Bearer do-not-log" : "[]",
              },
            ],
          };
        else throw new Error(`Unexpected method ${message.method}`);
        return Response.json(
          { jsonrpc: "2.0", id: message.id, result },
          { headers: { "x-request-id": "test-request-id" } },
        );
      });
      try {
        const connection = makeJiraConnection(f.deps);
        if (outcome === "success") expect((await connection.test()).checkedAt).not.toBeNull();
        else {
          await expect(connection.test()).rejects.toThrow(
            outcome === "tool-error" ? "tools/call" : "tools/list",
          );
          expect(await connection.status()).toEqual({ connected: true, checkedAt: null });
        }
        const log = connection.diagnostics();
        expect(log).toContain("atlassian-test");
        expect(log).toContain("test-request-id");
        if (outcome !== "invalid-schema") {
          expect(log).toContain("Complete: 2 advertised tools");
          expect(log).toContain("getAccessibleAtlassianResources");
        }
        if (outcome === "tool-error") expect(log).toContain("MCP permission denied");
        expect(log).not.toContain("old-token");
        expect(log).not.toContain("do-not-log");
      } finally {
        mock.mockRestore();
      }
    },
  );

  it("uses the injected network client for v1 discovery, PKCE exchange and reconnect", async () => {
    const f = fixture();
    const nativeFetch = globalThis.fetch;
    let redirectUri = "";
    let tokenExchanged = false;
    const requested: string[] = [];
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected global fetch"));
    const injectedFetch: typeof globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requested.push(url.pathname);
      if (url.hostname === "127.0.0.1") return nativeFetch(input, init);
      if (url.pathname.includes("oauth-protected-resource"))
        return Response.json({
          resource: `https://mcp.atlassian.com/v1/mcp`,
          authorization_servers: ["https://auth.atlassian.com"],
        });
      if (url.pathname.includes("oauth-authorization-server"))
        return Response.json({
          issuer: "https://auth.atlassian.com",
          authorization_endpoint: "https://auth.atlassian.com/authorize",
          token_endpoint: "https://auth.atlassian.com/token",
          registration_endpoint: "https://auth.atlassian.com/register",
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.pathname === "/register") {
        const metadata = JSON.parse(String(init?.body));
        redirectUri = metadata.redirect_uris[0];
        return Response.json({ ...metadata, client_id: "test-client" });
      }
      if (url.pathname === "/token") {
        const form = new URLSearchParams(String(init?.body));
        expect(form.get("code")).toBe("authorized-code");
        expect(form.get("code_verifier")).toBeTruthy();
        expect(form.get("redirect_uri")).toBe(redirectUri);
        tokenExchanged = true;
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "Bearer",
        });
      }
      if (url.pathname === `/v1/mcp`) {
        if (new Headers(init?.headers).get("authorization") !== "Bearer access") {
          return new Response(null, {
            status: 401,
            headers: {
              "WWW-Authenticate": `Bearer resource_metadata="https://mcp.atlassian.com/.well-known/oauth-protected-resource/v1/mcp"`,
            },
          });
        }
        if (init?.method === "GET") return new Response(null, { status: 405 });
        const message = JSON.parse(String(init?.body));
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        return Response.json({
          jsonrpc: "2.0",
          id: message.id,
          result:
            message.method === "initialize"
              ? {
                  protocolVersion: "2025-03-26",
                  capabilities: { tools: {} },
                  serverInfo: { name: "test-atlassian", version: "1" },
                }
              : { tools: [] },
        });
      }
      throw new Error(`Unexpected request to ${url.origin}${url.pathname}`);
    };
    try {
      const connection = makeJiraConnection({
        ...f.deps,
        fetch: injectedFetch,
        openExternal: async (address) => {
          const authorization = new URL(address);
          expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
          const callback = new URL(redirectUri);
          callback.searchParams.set("state", authorization.searchParams.get("state")!);
          callback.searchParams.set("code", "authorized-code");
          await nativeFetch(callback);
        },
      });
      expect((await connection.connect()).checkedAt).not.toBeNull();
      expect(tokenExchanged).toBe(true);
      expect(requested).toContain("/register");
      expect(requested).toContain("/token");
      expect(requested.some((path) => path.includes("oauth-protected-resource"))).toBe(true);
      expect((await connection.test()).connected).toBe(true);
      expect(connection.diagnostics()).toContain(`/v1/mcp`);
      expect(connection.diagnostics()).toContain("tools/list: Complete");
      expect(mock).not.toHaveBeenCalled();
    } finally {
      mock.mockRestore();
    }
  });
  it("records the failed HTTP endpoint and underlying network cause without tokens", async () => {
    const connection = makeJiraConnection({
      ...fixture(saved).deps,
      fetch: async () => {
        throw new TypeError("fetch failed", {
          cause: Object.assign(new Error("proxy rejected old-token"), { code: "ECONNRESET" }),
        });
      },
    });
    await expect(connection.test()).rejects.toThrow("ECONNRESET");
    expect(connection.diagnostics()).toContain(
      "HTTP failed: POST https://mcp.atlassian.com/v1/mcp",
    );
    expect(connection.diagnostics()).toContain("caused by Error [ECONNRESET]");
    expect(connection.diagnostics()).not.toContain("old-token");
    expect((await connection.status()).checkedAt).toBeNull();
  });
  it("starts disconnected and does not open sign-in when testing without credentials", async () => {
    const f = fixture();
    const connection = makeJiraConnection(f.deps);
    expect(await connection.status()).toEqual({ connected: false, checkedAt: null });
    await expect(connection.test()).rejects.toThrow("Connect to Jira first");
    expect(f.opened()).toBe(0);
  });

  it("retains rotated tokens after a failed probe without claiming verified access", async () => {
    const f = fixture(saved);
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider) => {
        expect((await provider.tokens())?.access_token).toBe("old-token");
        await provider.saveTokens({
          access_token: "new-token",
          refresh_token: "rotated",
          token_type: "Bearer",
        });
        throw new Error("MCP unavailable");
      },
    });
    await expect(connection.test()).rejects.toThrow("MCP unavailable");
    expect(JSON.parse(f.value()!).tokens.refresh_token).toBe("rotated");
    expect(await connection.status()).toEqual({ connected: true, checkedAt: null });
    expect(f.opened()).toBe(0);
  });

  it("reconnects with fresh SSO credentials and verifies MCP before reporting connected", async () => {
    const f = fixture(saved);
    let provider: OAuthClientProvider;
    let probes = 0;
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (next) => {
        provider = next;
        if (++probes === 1) {
          expect(await provider.tokens()).toBeUndefined();
          expect(await provider.clientInformation()).toBeUndefined();
          await provider.saveClientInformation!({ client_id: "test-client" });
          await provider.saveCodeVerifier("test-verifier");
          await provider.redirectToAuthorization(new URL("https://auth.atlassian.com/authorize"));
          throw new UnauthorizedError();
        }
        expect((await provider.tokens())?.access_token).toBe("access");
      },
      openExternal: async () => {
        const callback = new URL(String(provider.redirectUrl));
        callback.searchParams.set("state", await provider.state!());
        callback.searchParams.set("code", "test-code");
        expect((await fetch(callback)).status).toBe(200);
      },
      finishAuth: async (next, code) => {
        expect(code).toBe("test-code");
        expect(await next.codeVerifier()).toBe("test-verifier");
        await next.saveTokens({ access_token: "access", token_type: "Bearer" });
      },
    });
    const status = await connection.connect();
    expect(status.connected).toBe(true);
    expect(status.checkedAt).not.toBeNull();
    expect(probes).toBe(2);
    expect(f.value()).not.toContain("test-verifier");
    expect(await connection.disconnect()).toEqual({ connected: false, checkedAt: null });
    expect(f.value()).toBeUndefined();
  });

  it("ignores mismatched state and accepts only its own callback", async () => {
    const callback = await listenForJiraOAuth("expected", new AbortController().signal);
    try {
      expect((await fetch(`${callback.redirectUrl}?state=wrong&code=bad`)).status).toBe(400);
      expect((await fetch(`${callback.redirectUrl}?state=expected&code=good`)).status).toBe(200);
      expect(await callback.code).toBe("good");
    } finally {
      callback.close();
    }
  });

  it("reports declined sign-in and closes an aborted callback listener", async () => {
    const controller = new AbortController();
    const callback = await listenForJiraOAuth("expected", controller.signal);
    await fetch(`${callback.redirectUrl}?state=expected&error=access_denied`);
    await expect(callback.code).rejects.toThrow("declined");
    controller.abort();
    await expect(fetch(callback.redirectUrl)).rejects.toThrow();
  });

  it("cancels an in-flight sign-in and removes credentials after it settles", async () => {
    const f = fixture(saved);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider, signal) => {
        started();
        await new Promise<void>((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
        );
        await provider.saveTokens({ access_token: "must-not-save", token_type: "Bearer" });
      },
    });
    const connecting = connection.connect();
    expect(connection.connect()).toBe(connecting);
    const rejected = expect(connecting).rejects.toThrow("cancelled");
    await ready;
    await connection.disconnect();
    await rejected;
    expect(f.value()).toBeUndefined();
  });

  it("requires reconnect instead of opening a browser during Test connection", async () => {
    const f = fixture(saved);
    const connection = makeJiraConnection({
      ...f.deps,
      probe: async (provider) => {
        await provider.redirectToAuthorization(new URL("https://auth.atlassian.com/authorize"));
      },
    });
    await expect(connection.test()).rejects.toThrow("Reconnect");
    expect(f.opened()).toBe(0);
  });
});
