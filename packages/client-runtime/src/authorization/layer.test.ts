import { describe, expect, it } from "@effect/vitest";
import { AuthStandardClientScopes, EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import * as ClientCapabilities from "../platform/capabilities.ts";
import { remoteHttpClientLayer } from "../rpc/http.ts";
import * as RemoteEnvironmentAuthorization from "./service.ts";
const ENVIRONMENT_ID = EnvironmentId.make("environment-1");
const ENDPOINT = { httpBaseUrl: "http://127.0.0.1:3201", wsBaseUrl: "ws://127.0.0.1:3201" };
const DESCRIPTOR = {
  environmentId: ENVIRONMENT_ID,
  label: "Local environment",
  platform: { os: "linux", arch: "x64" },
  serverVersion: "0.0.0-test",
  capabilities: { repositoryIdentity: true },
};
const websocketTicket = (ticket: string) =>
  Response.json({ ticket, expiresAt: "2026-06-06T01:00:00.000Z" });
function makeHarness(input: { responses: ReadonlyArray<Response> }) {
  const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
  let index = 0;
  const fetchFn: typeof fetch = (url, init) => {
    calls.push([url, init ?? {}]);
    const response = input.responses[index++];
    return response ? Promise.resolve(response) : Promise.reject(new Error("Unexpected fetch"));
  };
  const layer = RemoteEnvironmentAuthorization.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        remoteHttpClientLayer(fetchFn),
        Layer.succeed(ClientCapabilities.ClientPresentation, {
          metadata: { label: "Test", deviceType: "desktop", surface: "web" },
          scopes: AuthStandardClientScopes,
        }),
      ),
    ),
  );
  return Effect.succeed({ fetch: { calls }, layer });
}
describe("local environment authorization", () => {
  it.effect("reuses a validated bearer descriptor while issuing fresh websocket tickets", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        responses: [
          Response.json(DESCRIPTOR),
          websocketTicket("first-ticket"),
          websocketTicket("second-ticket"),
        ],
      });

      const [first, second] = yield* Effect.gen(function* () {
        const remote = yield* RemoteEnvironmentAuthorization.RemoteEnvironmentAuthorization;
        const authorize = () =>
          remote.authorizeBearer({
            expectedEnvironmentId: ENVIRONMENT_ID,
            httpBaseUrl: ENDPOINT.httpBaseUrl,
            wsBaseUrl: ENDPOINT.wsBaseUrl,
            bearerToken: "bearer-token",
            connectionMethod: "direct",
          });
        return [yield* authorize(), yield* authorize()] as const;
      }).pipe(Effect.provide(harness.layer));

      expect(first.socketUrl).toContain("wsTicket=first-ticket");
      expect(second.socketUrl).toContain("wsTicket=second-ticket");
      expect(
        harness.fetch.calls.filter(([url]) => String(url).endsWith("/.well-known/t3/environment")),
      ).toHaveLength(1);
      expect(
        harness.fetch.calls.filter(([url]) => String(url).endsWith("/api/auth/websocket-ticket")),
      ).toHaveLength(2);
    }),
  );

  it.effect("revalidates a bearer descriptor after the cache expires", () =>
    Effect.gen(function* () {
      const reassignedEnvironmentId = EnvironmentId.make("environment-2");
      const harness = yield* makeHarness({
        responses: [
          Response.json(DESCRIPTOR),
          websocketTicket("first-ticket"),
          Response.json({
            ...DESCRIPTOR,
            environmentId: reassignedEnvironmentId,
          }),
        ],
      });

      const failure = yield* Effect.gen(function* () {
        const remote = yield* RemoteEnvironmentAuthorization.RemoteEnvironmentAuthorization;
        const authorize = () =>
          remote.authorizeBearer({
            expectedEnvironmentId: ENVIRONMENT_ID,
            httpBaseUrl: ENDPOINT.httpBaseUrl,
            wsBaseUrl: ENDPOINT.wsBaseUrl,
            bearerToken: "bearer-token",
            connectionMethod: "direct",
          });

        yield* authorize();
        yield* TestClock.adjust("10 seconds");
        return yield* authorize().pipe(Effect.flip);
      }).pipe(Effect.provide(Layer.merge(harness.layer, TestClock.layer())));

      expect(failure).toEqual(
        expect.objectContaining({
          _tag: "ConnectionBlockedError",
          reason: "configuration",
          detail: `Connected environment ${reassignedEnvironmentId} does not match ${ENVIRONMENT_ID}.`,
        }),
      );
      expect(
        harness.fetch.calls.filter(([url]) => String(url).endsWith("/.well-known/t3/environment")),
      ).toHaveLength(2);
    }),
  );

  it.effect("rejects nonlocal credentials before sending a request", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({ responses: [] });
      const failure = yield* Effect.gen(function* () {
        const service = yield* RemoteEnvironmentAuthorization.RemoteEnvironmentAuthorization;
        return yield* service
          .authorizeBearer({
            expectedEnvironmentId: ENVIRONMENT_ID,
            httpBaseUrl: "https://example.com",
            wsBaseUrl: "wss://example.com",
            bearerToken: "secret",
            connectionMethod: "direct",
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(harness.layer));
      expect(failure).toMatchObject({ _tag: "ConnectionBlockedError", reason: "unsupported" });
      expect(harness.fetch.calls).toEqual([]);
    }),
  );
});
