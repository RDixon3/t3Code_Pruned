import { describe, expect, it } from "@effect/vitest";
import { EnvironmentAuthInvalidError } from "@t3tools/contracts";
import { RemoteEnvironmentAuthFetchError, RemoteEnvironmentAuthTimeoutError } from "../rpc/http.ts";
import { mapRemoteEnvironmentError } from "./errors.ts";
describe("environment errors", () => {
  it("preserves invalid credentials", () =>
    expect(
      mapRemoteEnvironmentError(
        new EnvironmentAuthInvalidError({
          code: "auth_invalid",
          reason: "invalid_credential",
          traceId: "trace-test",
        }),
      ),
    ).toMatchObject({
      _tag: "ConnectionBlockedError",
      reason: "authentication",
      traceId: "trace-test",
    }));
  it("classifies timeout and transport errors", () => {
    expect(
      mapRemoteEnvironmentError(new RemoteEnvironmentAuthTimeoutError("http://localhost", 1000)),
    ).toMatchObject({ _tag: "ConnectionTransientError", reason: "timeout" });
    expect(
      mapRemoteEnvironmentError(
        new RemoteEnvironmentAuthFetchError({
          message: "Fetch failed",
          cause: new Error("socket closed"),
        }),
      ),
    ).toMatchObject({ _tag: "ConnectionTransientError", reason: "network" });
  });
});
