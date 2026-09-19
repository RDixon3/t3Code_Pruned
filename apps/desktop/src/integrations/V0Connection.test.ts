import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { makeV0Connection } from "./V0Connection.ts";

const saved = JSON.stringify({
  redirectUrl: "http://127.0.0.1:12345/v0/callback",
  client: { client_id: "client-secret-value" },
  tokens: { access_token: "old-token", refresh_token: "refresh-token", token_type: "Bearer" },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
function fixture(initial?: string) {
  let value = initial;
  const close = vi.fn();
  const deps = {
    read: async () => value,
    write: vi.fn(async (next: string) => {
      value = next;
    }),
    remove: vi.fn(async () => {
      value = undefined;
    }),
    openExternal: vi.fn(async (_url: string) => {}),
    listenForAuth: async () => ({
      redirectUrl: "http://127.0.0.1:12345/v0/callback",
      code: Promise.resolve("authorization-secret"),
      close,
    }),
  };
  return { deps, value: () => value, close };
}
afterEach(() => vi.restoreAllMocks());

describe("v0 connection", () => {
  it("starts disconnected and does not authorize while testing without credentials", async () => {
    const f = fixture();
    const connection = makeV0Connection(f.deps);
    expect(await connection.status()).toEqual({
      connected: false,
      checkedAt: null,
      needsReauthentication: false,
    });
    await expect(connection.test()).rejects.toThrow("Connect to v0 first");
    expect(f.deps.openExternal).not.toHaveBeenCalled();
  });

  it("authorizes through the browser, persists credentials and probes again", async () => {
    const f = fixture();
    const probe = vi.fn(async (provider: OAuthClientProvider) => {
      if (await provider.tokens()) return;
      await provider.saveClientInformation!({ client_id: "client-secret-value" });
      await provider.saveCodeVerifier("verifier-secret");
      await provider.redirectToAuthorization(
        new URL("https://v0.app/api/mcp/oauth/authorize?state=private"),
      );
      throw new UnauthorizedError();
    });
    const connection = makeV0Connection({
      ...f.deps,
      probe,
      finishAuth: async (provider, code) => {
        expect(code).toBe("authorization-secret");
        expect(await provider.codeVerifier()).toBe("verifier-secret");
        expect(provider.clientMetadata.scope).toBe("mcp");
        await provider.saveTokens({
          access_token: "access-secret",
          refresh_token: "refresh-secret",
          token_type: "Bearer",
        });
      },
    });
    expect(await connection.connect()).toMatchObject({
      connected: true,
      needsReauthentication: false,
    });
    expect((await connection.status()).checkedAt).not.toBeNull();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(f.deps.openExternal).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
    expect(JSON.parse(f.value()!).tokens.refresh_token).toBe("refresh-secret");
    for (const secret of [
      "access-secret",
      "refresh-secret",
      "authorization-secret",
      "verifier-secret",
      "client-secret-value",
    ])
      expect(connection.diagnostics()).not.toContain(secret);
  });

  it("uses saved credentials after restart and retains rotated tokens when discovery fails", async () => {
    const f = fixture(saved);
    const connection = makeV0Connection({
      ...f.deps,
      probe: async (provider) => {
        expect((await provider.tokens())?.refresh_token).toBe("refresh-token");
        await provider.saveTokens({
          access_token: "new-token",
          refresh_token: "rotated-token",
          token_type: "Bearer",
        });
        throw new Error("discovery unavailable");
      },
    });
    await expect(connection.test()).rejects.toThrow("v0 failed");
    expect(connection.diagnostics()).not.toContain("discovery unavailable");
    expect(await connection.status()).toEqual({
      connected: true,
      checkedAt: null,
      needsReauthentication: false,
    });
    expect(JSON.parse(f.value()!).tokens.refresh_token).toBe("rotated-token");
    expect(f.deps.openExternal).not.toHaveBeenCalled();
    const restarted = makeV0Connection({
      ...f.deps,
      probe: async (provider) => {
        expect((await provider.tokens())?.refresh_token).toBe("rotated-token");
      },
    });
    expect((await restarted.test()).connected).toBe(true);
  });

  it("requires reconnect when authorization expires and never opens a browser on a test", async () => {
    const f = fixture(saved);
    const connection = makeV0Connection({
      ...f.deps,
      probe: async (provider) => {
        await provider.invalidateCredentials?.("tokens");
        await provider.redirectToAuthorization(new URL("https://v0.app/api/mcp/oauth/authorize"));
      },
    });
    await expect(connection.test()).rejects.toThrow("Reconnect in Settings");
    expect(await connection.status()).toEqual({
      connected: false,
      checkedAt: null,
      needsReauthentication: true,
    });
    expect(f.deps.openExternal).not.toHaveBeenCalled();
  });

  it("rejects unexpected authorization origins and invalid saved redirect addresses", async () => {
    const f = fixture();
    const connection = makeV0Connection({
      ...f.deps,
      probe: async (provider) => {
        await provider.redirectToAuthorization(new URL("https://other.example/authorize"));
      },
    });
    await expect(connection.connect()).rejects.toThrow("Unexpected v0 authorization address");
    expect(f.deps.openExternal).not.toHaveBeenCalled();
    await expect(
      makeV0Connection(fixture(saved.replace("127.0.0.1", "other.example")).deps).status(),
    ).rejects.toThrow("invalid");
  });

  it("serializes refreshes so the next request sees the rotated token", async () => {
    const f = fixture(saved);
    const entered = deferred<void>();
    const release = deferred<void>();
    let count = 0;
    const connection = makeV0Connection({
      ...f.deps,
      probe: async (provider) => {
        count++;
        if (count === 1) {
          entered.resolve();
          await release.promise;
          await provider.saveTokens({
            access_token: "next-token",
            refresh_token: "next-refresh",
            token_type: "Bearer",
          });
        } else expect((await provider.tokens())?.refresh_token).toBe("next-refresh");
      },
    });
    const first = connection.test();
    await entered.promise;
    const second = connection.test();
    expect(count).toBe(1);
    release.resolve();
    await Promise.all([first, second]);
    expect(count).toBe(2);
  });

  it("disconnect cancels queued work and waits for a token write before removing credentials", async () => {
    const f = fixture(saved);
    const writing = deferred<void>();
    const release = deferred<void>();
    let probes = 0;
    const connection = makeV0Connection({
      ...f.deps,
      write: async (value) => {
        writing.resolve();
        await release.promise;
        await f.deps.write(value);
      },
      probe: async (provider) => {
        probes++;
        await provider.saveTokens({ access_token: "late-token", token_type: "Bearer" });
      },
    });
    const first = expect(connection.test()).rejects.toThrow();
    await writing.promise;
    const queued = expect(connection.test()).rejects.toThrow("cancelled");
    const disconnecting = connection.disconnect();
    await expect(connection.connect()).rejects.toThrow("disconnecting");
    release.resolve();
    await Promise.all([first, queued, disconnecting]);
    expect(probes).toBe(1);
    expect(f.value()).toBeUndefined();
    expect(f.deps.remove).toHaveBeenCalledOnce();
  });

  it("cancel preserves a previous connection and closes the sign-in callback", async () => {
    const f = fixture(saved);
    const entered = deferred<void>();
    const connection = makeV0Connection({
      ...f.deps,
      probe: async (_provider, signal) => {
        entered.resolve();
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
        );
      },
    });
    const connecting = expect(connection.connect()).rejects.toThrow("cancelled");
    await entered.promise;
    expect((await connection.cancel()).connected).toBe(true);
    await connecting;
    expect(f.value()).toBe(saved);
    expect(f.close).toHaveBeenCalledOnce();
  });

  it("disconnect supersedes cancel even after cancellation has started reading saved status", async () => {
    const f = fixture(saved);
    const reading = deferred<void>();
    const release = deferred<void>();
    let reads = 0;
    const connection = makeV0Connection({
      ...f.deps,
      read: async () => {
        reads++;
        if (reads === 1) {
          const previous = f.value();
          reading.resolve();
          await release.promise;
          return previous;
        }
        return f.deps.read();
      },
    });
    const cancelling = connection.cancel();
    await reading.promise;
    const disconnecting = connection.disconnect();
    release.resolve();
    expect((await disconnecting).connected).toBe(false);
    await cancelling;
    expect(f.value()).toBeUndefined();
    expect(f.deps.remove).toHaveBeenCalledOnce();
  });

  it("discovers paginated tools without calling generation and rejects repeated cursors", async () => {
    vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    const list = vi
      .spyOn(Client.prototype, "listTools")
      .mockResolvedValueOnce({
        tools: [{ name: "first", inputSchema: { type: "object" } }],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({ tools: [{ name: "second", inputSchema: { type: "object" } }] });
    const call = vi.spyOn(Client.prototype, "callTool");
    const connection = makeV0Connection(fixture(saved).deps);
    expect((await connection.test()).connected).toBe(true);
    expect(call).not.toHaveBeenCalled();
    expect(connection.diagnostics()).toContain("2 tools discovered");
    list.mockResolvedValue({ tools: [], nextCursor: "repeated" });
    await expect(connection.test()).rejects.toThrow("repeated a cursor");
    expect((await connection.status()).checkedAt).toBeNull();
  });
});

describe("v0 chat tools", () => {
  it("forwards generation, pending tasks, previews and SSO results without changing them", async () => {
    vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    const tools = ["createChat", "sendChatMessage", "getPreview", "resolveTask"].map((name) => ({
      name,
      inputSchema: { type: "object" as const },
    }));
    vi.spyOn(Client.prototype, "listTools").mockResolvedValue({ tools });
    const result = {
      content: [{ type: "text" as const, text: "SSO or task response" }],
      structuredContent: {
        chatId: "chat-1",
        task: "plan-exit-response",
        url: "https://v0.app/chat/example",
      },
    };
    const call = vi.spyOn(Client.prototype, "callTool").mockResolvedValue(result);
    const connection = makeV0Connection(fixture(saved).deps);
    expect(await connection.listAgentTools()).toEqual(tools);
    for (const name of tools.map((tool) => tool.name)) {
      expect(
        await connection.callAgentTool({
          name,
          expiresAt: Number.MAX_SAFE_INTEGER,
          arguments: { chatId: "chat-1", message: "private prototype prompt" },
        }),
      ).toEqual(result);
    }
    expect(call).toHaveBeenCalledTimes(4);
    expect(connection.diagnostics()).not.toContain("private prototype prompt");
    expect(connection.diagnostics()).not.toContain("SSO or task response");
  });
  it("rejects unknown and expired calls, and never retries a failed generation", async () => {
    vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(Client.prototype, "listTools").mockResolvedValue({
      tools: [{ name: "createChat", inputSchema: { type: "object" } }],
    });
    const call = vi
      .spyOn(Client.prototype, "callTool")
      .mockRejectedValue(new Error("raw private response"));
    const connection = makeV0Connection(fixture(saved).deps);
    await connection.listAgentTools();
    await expect(
      connection.callAgentTool({
        name: "unknown",
        expiresAt: Number.MAX_SAFE_INTEGER,
        arguments: {},
      }),
    ).rejects.toThrow("unavailable");
    await expect(
      connection.callAgentTool({ name: "createChat", expiresAt: 1, arguments: {} }),
    ).rejects.toThrow("expired");
    expect(call).not.toHaveBeenCalled();
    await expect(
      connection.callAgentTool({
        name: "createChat",
        expiresAt: Number.MAX_SAFE_INTEGER,
        arguments: {},
      }),
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(1);
    expect(connection.diagnostics()).not.toContain("raw private response");
  });
});
