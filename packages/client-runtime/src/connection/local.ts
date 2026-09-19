import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { LocalEnvironmentEndpoints } from "../platform/capabilities.ts";
import { ConnectionBlockedError } from "./model.ts";

export function isLoopbackConnectionUrl(value: string, protocols: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return (
      protocols.includes(url.protocol) &&
      !url.username &&
      !url.password &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
/** Local browser pairing uses loopback; the desktop may also own an exact WSL VM endpoint. */
export const assertLocalConnectionEndpoints = Effect.fn("connection.assertLocalEndpoints")(
  function* (input: { readonly httpBaseUrl: string; readonly wsBaseUrl: string }) {
    if (
      isLoopbackConnectionUrl(input.httpBaseUrl, ["http:", "https:"]) &&
      isLoopbackConnectionUrl(input.wsBaseUrl, ["ws:", "wss:"])
    )
      return;
    const local = yield* Effect.serviceOption(LocalEnvironmentEndpoints);
    if (Option.isSome(local) && local.value.isAllowed(input)) return;
    return yield* new ConnectionBlockedError({
      reason: "unsupported",
      detail: "CoCo connects only to local desktop and development environments.",
    });
  },
);
