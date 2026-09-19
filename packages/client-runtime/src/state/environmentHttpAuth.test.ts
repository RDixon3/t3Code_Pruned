import { describe, expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type AuthSessionState,
  type OrchestrationShellSnapshot,
  type OrchestrationThreadDetailSnapshot,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import type { HttpClient } from "effect/unstable/http";
import {
  PrimaryConnectionTarget,
  type PreparedConnection,
  type PreparedHttpAuthorization,
} from "../connection/model.ts";
import { remoteHttpClientLayer, type RemoteEnvironmentRequestError } from "../rpc/http.ts";
import {
  fetchEnvironmentPullRequestDiff,
  type PullRequestDiffCredentialRejectedError,
} from "./pullRequestDiffHttp.ts";
import { fetchEnvironmentSessionState } from "./session.ts";
import { fetchEnvironmentShellSnapshot } from "./shellSnapshotHttp.ts";
import { fetchEnvironmentThreadSnapshot } from "./threadSnapshotHttp.ts";
const TARGET = new PrimaryConnectionTarget({
  environmentId: EnvironmentId.make("local"),
  label: "Local",
  httpBaseUrl: "http://localhost:3201",
  wsBaseUrl: "ws://localhost:3201",
});
const PREPARED: PreparedConnection = {
  environmentId: TARGET.environmentId,
  label: TARGET.label,
  httpBaseUrl: TARGET.httpBaseUrl,
  socketUrl: TARGET.wsBaseUrl + "/ws",
  httpAuthorization: null,
  target: TARGET,
};
const DIFF = {
  projectId: ProjectId.make("project-1"),
  repository: "owner/repository",
  number: 42,
};
const DIFF_RESULT = { patch: "diff --git a/file.ts b/file.ts", truncated: false, nextCursor: null };
const AUTH = {
  policy: "loopback-browser",
  bootstrapMethods: ["one-time-token"],
  sessionMethods: ["bearer-access-token"],
  sessionCookieName: "t3_session",
} satisfies AuthSessionState["auth"];
const SESSION = {
  authenticated: true,
  auth: AUTH,
  scopes: ["orchestration:read", "orchestration:operate"],
  sessionMethod: "bearer-access-token",
} satisfies AuthSessionState;
const UNAUTHENTICATED_SESSION = { authenticated: false, auth: AUTH } satisfies AuthSessionState;
const SHELL = {
  snapshotSequence: 1,
  projects: [],
  threads: [],
  updatedAt: "2026-09-04T00:00:00.000Z",
} satisfies OrchestrationShellSnapshot;
const THREAD = {
  snapshotSequence: 2,
  thread: {
    id: ThreadId.make("thread-1"),
    projectId: ProjectId.make("project-1"),
    title: "Thread",
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    deletedAt: null,
    messages: [],
    proposedPlans: [],
    activities: [],
    checkpoints: [],
    session: null,
  },
  page: { beforeCursor: null, hasMore: false, snapshotSequence: 2 },
} satisfies OrchestrationThreadDetailSnapshot;

type HttpInput = { prepared: PreparedConnection; timeoutMs?: number };
const LOADERS: ReadonlyArray<{
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly response: unknown;
  readonly load: (
    input: HttpInput,
  ) => Effect.Effect<
    unknown,
    RemoteEnvironmentRequestError | PullRequestDiffCredentialRejectedError,
    HttpClient.HttpClient
  >;
}> = [
  {
    name: "PR diff",
    method: "POST",
    path: "/api/pull-requests/diff",
    response: DIFF_RESULT,
    load: (input: HttpInput) => fetchEnvironmentPullRequestDiff({ ...input, diff: DIFF }),
  },
  {
    name: "session permissions",
    method: "GET",
    path: "/api/auth/session",
    response: SESSION,
    load: fetchEnvironmentSessionState,
  },
  {
    name: "shell snapshot",
    method: "GET",
    path: "/api/orchestration/shell",
    response: SHELL,
    load: fetchEnvironmentShellSnapshot,
  },
  {
    name: "older thread history",
    method: "GET",
    path: "/api/orchestration/threads/thread-1",
    response: THREAD,
    load: (input: HttpInput) =>
      fetchEnvironmentThreadSnapshot({
        ...input,
        threadId: THREAD.thread.id,
        window: { turnLimit: 20, beforeCursor: "older-page" },
      }),
  },
];

describe("local authenticated HTTP requests", () => {
  it.effect.each(LOADERS)("retains cookie and bearer auth for $name", (loader) =>
    Effect.gen(function* () {
      for (const authorization of [
        null,
        { _tag: "Bearer", token: "local-bearer" },
      ] satisfies Array<PreparedHttpAuthorization | null>) {
        const calls: Array<RequestInit> = [];
        const fetchFn: typeof fetch = (_url, init) => {
          calls.push(init ?? {});
          return Promise.resolve(Response.json(loader.response));
        };
        const result = yield* loader
          .load({ prepared: { ...PREPARED, httpAuthorization: authorization } })
          .pipe(Effect.provide(remoteHttpClientLayer(fetchFn)));
        expect(result).toEqual(loader.response);
        expect(calls).toHaveLength(1);
        expect(new Headers(calls[0]!.headers).get("authorization")).toBe(
          authorization === null ? null : "Bearer local-bearer",
        );
        expect(calls[0]!.credentials).toBe(authorization === null ? "include" : undefined);
      }
    }),
  );
  it.effect("preserves unauthenticated session state without retrying", () =>
    Effect.gen(function* () {
      let calls = 0;
      const fetchFn: typeof fetch = () => {
        calls++;
        return Promise.resolve(Response.json(UNAUTHENTICATED_SESSION));
      };
      const result = yield* fetchEnvironmentSessionState({ prepared: PREPARED }).pipe(
        Effect.provide(remoteHttpClientLayer(fetchFn)),
      );
      expect(result).toEqual(UNAUTHENTICATED_SESSION);
      expect(calls).toBe(1);
    }),
  );
  it.effect("rejects old relay credentials without a request", () =>
    Effect.gen(function* () {
      let calls = 0;
      const fetchFn: typeof fetch = () => {
        calls++;
        return Promise.reject(new Error("unexpected fetch"));
      };
      const error = yield* fetchEnvironmentSessionState({
        prepared: {
          ...PREPARED,
          httpAuthorization: { _tag: "Dpop", accessToken: "old", expiresAtEpochMs: 0 },
        },
      }).pipe(Effect.provide(remoteHttpClientLayer(fetchFn)), Effect.flip);
      expect(error._tag).toBe("RemoteEnvironmentAuthFetchError");
      expect(calls).toBe(0);
    }),
  );
});
