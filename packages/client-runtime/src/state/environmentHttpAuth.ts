import * as Effect from "effect/Effect";
import { FetchHttpClient, type HttpClient, type HttpMethod } from "effect/unstable/http";
import type { PreparedConnection } from "../connection/model.ts";
import {
  executeEnvironmentHttpRequest,
  makeEnvironmentHttpApiClient,
  RemoteEnvironmentAuthFetchError,
  type RemoteEnvironmentRequestError,
} from "../rpc/http.ts";

export interface EnvironmentHttpAuthHeaders {
  readonly authorization?: string;
}

/** Local browser sessions use cookies; desktop secondary environments use bearer tokens. */
export const executeAuthenticatedEnvironmentHttpRequest = Effect.fn(
  "clientRuntime.state.executeAuthenticatedEnvironmentHttpRequest",
)(function* <A, E, R>(input: {
  readonly prepared: PreparedConnection;
  readonly method: HttpMethod.HttpMethod;
  readonly url: (httpBaseUrl: string) => string;
  readonly timeoutMs: number;
  readonly request: (input: {
    readonly client: Effect.Success<ReturnType<typeof makeEnvironmentHttpApiClient>>;
    readonly headers: EnvironmentHttpAuthHeaders;
  }) => Effect.Effect<A, E, R>;
}): Effect.fn.Return<A, RemoteEnvironmentRequestError, HttpClient.HttpClient | R> {
  const authorization = input.prepared.httpAuthorization;
  if (authorization?._tag === "Dpop") {
    return yield* new RemoteEnvironmentAuthFetchError({
      message: "Remote environments are not supported.",
      cause: "unsupported",
    });
  }
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const headers = authorization === null ? {} : { authorization: `Bearer ${authorization.token}` };
  const request = input.request({ client, headers });
  return yield* executeEnvironmentHttpRequest(
    input.url(input.prepared.httpBaseUrl),
    input.timeoutMs,
    authorization === null
      ? request.pipe(Effect.provideService(FetchHttpClient.RequestInit, { credentials: "include" }))
      : request,
  );
});
