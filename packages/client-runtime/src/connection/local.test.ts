import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { LocalEnvironmentEndpoints } from "../platform/capabilities.ts";
import { assertLocalConnectionEndpoints, isLoopbackConnectionUrl } from "./local.ts";
describe("local endpoint policy", () => {
  it.each(["http://localhost:3201", "https://127.0.0.1:3201", "http://[::1]:3201"])(
    "allows loopback %s",
    (url) => expect(isLoopbackConnectionUrl(url, ["http:", "https:"])).toBe(true),
  );
  it.each([
    "https://example.com",
    "http://192.168.1.2",
    "http://localhost.example.com",
    "http://user@localhost",
    "file:///localhost",
    "not a URL",
  ])("rejects nonlocal %s", (url) =>
    expect(isLoopbackConnectionUrl(url, ["http:", "https:"])).toBe(false),
  );
  it.effect("accepts only the exact endpoint allowed by the desktop capability", () =>
    Effect.gen(function* () {
      const endpoint = {
        httpBaseUrl: "http://172.27.0.99:3201",
        wsBaseUrl: "ws://172.27.0.99:3201",
      };
      yield* assertLocalConnectionEndpoints(endpoint).pipe(
        Effect.provideService(LocalEnvironmentEndpoints, {
          isAllowed: (input) =>
            input.httpBaseUrl === endpoint.httpBaseUrl && input.wsBaseUrl === endpoint.wsBaseUrl,
        }),
      );
      const failure = yield* assertLocalConnectionEndpoints(endpoint).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "ConnectionBlockedError", reason: "unsupported" });
    }),
  );
});
