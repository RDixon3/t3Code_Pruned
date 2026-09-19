// @effect-diagnostics globalFetch:off -- Tests the OAuth loopback callback without contacting a ServiceNow instance.
import { describe, expect, it } from "vite-plus/test";
import * as NodeCrypto from "node:crypto";
import { SERVICENOW_OAUTH_CALLBACK } from "@t3tools/contracts";
import { makeServiceNowConnection, normalizeServiceNowConfig } from "./ServiceNowConnection.ts";

const config = { instanceUrl: "https://example.service-now.com", clientId: "test-client" };
const saved = JSON.stringify({
  config,
  tokens: { access_token: "old", refresh_token: "refresh", token_type: "Bearer" },
});
function fixture(initial?: string) {
  let value = initial;
  return {
    read: async () => value,
    write: async (next: string) => {
      value = next;
    },
    remove: async () => {
      value = undefined;
    },
    openExternal: async () => {},
  };
}

describe("ServiceNow connection", () => {
  it("requires a clean HTTPS instance origin and client ID", () => {
    expect(
      normalizeServiceNowConfig({ instanceUrl: `${config.instanceUrl}/`, clientId: " client " }),
    ).toEqual({ ...config, clientId: "client" });
    for (const instanceUrl of [
      "http://example.com",
      "https://user:password@example.com",
      "https://example.com/path",
      "https://example.com?token=x",
    ]) {
      expect(() => normalizeServiceNowConfig({ ...config, instanceUrl })).toThrow();
    }
    expect(() => normalizeServiceNowConfig({ ...config, clientId: " " })).toThrow();
  });

  it("exchanges the bound PKCE code and returns only public connection status", async () => {
    const f = fixture();
    let challenge = "";
    const connection = makeServiceNowConnection({
      ...f,
      openExternal: async (address) => {
        const url = new URL(address);
        expect(url.origin).toBe(config.instanceUrl);
        expect(url.pathname).toBe("/oauth_auth.do");
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        expect(url.searchParams.get("redirect_uri")).toBe(SERVICENOW_OAUTH_CALLBACK);
        challenge = url.searchParams.get("code_challenge")!;
        const callback = new URL(SERVICENOW_OAUTH_CALLBACK);
        callback.searchParams.set("code", "authorized");
        callback.searchParams.set("state", url.searchParams.get("state")!);
        await fetch(callback);
      },
      fetch: async (address, init) => {
        expect(String(address)).toBe(`${config.instanceUrl}/oauth_token.do`);
        expect(init?.redirect).toBe("error");
        const params = new URLSearchParams(String(init?.body));
        expect(params.get("code")).toBe("authorized");
        expect(params.get("client_id")).toBe(config.clientId);
        expect(params.has("client_secret")).toBe(false);
        expect(
          NodeCrypto.createHash("sha256").update(params.get("code_verifier")!).digest("base64url"),
        ).toBe(challenge);
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          token_type: "Bearer",
        });
      },
    });
    const result = await connection.connect(config);
    expect(result).toMatchObject({ config, connected: true });
    expect(result.checkedAt).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("access_token");
    expect(await f.read()).not.toContain("code_verifier");
  });

  it("tests via refresh and retains a refresh token when the server does not rotate it", async () => {
    const f = fixture(saved);
    const connection = makeServiceNowConnection({
      ...f,
      fetch: async (_, init) => {
        const params = new URLSearchParams(String(init?.body));
        expect(params.get("grant_type")).toBe("refresh_token");
        expect(params.get("refresh_token")).toBe("refresh");
        return Response.json({ access_token: "new", token_type: "Bearer" });
      },
    });
    expect((await connection.test()).checkedAt).not.toBeNull();
    expect(JSON.parse((await f.read())!).tokens).toMatchObject({
      access_token: "new",
      refresh_token: "refresh",
    });
    await connection.disconnect();
    expect(await connection.status()).toEqual({ config: null, connected: false, checkedAt: null });
  });

  it("does not mark failed authentication verified or expose the server response body", async () => {
    const f = fixture(saved);
    const connection = makeServiceNowConnection({
      ...f,
      fetch: async () => new Response("sensitive server detail", { status: 401 }),
    });
    await expect(connection.test()).rejects.toThrow("HTTP 401");
    expect((await connection.status()).checkedAt).toBeNull();
    expect(await f.read()).toBe(saved);
  });

  it("cancels sign-in and clears stored credentials after the callback settles", async () => {
    const f = fixture(saved);
    let opened!: () => void;
    const ready = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const connection = makeServiceNowConnection({
      ...f,
      openExternal: async () => {
        opened();
      },
    });
    const connecting = connection.connect(config);
    const rejected = expect(connecting).rejects.toThrow("cancelled");
    await ready;
    await connection.disconnect();
    await rejected;
    expect(await f.read()).toBeUndefined();
    await expect(fetch(SERVICENOW_OAUTH_CALLBACK)).rejects.toThrow();
  });
});
