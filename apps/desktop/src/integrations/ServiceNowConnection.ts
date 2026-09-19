// @effect-diagnostics globalFetch:off globalDate:off -- Desktop OAuth adapter uses Fetch and Promise interfaces outside Effect fibers.
import * as NodeCrypto from "node:crypto";
import * as Schema from "effect/Schema";
import {
  SERVICENOW_OAUTH_CALLBACK,
  ServiceNowConnectionConfigSchema,
  type ServiceNowConnectionConfig,
  type ServiceNowConnectionStatus,
} from "@t3tools/contracts";
import { listenForOAuth } from "./oauthCallback.ts";

const Tokens = Schema.Struct({
  access_token: Schema.NonEmptyString,
  refresh_token: Schema.optional(Schema.NonEmptyString),
  token_type: Schema.String,
});
const Saved = Schema.Struct({ config: ServiceNowConnectionConfigSchema, tokens: Tokens });
type Saved = typeof Saved.Type;
const decodeSaved = Schema.decodeUnknownSync(Saved);
const decodeTokens = Schema.decodeUnknownSync(Tokens);

export function normalizeServiceNowConfig(
  input: ServiceNowConnectionConfig,
): ServiceNowConnectionConfig {
  const url = new URL(input.instanceUrl.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Enter the HTTPS instance address without a path, query, or credentials.");
  }
  const clientId = input.clientId.trim();
  if (!clientId)
    throw new Error("Enter the OAuth client ID registered in your ServiceNow instance.");
  return { instanceUrl: url.origin, clientId };
}

export function makeServiceNowConnection(deps: {
  read: () => Promise<string | undefined>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  fetch?: typeof fetch;
}) {
  let checkedAt: string | null = null;
  let pending: { abort: AbortController; done: Promise<ServiceNowConnectionStatus> } | undefined;
  let disconnecting: Promise<ServiceNowConnectionStatus> | undefined;
  const load = async () => {
    const value = await deps.read();
    if (!value) return undefined;
    const saved = decodeSaved(JSON.parse(value));
    return { ...saved, config: normalizeServiceNowConfig(saved.config) };
  };
  const status = async (): Promise<ServiceNowConnectionStatus> => {
    const saved = await load();
    return { config: saved?.config ?? null, connected: Boolean(saved), checkedAt };
  };
  const exchange = async (
    config: ServiceNowConnectionConfig,
    params: URLSearchParams,
    signal: AbortSignal,
  ) => {
    params.set("client_id", config.clientId);
    const response = await (deps.fetch ?? fetch)(`${config.instanceUrl}/oauth_token.do`, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: params,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if (!response.ok)
      throw new Error(
        `ServiceNow authorization failed (HTTP ${response.status}). Check the OAuth registration or reconnect.`,
      );
    const tokens = decodeTokens(await response.json());
    if (tokens.token_type.toLowerCase() !== "bearer")
      throw new Error("ServiceNow returned an unsupported token type.");
    return tokens;
  };
  const run = (config?: ServiceNowConnectionConfig): Promise<ServiceNowConnectionStatus> => {
    if (disconnecting) return Promise.reject(new Error("Wait for ServiceNow to disconnect."));
    if (pending) return pending.done;
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(config ? 300_000 : 45_000)]);
    const done = (async () => {
      checkedAt = null;
      let saved: Saved;
      if (config) {
        const normalized = normalizeServiceNowConfig(config);
        const state = NodeCrypto.randomBytes(32).toString("base64url");
        const verifier = NodeCrypto.randomBytes(32).toString("base64url");
        const callbackUrl = new URL(SERVICENOW_OAUTH_CALLBACK);
        const callback = await listenForOAuth(state, signal, {
          name: "ServiceNow",
          path: callbackUrl.pathname,
          port: Number(callbackUrl.port),
        });
        try {
          const url = new URL("/oauth_auth.do", normalized.instanceUrl);
          url.search = new URLSearchParams({
            response_type: "code",
            client_id: normalized.clientId,
            redirect_uri: callback.redirectUrl,
            state,
            code_challenge: NodeCrypto.createHash("sha256").update(verifier).digest("base64url"),
            code_challenge_method: "S256",
          }).toString();
          signal.throwIfAborted();
          await deps.openExternal(url.href);
          const tokens = await exchange(
            normalized,
            new URLSearchParams({
              grant_type: "authorization_code",
              code: await callback.code,
              redirect_uri: callback.redirectUrl,
              code_verifier: verifier,
            }),
            signal,
          );
          saved = { config: normalized, tokens };
        } finally {
          callback.close();
        }
      } else {
        const current = await load();
        if (!current?.tokens.refresh_token)
          throw new Error("Reconnect to ServiceNow to renew your sign-in.");
        const tokens = await exchange(
          current.config,
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: current.tokens.refresh_token,
          }),
          signal,
        );
        saved = {
          config: current.config,
          tokens: {
            ...tokens,
            refresh_token: tokens.refresh_token ?? current.tokens.refresh_token,
          },
        };
      }
      signal.throwIfAborted();
      await deps.write(JSON.stringify(saved));
      checkedAt = new Date().toISOString();
      return { config: saved.config, connected: true, checkedAt };
    })().finally(() => {
      pending = undefined;
    });
    pending = { abort, done };
    return done;
  };
  return {
    status,
    connect: (config: ServiceNowConnectionConfig) => run(config),
    // Validates OAuth by refreshing it. Table permissions require the pursuit schema.
    test: () => run(),
    disconnect: (): Promise<ServiceNowConnectionStatus> => {
      if (disconnecting) return disconnecting;
      disconnecting = (async () => {
        const current = pending;
        current?.abort.abort();
        await current?.done.catch(() => {});
        await deps.remove();
        checkedAt = null;
        return { config: null, connected: false, checkedAt };
      })().finally(() => {
        disconnecting = undefined;
      });
      return disconnecting;
    },
  };
}
