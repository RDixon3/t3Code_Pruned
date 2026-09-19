import { assert, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import type {
  OrchestrationProjectShell,
  ProjectId,
  PullRequestReviewCapabilities,
  PullRequestReviewerCapabilities,
  SourceControlProviderKind,
} from "@t3tools/contracts";

import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as SourceControlProviderRegistry from "../sourceControl/SourceControlProviderRegistry.ts";
import * as SourceControlRateLimit from "../sourceControl/SourceControlRateLimit.ts";
import {
  PullRequestProviderError,
  type ProviderChangeRequest,
  type PullRequestProviderApi,
} from "./PullRequestProvider.ts";
import { PullRequestProviderRegistry, fromProviders } from "./PullRequestProviderRegistry.ts";
import * as PullRequestService from "./PullRequestService.ts";

function project(input: {
  readonly id: string;
  readonly title: string;
  readonly workspaceRoot: string;
  readonly repository?: string;
  readonly provider?: string;
  readonly host?: string;
}): OrchestrationProjectShell {
  // The host defaults from the provider, so a fixture only names one when the point of the
  // test is two hosts of the same kind.
  const host = input.host ?? (input.provider === "gitlab" ? "gitlab.com" : "github.com");
  return {
    id: input.id as ProjectId,
    title: input.title,
    workspaceRoot: input.workspaceRoot,
    ...(input.repository
      ? {
          repositoryIdentity: {
            canonicalKey: `${host}/${input.repository}`,
            locator: {
              source: "git-remote" as const,
              remoteName: "origin",
              remoteUrl: `https://${host}/${input.repository}.git`,
            },
            provider: input.provider ?? "github",
            displayName: input.repository,
          },
        }
      : {}),
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

function changeRequest(number: number, updatedAt: string): ProviderChangeRequest {
  return {
    number,
    title: `Change request ${number}`,
    url: `https://host/pull/${number}`,
    author: { login: "octocat", name: null, avatarUrl: null },
    headBranch: `feat/${number}`,
    baseBranch: "main",
    state: "open",
    isDraft: false,
    mergeability: "mergeable",
    additions: 1,
    deletions: 0,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt,
    reviewRequestLogins: [],
    labels: [],
  };
}

function hostedChangeRequest(body: string, additions = 1) {
  return {
    ...changeRequest(1, "2026-07-02T00:00:00Z"),
    body,
    additions,
    changedFiles: 2,
    mergedAt: null,
    closedAt: null,
    reviewers: [],
    checks: [],
    mergeCapabilities: { merge: true, squash: true, rebase: true },
    viewerPermissions: {
      actions: ["merge"] as const,
      comment: true,
      resolve: true,
      verdicts: ["comment", "approve", "request-changes"] as const,
      requestReviewers: true,
    },
  };
}

function unusable(provider: SourceControlProviderKind, reason: "missing-tool" | "unauthenticated") {
  return new PullRequestProviderError({
    provider,
    operation: "getViewer",
    reason,
    detail: `${provider} is not usable.`,
  });
}

/** Everything a host could offer, so a fixture only narrows what its own test is about. */
const FULL_REVIEW: PullRequestReviewCapabilities = {
  inlineComment: true,
  reply: true,
  resolve: true,
  verdicts: ["comment", "approve", "request-changes"],
};

const FULL_REVIEWERS: PullRequestReviewerCapabilities = { request: true, listCandidates: true };

/** A provider whose every call is supplied by the test; anything unset succeeds emptily. */
function fakeProvider(
  kind: SourceControlProviderKind,
  overrides: Partial<PullRequestProviderApi> = {},
): PullRequestProviderApi {
  return {
    kind,
    capabilities: {
      diff: true,
      comment: true,
      actions: ["merge", "ready", "draft", "close", "reopen"],
      mergeMethods: ["merge"],
      search: true,
      reactions: true,
      review: FULL_REVIEW,
      reviewers: FULL_REVIEWERS,
      edit: { changeRequest: true, comment: true },
    },
    getViewer: () => Effect.succeed("bilal"),
    // A viewer who may do everything the host can, so a test only narrows what it is about.
    getViewerPermissions: () =>
      Effect.succeed({
        actions: ["merge", "ready", "draft", "close", "reopen"],
        comment: true,
        resolve: true,
        verdicts: ["comment", "approve", "request-changes"],
        requestReviewers: true,
      }),
    getChangeRequest: () => Effect.die("unused"),
    getChangeRequestActivity: () => Effect.die("unused"),
    getDiff: () => Effect.die("unused"),
    runAction: () => Effect.void,
    updateChangeRequest: () => Effect.void,
    comment: () => Effect.void,
    updateComment: () => Effect.void,
    submitReview: () => Effect.void,
    replyToThread: () => Effect.void,
    setThreadResolution: () => Effect.void,
    setReaction: () => Effect.void,
    listReviewerCandidates: () => Effect.succeed({ candidates: [], truncated: false }),
    setReviewerRequest: () => Effect.void,
    ...overrides,
  };
}

function makeService(input: {
  readonly projects: ReadonlyArray<OrchestrationProjectShell>;
  readonly providers: ReadonlyArray<PullRequestProviderApi>;
  readonly resolveHandle?: SourceControlProviderRegistry.SourceControlProviderRegistry["Service"]["resolveHandle"];
}) {
  return PullRequestService.make.pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(PullRequestProviderRegistry, fromProviders(input.providers)),
        Layer.mock(SourceControlProviderRegistry.SourceControlProviderRegistry)({
          resolveHandle:
            input.resolveHandle ?? (() => Effect.die("Unexpected provider refinement")),
        }),
        Layer.mock(ProjectionSnapshotQuery.ProjectionSnapshotQuery)({
          getShellSnapshot: () =>
            Effect.succeed({
              snapshotSequence: 1,
              projects: input.projects,
              threads: [],
              updatedAt: "2026-07-01T00:00:00Z",
            }),
        }),
        SourceControlRateLimit.layer,
      ),
    ),
  );
}

it.effect("refines unknown self-hosted GitLab projects before reading a linked summary", () =>
  Effect.gen(function* () {
    let refinementCalls = 0;
    const selfHosted = project({
      id: "p1",
      title: "self-hosted",
      workspaceRoot: "/gitlab",
      repository: "group/project",
      provider: "unknown",
      host: "code.example.test",
    });
    const service = yield* makeService({
      projects: [
        selfHosted,
        { ...selfHosted, id: "p2" as ProjectId, workspaceRoot: "/gitlab-worktree" },
      ],
      providers: [
        fakeProvider("gitlab", {
          getChangeRequest: (input) => {
            assert.strictEqual(input.host, "code.example.test");
            return Effect.succeed(hostedChangeRequest(""));
          },
        }),
      ],
      resolveHandle: ({ context }) => {
        refinementCalls += 1;
        assert.strictEqual(context?.remoteUrl, "https://code.example.test/group/project.git");
        return Effect.succeed({
          context: { ...context!, provider: { ...context!.provider, kind: "gitlab" } },
          provider: undefined as never,
        });
      },
    });

    const result = yield* service.summary({
      projectId: "p1" as ProjectId,
      repository: "group/project",
      number: 1,
    });

    assert.strictEqual(refinementCalls, 1);
    assert.strictEqual(result.provider, "gitlab");
  }),
);

it.effect("derives a legacy repository host after refining its provider", () =>
  Effect.gen(function* () {
    const current = project({
      id: "p1",
      title: "legacy self-hosted",
      workspaceRoot: "/gitlab",
      repository: "group/project",
      provider: "unknown",
      host: "code.example.test",
    });
    const identity = current.repositoryIdentity!;
    // Persisted identities from before canonicalKey existed are still accepted at runtime.
    const legacy = {
      ...current,
      repositoryIdentity: {
        locator: identity.locator,
        provider: identity.provider,
        displayName: identity.displayName,
      },
    } as unknown as OrchestrationProjectShell;
    const service = yield* makeService({
      projects: [legacy],
      providers: [
        fakeProvider("gitlab", {
          getChangeRequest: (input) => {
            assert.strictEqual(input.host, "gitlab");
            return Effect.succeed(hostedChangeRequest(""));
          },
        }),
      ],
      resolveHandle: ({ context }) =>
        Effect.succeed({
          context: { ...context!, provider: { ...context!.provider, kind: "gitlab" } },
          provider: undefined as never,
        }),
    });

    const result = yield* service.summary({
      projectId: "p1" as ProjectId,
      repository: "group/project",
      number: 1,
    });

    assert.strictEqual(result.provider, "gitlab");
  }),
);

it.effect(
  "resolves a linked request against its owning checkout when projects share a repository",
  () =>
    Effect.gen(function* () {
      const service = yield* makeService({
        projects: [
          project({ id: "p1", title: "main", workspaceRoot: "/main", repository: "acme/web" }),
          project({ id: "p2", title: "effort", workspaceRoot: "/effort", repository: "acme/web" }),
        ],
        providers: [
          fakeProvider("github", {
            getChangeRequestSummary: (input) => {
              assert.strictEqual(input.cwd, "/effort");
              assert.strictEqual(input.repository, "acme/web");
              return Effect.succeed(changeRequest(7, "2026-07-02T00:00:00Z"));
            },
          }),
        ],
      });

      const result = yield* service.summary({
        projectId: "p2" as ProjectId,
        repository: "acme/web",
        number: 7,
      });

      assert.strictEqual(result.projectId, "p2");
      assert.strictEqual(result.number, 7);
    }),
);

it.effect("refuses an action the host never claimed it could run", () =>
  Effect.gen(function* () {
    let ran = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            // Bitbucket's shape: it can merge and close, but cannot reopen.
            actions: ["merge", "close"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          runAction: () => {
            ran = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.runAction({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        action: "reopen",
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.isFalse(ran);
  }),
);

it.effect("publishes a merge for immediate settlement only after host confirmation", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const mergedAt = "2026-09-03T02:00:00.000Z";
      let state: "open" | "merged" = "open";
      let confirmationFails = false;
      const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
      const service = yield* makeService({
        projects: [
          project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" }),
        ],
        providers: [
          fakeProvider("github", {
            getChangeRequestSummary: () =>
              confirmationFails
                ? Effect.fail(
                    new PullRequestProviderError({
                      provider: "github",
                      operation: "getChangeRequestSummary",
                      reason: "failed",
                      detail: "HTTP 504",
                    }),
                  )
                : Effect.succeed({ ...changeRequest(1, mergedAt), state }),
          }),
        ],
      });
      const merges = yield* service.subscribeMerges;
      const observedMerge = yield* Stream.runHead(merges).pipe(
        Effect.forkChild({ startImmediately: true }),
      );

      // Queueing succeeds while the host still reports an open PR.
      yield* service.runAction({ ...reference, action: "merge" });
      confirmationFails = true;
      yield* service.runAction({ ...reference, action: "merge" });
      confirmationFails = false;
      state = "merged";
      yield* TestClock.setTime(Date.parse(mergedAt));
      yield* service.runAction({
        ...reference,
        repository: " ACME/WEB ",
        action: "merge",
        mergeMethod: "merge",
      });

      assert.deepStrictEqual(Option.getOrThrow(yield* Fiber.join(observedMerge)), {
        ...reference,
        mergedAt,
      });
    }),
  ),
);

it.effect("refuses an action this viewer may not take, and says what access it takes", () =>
  Effect.gen(function* () {
    let ran: string | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          // The host merges; this account only reads it, and opened the change request — which
          // is every contributor to a repository they do not own.
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["ready", "draft", "close", "reopen"],
              comment: true,
              resolve: true,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: false,
            }),
          runAction: (input) => {
            ran = input.action;
            return Effect.void;
          },
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };

    const error = yield* Effect.flip(service.runAction({ ...reference, action: "merge" }));
    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "You need write access on this repository to merge.");
    assert.strictEqual(ran, null);

    // What the author keeps whatever their access is still theirs to take.
    yield* service.runAction({ ...reference, action: "close" });
    assert.strictEqual(ran, "close");
  }),
);

it.effect("gates arming a merge for later exactly as it gates merging now", () =>
  Effect.gen(function* () {
    let ranWith: { readonly action: string; readonly mergeMethod?: string } | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge", "close", "enable-auto-merge", "disable-auto-merge"],
            mergeMethods: ["merge", "squash"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          // This account may close the change request it opened, and nothing else here.
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["close"],
              comment: true,
              resolve: true,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: false,
            }),
          runAction: (input) => {
            ranWith = {
              action: input.action,
              ...(input.mergeMethod === undefined ? {} : { mergeMethod: input.mergeMethod }),
            };
            return Effect.void;
          },
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };

    const refused = yield* Effect.flip(
      service.runAction({ ...reference, action: "enable-auto-merge", mergeMethod: "squash" }),
    );
    assert.strictEqual(refused._tag, "PullRequestOperationError");
    assert.include(refused.message, "merged for you once it is ready");
    assert.strictEqual(ranWith, null);

    // The strategy is checked against the host for an armed merge too: a merge it performs
    // later is still a merge, and one it cannot spell must not be passed on.
    const wrongStrategy = yield* Effect.flip(
      service.runAction({ ...reference, action: "enable-auto-merge", mergeMethod: "rebase" }),
    );
    assert.strictEqual(wrongStrategy._tag, "PullRequestOperationError");
    assert.strictEqual(ranWith, null);
  }),
);

it.effect("hands the host the strategy an armed merge was asked for", () =>
  Effect.gen(function* () {
    let ranWith: { readonly action: string; readonly mergeMethod?: string } | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge", "enable-auto-merge", "disable-auto-merge"],
            mergeMethods: ["merge", "squash"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["merge", "enable-auto-merge", "disable-auto-merge"],
              comment: true,
              resolve: true,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: true,
            }),
          runAction: (input) => {
            ranWith = {
              action: input.action,
              ...(input.mergeMethod === undefined ? {} : { mergeMethod: input.mergeMethod }),
            };
            return Effect.void;
          },
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };

    yield* service.runAction({ ...reference, action: "enable-auto-merge", mergeMethod: "squash" });
    assert.deepStrictEqual(ranWith, { action: "enable-auto-merge", mergeMethod: "squash" });

    yield* service.runAction({ ...reference, action: "disable-auto-merge" });
    assert.deepStrictEqual(ranWith, { action: "disable-auto-merge" });
  }),
);

it.effect("refuses an auto-merge the host never claimed, without asking it", () =>
  Effect.gen(function* () {
    let ran = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        // Bitbucket's shape: it merges, and has nothing that merges later on its own.
        fakeProvider("github", {
          runAction: () => {
            ran = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.runAction({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        action: "enable-auto-merge",
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.isFalse(ran);
  }),
);

it.effect("refuses to resolve a conversation this viewer may not, without asking the host", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["merge", "ready", "draft", "close", "reopen"],
              comment: true,
              resolve: false,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: true,
            }),
          setThreadResolution: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.setThreadResolution({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        threadId: "t1",
        resolved: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "to resolve a review conversation.");
  }),
);

it.effect("asks nobody what the viewer may do when the host cannot do it at all", () =>
  Effect.gen(function* () {
    let asked = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge", "close"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getViewerPermissions: () => {
            asked = true;
            return Effect.die("must not be called");
          },
        }),
      ],
    });

    yield* Effect.flip(
      service.runAction({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        action: "reopen",
      }),
    );

    // The capability check costs nothing; the permission read is a request, so it comes second.
    assert.isFalse(asked);
  }),
);

it.effect("refuses a comment on a host that cannot post one", () =>
  Effect.gen(function* () {
    let posted = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: false,
            comment: false,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          comment: () => {
            posted = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.comment({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        body: "Looks good.",
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.isFalse(posted);
  }),
);

it.effect("stops new reads after a rate limit while leaving manual actions available", () =>
  Effect.gen(function* () {
    let summaryCalls = 0;
    let actionCalls = 0;
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "cloud", workspaceRoot: "/cloud", repository: "acme/web" }),
      ],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () =>
            Effect.sync(() => {
              summaryCalls += 1;
            }).pipe(
              Effect.andThen(
                Effect.fail(
                  new PullRequestProviderError({
                    provider: "github",
                    operation: "getChangeRequestSummary",
                    reason: "rate-limited",
                    detail: "GitHub API rate limit exceeded.",
                  }),
                ),
              ),
            ),
          runAction: () =>
            Effect.sync(() => {
              actionCalls += 1;
            }),
        }),
      ],
    });

    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const first = yield* Effect.flip(service.summary(reference));
    const paused = yield* Effect.flip(service.summary({ ...reference, number: 2 }));
    yield* service.runAction({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 1,
      action: "close",
    });

    assert.strictEqual(summaryCalls, 1);
    assert.strictEqual(actionCalls, 1);
    assert.strictEqual(first._tag, "PullRequestOperationError");
    assert.strictEqual(paused._tag, "PullRequestOperationError");
  }),
);

it.effect("uses a manual rate limit to pause later reads", () =>
  Effect.gen(function* () {
    let summaryCalls = 0;
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "cloud", workspaceRoot: "/cloud", repository: "acme/web" }),
      ],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () =>
            Effect.sync(() => {
              summaryCalls += 1;
              return changeRequest(1, "2026-07-02T00:00:00Z");
            }),
          runAction: () =>
            Effect.fail(
              new PullRequestProviderError({
                provider: "github",
                operation: "runAction",
                reason: "rate-limited",
                detail: "GitHub API rate limit exceeded.",
              }),
            ),
        }),
      ],
    });

    yield* Effect.flip(
      service.runAction({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        action: "close",
      }),
    );
    const error = yield* Effect.flip(
      service.summary({ projectId: "p1" as ProjectId, repository: "acme/web", number: 1 }),
    );

    assert.strictEqual(summaryCalls, 0);
    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses a repository that does not belong to the requested project", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [fakeProvider("github")],
    });

    const error = yield* service
      .diff({ projectId: "p1" as ProjectId, repository: "attacker/repo", number: 1 })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses a diff on a host that cannot produce one", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({
          id: "p1",
          title: "on azure",
          workspaceRoot: "/a",
          repository: "org/project",
          provider: "azure-devops",
        }),
      ],
      providers: [
        fakeProvider("azure-devops", {
          capabilities: {
            diff: false,
            comment: true,
            actions: ["merge", "close"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getDiff: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* service
      .diff({ projectId: "p1" as ProjectId, repository: "org/project", number: 1 })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("rejects an empty comment before reaching the host", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [fakeProvider("github", { comment: () => Effect.die("must not be called") })],
    });

    const error = yield* service
      .comment({
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
        body: "   ",
      })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses a verdict the host never claimed, without asking the provider", () =>
  Effect.gen(function* () {
    let submitted = false;
    const service = yield* makeService({
      projects: [
        project({
          id: "p1",
          title: "on gitlab",
          workspaceRoot: "/a",
          repository: "group/project",
          provider: "gitlab",
        }),
      ],
      providers: [
        fakeProvider("gitlab", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            // GitLab's shape: it approves, and has nothing that rejects.
            review: {
              inlineComment: true,
              reply: true,
              resolve: true,
              verdicts: ["comment", "approve"],
            },
            reviewers: FULL_REVIEWERS,
          },
          submitReview: () => {
            submitted = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.submitReview({
        projectId: "p1" as ProjectId,
        repository: "group/project",
        number: 1,
        verdict: "request-changes",
        body: "no",
        comments: [],
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.isFalse(submitted);
  }),
);

it.effect("refuses line comments on a host that takes only a summary", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: { inlineComment: false, reply: false, resolve: false, verdicts: ["comment"] },
            reviewers: FULL_REVIEWERS,
          },
          submitReview: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.submitReview({
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
        verdict: "comment",
        body: "",
        comments: [{ path: "src/a.ts", position: { kind: "added", newLine: 1 }, body: "nit" }],
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect(
  "refuses a review with neither a summary nor a comment, but lets an approval through",
  () =>
    Effect.gen(function* () {
      let approved = false;
      const service = yield* makeService({
        projects: [
          project({
            id: "p1",
            title: "t3code",
            workspaceRoot: "/a",
            repository: "pingdotgg/t3code",
          }),
        ],
        providers: [
          fakeProvider("github", {
            submitReview: () => {
              approved = true;
              return Effect.void;
            },
          }),
        ],
      });
      const reference = {
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
      };

      const error = yield* Effect.flip(
        service.submitReview({ ...reference, verdict: "comment", body: "   ", comments: [] }),
      );
      assert.strictEqual(error._tag, "PullRequestOperationError");

      // An approval is a verdict in itself, so it needs no words.
      yield* service.submitReview({ ...reference, verdict: "approve", body: "", comments: [] });
      assert.isTrue(approved);
    }),
);

it.effect("refuses to resolve a conversation on a host that cannot", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: { inlineComment: true, reply: false, resolve: false, verdicts: ["comment"] },
            reviewers: FULL_REVIEWERS,
          },
          setThreadResolution: () => Effect.die("must not be called"),
          replyToThread: () => Effect.die("must not be called"),
        }),
      ],
    });
    const reference = {
      projectId: "p1" as ProjectId,
      repository: "pingdotgg/t3code",
      number: 1,
    };

    const resolveError = yield* Effect.flip(
      service.setThreadResolution({ ...reference, threadId: "t1", resolved: true }),
    );
    const replyError = yield* Effect.flip(
      service.replyToThread({ ...reference, threadId: "t1", body: "hi" }),
    );

    assert.strictEqual(resolveError._tag, "PullRequestOperationError");
    assert.strictEqual(replyError._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses to react on a host with no reactions", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: false,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          setReaction: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.setReaction({
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
        content: "heart",
        reacted: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses to react on a host whose capabilities omit reactions entirely", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          setReaction: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.setReaction({
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
        content: "heart",
        reacted: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("passes a reaction through with its subject id on a host that has them", () =>
  Effect.gen(function* () {
    let received: {
      readonly subjectId: string | undefined;
      readonly content: string;
      readonly reacted: boolean;
    } | null = null;
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          setReaction: (input) => {
            received = {
              subjectId: input.subjectId,
              content: input.content,
              reacted: input.reacted,
            };
            return Effect.void;
          },
        }),
      ],
    });

    yield* service.setReaction({
      projectId: "p1" as ProjectId,
      repository: "pingdotgg/t3code",
      number: 1,
      subjectId: "IC_1",
      content: "heart",
      reacted: true,
    });

    assert.deepStrictEqual(received, { subjectId: "IC_1", content: "heart", reacted: true });
  }),
);

it.effect("invalidates the cached activity after reacting, like the other mutations", () =>
  Effect.gen(function* () {
    let activityCalls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequestActivity: () => {
            activityCalls += 1;
            return Effect.succeed({
              comments: [],
              commentCount: 0,
              commentsTruncated: false,
              reviewThreads: [],
              commits: [],
            });
          },
        }),
      ],
    });

    yield* service.activity(reference);
    assert.strictEqual(activityCalls, 1);

    yield* service.setReaction({ ...reference, content: "heart", reacted: true });
    yield* service.activity(reference);

    assert.strictEqual(activityCalls, 2);
  }),
);

it.effect("refuses an empty reply before it reaches the host", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", { replyToThread: () => Effect.die("must not be called") }),
      ],
    });

    const error = yield* Effect.flip(
      service.replyToThread({
        projectId: "p1" as ProjectId,
        repository: "pingdotgg/t3code",
        number: 1,
        threadId: "t1",
        body: "   ",
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
  }),
);

it.effect("refuses a merge strategy the host does not offer", () =>
  Effect.gen(function* () {
    let ranWith: string | null = null;
    const service = yield* makeService({
      projects: [
        project({ id: "p1", title: "t3code", workspaceRoot: "/a", repository: "pingdotgg/t3code" }),
      ],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            // Azure DevOps's shape: it squashes as a completion option and has no rebase.
            mergeMethods: ["merge", "squash"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getChangeRequestSummary: () => Effect.succeed(changeRequest(1, "2026-07-02T00:00:00Z")),
          runAction: (input) => {
            ranWith = input.mergeMethod ?? "merge";
            return Effect.void;
          },
        }),
      ],
    });
    const reference = {
      projectId: "p1" as ProjectId,
      repository: "pingdotgg/t3code",
      number: 1,
    };

    // Every provider maps an unrecognised strategy to its own default, so letting this through
    // would merge with the wrong one rather than fail.
    const error = yield* Effect.flip(
      service.runAction({ ...reference, action: "merge", mergeMethod: "rebase" }),
    );
    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.strictEqual(ranWith, null);

    yield* service.runAction({ ...reference, action: "merge", mergeMethod: "squash" });
    assert.strictEqual(ranWith, "squash");
  }),
);

it.effect("refuses to ask for a review on a host that cannot, before any call is made", () =>
  Effect.gen(function* () {
    let asked = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: { request: false, listCandidates: false },
          },
          getViewerPermissions: () => {
            asked = true;
            return Effect.die("must not be called");
          },
          setReviewerRequest: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.requestReviewers({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        reviewers: [{ id: "octocat", kind: "user" }],
        requested: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "cannot ask somebody for a review.");
    assert.isFalse(asked);
  }),
);

it.effect("refuses the candidate list on a host that has no such list to give", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: false,
            comment: false,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: false,
            reactions: true,
            review: FULL_REVIEW,
            // Azure's shape: it takes a reviewer, and names nobody who could be one.
            reviewers: { request: true, listCandidates: false },
          },
          listReviewerCandidates: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.reviewerCandidates({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "cannot say who may review a change request.");
  }),
);

it.effect("refuses a review request this viewer may not make, and says what access it takes", () =>
  Effect.gen(function* () {
    let sent = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          // The host asks for reviews; this account only reads the repository.
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["ready", "draft", "close", "reopen"],
              comment: true,
              resolve: true,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: false,
            }),
          setReviewerRequest: () => {
            sent = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.requestReviewers({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        reviewers: [{ id: "octocat", kind: "user" }],
        requested: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "You need write access on this repository to ask for a review.");
    assert.isFalse(sent);
  }),
);

it.effect("keeps the menu from a viewer who may not ask, which is all it is for", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getViewerPermissions: () =>
            Effect.succeed({
              actions: [],
              comment: true,
              resolve: false,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: false,
            }),
          listReviewerCandidates: () => Effect.die("must not be called"),
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.reviewerCandidates({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
      }),
    );

    assert.include(error.message, "You need write access on this repository to ask for a review.");
  }),
);

it.effect("hands the host's own candidate list back, and asks for it with the change request", () =>
  Effect.gen(function* () {
    let askedFor: number | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          listReviewerCandidates: (input) => {
            askedFor = input.number;
            return Effect.succeed({
              candidates: [
                {
                  id: "octocat",
                  kind: "user",
                  login: "octocat",
                  name: null,
                  avatarUrl: null,
                  isRequested: true,
                },
              ],
              truncated: false,
              continues: true,
            });
          },
        }),
      ],
    });

    const list = yield* service.reviewerCandidates({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 4,
    });

    assert.strictEqual(askedFor, 4);
    assert.deepStrictEqual(
      list.candidates.map((candidate) => candidate.login),
      ["octocat"],
    );
  }),
);

it.effect("refuses a label change on a host that has not said it takes one", () =>
  Effect.gen(function* () {
    let changed = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          // The method is there; the capability that would let it be called is not.
          setLabels: () => {
            changed = true;
            return Effect.void;
          },
        }),
      ],
    });

    const error = yield* Effect.flip(
      service.setLabels({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        labels: ["bug"],
        applied: true,
      }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "cannot change the labels");
    assert.isFalse(changed);
  }),
);

it.effect("refuses a label change this viewer may not make, and says what access it takes", () =>
  Effect.gen(function* () {
    let changed = false;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: { ...fakeProvider("github").capabilities, labels: true },
          getViewerPermissions: () =>
            Effect.succeed({
              actions: [],
              comment: true,
              resolve: false,
              verdicts: ["comment", "approve", "request-changes"],
              requestReviewers: false,
              labels: false,
            }),
          listLabelCandidates: () => Effect.die("must not be called"),
          setLabels: () => {
            changed = true;
            return Effect.void;
          },
        }),
      ],
    });

    const listError = yield* Effect.flip(
      service.labelCandidates({ projectId: "p1" as ProjectId, repository: "acme/web", number: 1 }),
    );
    assert.include(listError.message, "You need triage access on this repository");

    const error = yield* Effect.flip(
      service.setLabels({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        labels: ["bug"],
        applied: true,
      }),
    );
    assert.include(error.message, "You need triage access on this repository");
    assert.isFalse(changed);
  }),
);

it.effect("hands a label change to the host, and reads the labels back for the menu", () =>
  Effect.gen(function* () {
    let received: { labels: ReadonlyArray<string>; applied: boolean } | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: { ...fakeProvider("github").capabilities, labels: true },
          listLabelCandidates: () =>
            Effect.succeed({
              candidates: [{ name: "bug", color: null, description: null, isApplied: false }],
              truncated: false,
            }),
          setLabels: (input) => {
            received = { labels: input.labels, applied: input.applied };
            return Effect.void;
          },
        }),
      ],
    });

    const list = yield* service.labelCandidates({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 4,
    });
    assert.deepStrictEqual(
      list.candidates.map((label) => label.name),
      ["bug"],
    );

    yield* service.setLabels({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 4,
      labels: ["bug"],
      applied: false,
    });
    assert.deepStrictEqual(received, { labels: ["bug"], applied: false });
  }),
);

it.effect("reference and turn invalidations refresh linked summaries and notify readers", () =>
  Effect.gen(function* () {
    let hostCalls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () => {
            hostCalls += 1;
            return Effect.succeed(changeRequest(1, "2026-07-02T00:00:00Z"));
          },
        }),
      ],
    });

    yield* service.summary(reference);
    yield* service.invalidate({ reference });
    yield* service.summary(reference);
    assert.strictEqual(hostCalls, 2);

    // A repeated display read remains cached until the next turn.
    yield* service.summary(reference);
    assert.strictEqual(hostCalls, 2);
    yield* service.refreshAfterTurn;
    const refresh = Option.getOrThrow(yield* Stream.runHead(service.subscribeRefreshes));
    yield* service.summary(reference);
    assert.isAbove(refresh, 0);
    assert.strictEqual(hostCalls, 3);
  }),
);

it.effect("a mutation makes the next linked summary ask the host again", () =>
  Effect.gen(function* () {
    let hostCalls = 0;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () => {
            hostCalls += 1;
            return Effect.succeed(changeRequest(1, "2026-07-02T00:00:00Z"));
          },
        }),
      ],
    });

    yield* service.summary({ projectId: "p1" as ProjectId, repository: "acme/web", number: 1 });
    yield* service.runAction({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 1,
      action: "close",
    });
    yield* service.summary({ projectId: "p1" as ProjectId, repository: "acme/web", number: 1 });
    assert.strictEqual(hostCalls, 2);
  }),
);

it.effect("reads the fresh diff when detail or summary discovers a changed revision", () =>
  Effect.gen(function* () {
    const summaryStarted = yield* Deferred.make<void>();
    const releaseSummary = yield* Deferred.make<void>();
    let revision = "2026-07-02T00:00:00Z";
    let patch = "old patch";
    let diffCalls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () =>
            Effect.sync(() => ({ ...hostedChangeRequest("body"), updatedAt: revision })),
          getChangeRequestSummary: () =>
            Effect.gen(function* () {
              const result = changeRequest(1, revision);
              yield* Deferred.succeed(summaryStarted, undefined);
              yield* Deferred.await(releaseSummary);
              return result;
            }),
          getDiff: () =>
            Effect.sync(() => {
              diffCalls += 1;
              return { patch, truncated: false, nextCursor: null };
            }),
        }),
      ],
    });

    const coldSummary = yield* service.summary(reference).pipe(Effect.forkChild());
    yield* Deferred.await(summaryStarted);
    yield* service.detail(reference);
    assert.strictEqual((yield* service.diff(reference)).patch, "old patch");
    revision = "2026-07-02T00:01:00Z";
    patch = "new patch";
    yield* TestClock.adjust("16 seconds");
    yield* service.detail(reference);
    yield* Effect.yieldNow;
    assert.strictEqual((yield* service.detail(reference)).updatedAt, revision);
    yield* Deferred.succeed(releaseSummary, undefined);
    yield* Fiber.join(coldSummary);
    yield* service.summary(reference, { recoverTransientFailure: false });
    assert.strictEqual((yield* service.diff(reference)).patch, "new patch");
    assert.strictEqual(diffCalls, 2);

    revision = "2026-07-02T00:02:00Z";
    patch = "summary-discovered patch";
    yield* TestClock.adjust("61 seconds");
    yield* service.summary(reference, { recoverTransientFailure: false });
    assert.strictEqual((yield* service.diff(reference)).patch, patch);
    assert.strictEqual(diffCalls, 3);
  }),
);

it.effect(
  "serves core detail without waiting for activity, and shares activity between clients",
  () =>
    Effect.gen(function* () {
      let coreCalls = 0;
      let activityCalls = 0;
      const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
      const service = yield* makeService({
        projects: [
          project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" }),
        ],
        providers: [
          fakeProvider("github", {
            getChangeRequest: () => {
              coreCalls += 1;
              return Effect.succeed({
                ...changeRequest(1, "2026-07-02T00:00:00Z"),
                body: "Ready before the conversation",
                changedFiles: 2,
                mergedAt: null,
                closedAt: null,
                reviewers: [],
                checks: [],
                mergeCapabilities: { merge: true, squash: true, rebase: true },
                viewerPermissions: {
                  actions: ["merge"],
                  comment: true,
                  resolve: true,
                  verdicts: ["comment", "approve", "request-changes"],
                  requestReviewers: true,
                },
              });
            },
            getChangeRequestActivity: () => {
              activityCalls += 1;
              return Effect.succeed({
                comments: [],
                commentCount: 0,
                commentsTruncated: false,
                reviewThreads: [],
                commits: [],
              });
            },
          }),
        ],
      });

      const core = yield* service.detail(reference);
      assert.strictEqual(core.body, "Ready before the conversation");
      assert.strictEqual(coreCalls, 1);
      assert.strictEqual(activityCalls, 0);

      yield* Effect.all([service.activity(reference), service.activity(reference)], {
        concurrency: 2,
      });
      assert.strictEqual(activityCalls, 1);

      yield* service.invalidate({ reference });
      yield* service.activity(reference);
      assert.strictEqual(activityCalls, 2);
    }),
);

it.effect("shares linked summaries and reuses them for display without asking the host again", () =>
  Effect.gen(function* () {
    let calls = 0;
    let failing = false;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () =>
            Effect.sync(() => {
              calls += 1;
              return failing;
            }).pipe(
              Effect.tap(() => Effect.yieldNow),
              Effect.flatMap((shouldFail) =>
                shouldFail
                  ? Effect.fail(
                      new PullRequestProviderError({
                        provider: "github",
                        operation: "getChangeRequestSummary",
                        reason: "failed",
                        detail: "HTTP 504",
                      }),
                    )
                  : Effect.succeed(changeRequest(1, "2026-07-02T00:00:00Z")),
              ),
            ),
        }),
      ],
    });

    yield* Effect.all(
      [
        service.summary(reference, { recoverTransientFailure: false }),
        service.summary(reference, { recoverTransientFailure: false }),
      ],
      { concurrency: "unbounded" },
    );
    assert.strictEqual(calls, 1);

    yield* TestClock.adjust("61 seconds");
    failing = true;
    const strict = yield* Effect.flip(
      service.summary(reference, { recoverTransientFailure: false }),
    );
    assert.strictEqual(strict._tag, "PullRequestOperationError");

    const stale = yield* service.summary(reference);
    assert.strictEqual(stale.updatedAt, "2026-07-02T00:00:00Z");
    // Display reads keep the last title and state rather than asking the host again.
    assert.strictEqual(calls, 2);

    yield* service.invalidate({ reference });
    const invalidated = yield* Effect.flip(service.summary(reference));
    assert.strictEqual(invalidated._tag, "PullRequestOperationError");
  }),
);

it.effect("answers a known pull request immediately while the host refreshes", () =>
  Effect.gen(function* () {
    const gate = yield* Deferred.make<void>();
    let calls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () =>
            Effect.gen(function* () {
              calls += 1;
              if (calls > 1) yield* Deferred.await(gate);
              return hostedChangeRequest("cached body", 4);
            }),
        }),
      ],
    });

    const first = yield* service.detail(reference);
    assert.strictEqual(first.body, "cached body");
    assert.strictEqual(first.additions, 4);

    yield* TestClock.adjust("16 seconds");
    const second = yield* service.detail(reference);
    assert.strictEqual(second.body, "cached body");
    assert.strictEqual(second.additions, 4);
    yield* Effect.yieldNow;
    assert.strictEqual(calls, 2);
  }),
);

it.effect("does not ask the host again for a linked summary it already holds", () =>
  Effect.gen(function* () {
    let calls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequestSummary: () =>
            Effect.sync(() => {
              calls += 1;
              return changeRequest(1, "2026-07-02T00:00:00Z");
            }),
        }),
      ],
    });

    const first = yield* service.summary(reference);
    assert.strictEqual(first.title, "Change request 1");
    yield* TestClock.adjust("61 seconds");
    const second = yield* service.summary(reference);
    assert.strictEqual(second.title, "Change request 1");
    assert.strictEqual(calls, 1);
  }),
);

it.effect("reuses an observed merged state for strict settlement reads", () =>
  Effect.gen(function* () {
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () =>
            Effect.succeed({
              ...hostedChangeRequest("merged body", 4),
              state: "merged",
              updatedAt: "2026-07-03T00:00:00Z",
            }),
          getChangeRequestSummary: () => Effect.die("strict merged state must not refresh"),
        }),
      ],
    });

    yield* service.detail(reference);

    const summary = yield* service.summary(reference, { recoverTransientFailure: false });
    assert.strictEqual(summary.state, "merged");
    assert.strictEqual(summary.updatedAt, "2026-07-03T00:00:00Z");
  }),
);

it.effect("does not let a stale detail reopen overwrite a fresher linked summary", () =>
  Effect.gen(function* () {
    const gate = yield* Deferred.make<void>();
    let detailCalls = 0;
    let summaryTitle = "old title";
    let summaryState: "open" | "merged" = "open";
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () =>
            Effect.gen(function* () {
              detailCalls += 1;
              if (detailCalls > 1) yield* Deferred.await(gate);
              return hostedChangeRequest("old body", 4);
            }),
          getChangeRequestSummary: () =>
            Effect.succeed({
              ...changeRequest(1, "2026-07-02T00:00:00Z"),
              title: summaryTitle,
              state: summaryState,
            }),
        }),
      ],
    });

    const first = yield* service.detail(reference);
    assert.strictEqual(first.title, "Change request 1");

    summaryTitle = "merged title";
    summaryState = "merged";
    yield* TestClock.adjust("61 seconds");
    const settled = yield* service.summary(reference, { recoverTransientFailure: false });
    assert.strictEqual(settled.title, "merged title");
    assert.strictEqual(settled.state, "merged");

    yield* TestClock.adjust("16 seconds");
    const stale = yield* service.detail(reference);
    assert.strictEqual(stale.title, "Change request 1");
    yield* Effect.yieldNow;

    const display = yield* service.summary(reference);
    assert.strictEqual(display.title, "merged title");
    assert.strictEqual(display.state, "merged");
    assert.strictEqual(detailCalls, 2);
  }),
);

it.effect("does not let a still-cached detail overwrite a fresher linked summary", () =>
  Effect.gen(function* () {
    let summaryTitle = "old title";
    let summaryState: "open" | "merged" = "open";
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () => Effect.succeed(hostedChangeRequest("old body", 4)),
          getChangeRequestSummary: () =>
            Effect.succeed({
              ...changeRequest(1, "2026-07-02T00:00:00Z"),
              title: summaryTitle,
              state: summaryState,
            }),
        }),
      ],
    });

    const first = yield* service.detail(reference);
    assert.strictEqual(first.title, "Change request 1");

    summaryTitle = "merged title";
    summaryState = "merged";
    const settled = yield* service.summary(reference, { recoverTransientFailure: false });
    assert.strictEqual(settled.state, "merged");

    const cached = yield* service.detail(reference);
    assert.strictEqual(cached.title, "Change request 1");
    yield* Effect.yieldNow;

    const display = yield* service.summary(reference);
    assert.strictEqual(display.title, "merged title");
    assert.strictEqual(display.state, "merged");
  }),
);

it.effect("keeps recent detail on a transient refresh failure but not after invalidation", () =>
  Effect.gen(function* () {
    let failing = false;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () =>
            failing
              ? Effect.fail(
                  new PullRequestProviderError({
                    provider: "github",
                    operation: "getChangeRequest",
                    reason: "failed",
                    detail: "spawn gh EAGAIN",
                  }),
                )
              : Effect.succeed({
                  ...changeRequest(1, "2026-07-02T00:00:00Z"),
                  body: "last good body",
                  changedFiles: 2,
                  mergedAt: null,
                  closedAt: null,
                  reviewers: [],
                  checks: [],
                  mergeCapabilities: { merge: true, squash: true, rebase: true },
                  viewerPermissions: {
                    actions: ["merge"],
                    comment: true,
                    resolve: true,
                    verdicts: ["comment", "approve", "request-changes"],
                    requestReviewers: true,
                  },
                }),
        }),
      ],
    });

    yield* service.detail(reference);
    yield* TestClock.adjust("16 seconds");
    failing = true;
    const stale = yield* service.detail(reference);
    assert.strictEqual(stale.body, "last good body");

    yield* service.invalidate({ reference });
    const invalidated = yield* Effect.flip(service.detail(reference));
    assert.strictEqual(invalidated._tag, "PullRequestOperationError");
  }),
);

it.effect("carries an armed auto-merge through to the detail, and silence as silence", () =>
  Effect.gen(function* () {
    const detailWith = (autoMergeEnabled: boolean | undefined) =>
      Effect.gen(function* () {
        const service = yield* makeService({
          projects: [
            project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" }),
          ],
          providers: [
            fakeProvider("github", {
              getChangeRequest: () =>
                Effect.succeed({
                  ...changeRequest(1, "2026-07-02T00:00:00Z"),
                  body: "",
                  changedFiles: 0,
                  mergedAt: null,
                  closedAt: null,
                  reviewers: [],
                  checks: [],
                  mergeCapabilities: { merge: true, squash: true, rebase: true },
                  viewerPermissions: {
                    actions: ["merge"],
                    comment: true,
                    resolve: true,
                    verdicts: ["comment", "approve", "request-changes"],
                    requestReviewers: true,
                  },
                  ...(autoMergeEnabled === undefined ? {} : { autoMergeEnabled }),
                }),
            }),
          ],
        });
        return yield* service.detail({
          projectId: "p1" as ProjectId,
          repository: "acme/web",
          number: 1,
        });
      });

    assert.strictEqual((yield* detailWith(true)).autoMergeEnabled, true);
    assert.strictEqual((yield* detailWith(false)).autoMergeEnabled, false);
    // A host that says nothing leaves the field absent rather than claiming the merge is unarmed.
    assert.isUndefined((yield* detailWith(undefined)).autoMergeEnabled);
  }),
);

it("names an Azure DevOps repository by its own name, not its project path", () => {
  // `az repos pr list --repository` takes a name and detects the organisation and project from
  // the checkout; the recorded `org/project/_git/repo` path is refused, and the repository then
  // reads as unavailable on the page.
  const selector = PullRequestService.repositoryIdentityOf({
    repositoryIdentity: {
      provider: "azure-devops",
      displayName: "contoso/payments/_git/checkout",
      owner: "contoso",
      name: "checkout",
    },
  } as never);
  assert.strictEqual(selector, "checkout");
});

it("falls back to the path's last segment where an Azure identity has no name", () => {
  const selector = PullRequestService.repositoryIdentityOf({
    repositoryIdentity: {
      provider: "azure-devops",
      displayName: "contoso/payments/_git/checkout",
    },
  } as never);
  assert.strictEqual(selector, "checkout");
});

it("keeps a GitLab identity's whole path, because a nested group is part of the name", () => {
  const selector = PullRequestService.repositoryIdentityOf({
    repositoryIdentity: {
      provider: "gitlab",
      displayName: "group/subgroup/service",
      owner: "group",
      name: "service",
    },
  } as never);
  assert.strictEqual(selector, "group/subgroup/service");
});

it.effect("refuses a way of updating a branch that the host or the viewer does not allow", () =>
  Effect.gen(function* () {
    let taken: string | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge", "close", "update-branch"],
            mergeMethods: ["merge"],
            // This host brings a stale branch up to date with a merge commit and nothing else.
            updateMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["close", "update-branch"],
              comment: true,
              resolve: true,
              verdicts: ["comment"],
              requestReviewers: false,
              updateMethods: ["merge"],
            }),
          runAction: (input) => {
            taken = input.updateMethod ?? "default";
            return Effect.void;
          },
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };

    // Asking for a rebase a host does not offer must fail rather than quietly merge instead.
    const error = yield* Effect.flip(
      service.runAction({ ...reference, action: "update-branch", updateMethod: "rebase" }),
    );
    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.strictEqual(taken, null);

    yield* service.runAction({ ...reference, action: "update-branch", updateMethod: "merge" });
    assert.strictEqual(taken, "merge");
  }),
);

it.effect("refuses to merge a target branch into a source branch on a host that only rebases", () =>
  Effect.gen(function* () {
    let taken = 0;
    const service = yield* makeService({
      projects: [
        project({
          id: "p1",
          title: "on gitlab",
          workspaceRoot: "/a",
          repository: "group/project",
          provider: "gitlab",
        }),
      ],
      providers: [
        fakeProvider("gitlab", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge", "close", "update-branch"],
            mergeMethods: ["merge"],
            // What GitLab declares: it replays the branch, and has no update that merges the
            // target back in.
            updateMethods: ["rebase"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          getViewerPermissions: () =>
            Effect.succeed({
              actions: ["close", "update-branch"],
              comment: true,
              resolve: true,
              verdicts: ["comment"],
              requestReviewers: false,
              updateMethods: ["rebase"],
            }),
          runAction: () => {
            taken += 1;
            return Effect.void;
          },
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "group/project", number: 1 };

    // A merge asked of a host that rebases must fail here rather than reach the provider, which
    // would rebase instead and report the wrong thing as done.
    const error = yield* Effect.flip(
      service.runAction({ ...reference, action: "update-branch", updateMethod: "merge" }),
    );
    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.strictEqual(taken, 0);

    yield* service.runAction({ ...reference, action: "update-branch", updateMethod: "rebase" });
    assert.strictEqual(taken, 1);
  }),
);

it.effect("sends only the words a rewrite carries", () =>
  Effect.gen(function* () {
    const received: Array<{ title?: string | undefined; body?: string | undefined }> = [];
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          updateChangeRequest: (input) => {
            received.push({ title: input.title, body: input.body });
            return Effect.void;
          },
        }),
      ],
    });

    yield* service.update({ ...reference, title: "A better title" });
    yield* service.update({ ...reference, body: "" });
    yield* service.update({ ...reference, title: "Both", body: "at once" });

    assert.deepStrictEqual(received, [
      { title: "A better title", body: undefined },
      { title: undefined, body: "" },
      { title: "Both", body: "at once" },
    ]);
  }),
);

it.effect("refuses a rewrite that changes nothing, before any call is made", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", { updateChangeRequest: () => Effect.die("must not be called") }),
      ],
    });

    const error = yield* Effect.flip(
      service.update({ projectId: "p1" as ProjectId, repository: "acme/web", number: 1 }),
    );

    assert.strictEqual(error._tag, "PullRequestOperationError");
    assert.include(error.message, "Nothing was changed.");
  }),
);

it.effect("refuses to rewrite anything on a host that never claimed it", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          capabilities: {
            diff: true,
            comment: true,
            actions: ["merge"],
            mergeMethods: ["merge"],
            search: true,
            reactions: true,
            review: FULL_REVIEW,
            reviewers: FULL_REVIEWERS,
          },
          updateChangeRequest: () => Effect.die("must not be called"),
          updateComment: () => Effect.die("must not be called"),
        }),
      ],
    });
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };

    const rewriteRefused = yield* Effect.flip(service.update({ ...reference, title: "New" }));
    const commentRefused = yield* Effect.flip(
      service.updateComment({
        ...reference,
        commentId: "IC_1",
        kind: "issue-comment",
        body: "New",
      }),
    );

    assert.include(rewriteRefused.message, "cannot rewrite a change request.");
    assert.include(commentRefused.message, "cannot rewrite a comment.");
  }),
);

it.effect("passes a rewritten remark through with the id and kind it arrived under", () =>
  Effect.gen(function* () {
    let received: { id: string; kind: string; body: string } | null = null;
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          updateComment: (input) => {
            received = { id: input.commentId, kind: input.kind, body: input.body };
            return Effect.void;
          },
        }),
      ],
    });

    yield* service.updateComment({
      projectId: "p1" as ProjectId,
      repository: "acme/web",
      number: 1,
      commentId: "PRRC_1",
      kind: "review-comment",
      body: "Second thoughts",
    });

    assert.deepStrictEqual(received, {
      id: "PRRC_1",
      kind: "review-comment",
      body: "Second thoughts",
    });
  }),
);

it.effect("refuses a remark rewritten into nothing but whitespace", () =>
  Effect.gen(function* () {
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", { updateComment: () => Effect.die("must not be called") }),
      ],
    });

    const error = yield* Effect.flip(
      service.updateComment({
        projectId: "p1" as ProjectId,
        repository: "acme/web",
        number: 1,
        commentId: "IC_1",
        kind: "issue-comment",
        body: "   \n  ",
      }),
    );

    assert.include(error.message, "A comment cannot be empty.");
  }),
);

it.effect("forgets the cached detail after a rewrite or terminal turn", () =>
  Effect.gen(function* () {
    let coreCalls = 0;
    const reference = { projectId: "p1" as ProjectId, repository: "acme/web", number: 1 };
    const service = yield* makeService({
      projects: [project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" })],
      providers: [
        fakeProvider("github", {
          getChangeRequest: () => {
            coreCalls += 1;
            return Effect.succeed({
              ...changeRequest(1, "2026-07-02T00:00:00Z"),
              body: "",
              changedFiles: 0,
              mergedAt: null,
              closedAt: null,
              reviewers: [],
              checks: [],
              mergeCapabilities: { merge: true, squash: true, rebase: true },
              viewerPermissions: {
                actions: ["merge"],
                comment: true,
                resolve: true,
                verdicts: ["comment", "approve", "request-changes"],
                requestReviewers: true,
              },
            });
          },
        }),
      ],
    });

    yield* service.detail(reference);
    yield* service.update({ ...reference, title: "Renamed" });
    yield* service.detail(reference);
    assert.strictEqual(coreCalls, 2);

    yield* service.refreshAfterTurn;
    yield* service.detail(reference);
    assert.strictEqual(coreCalls, 3);
  }),
);

it.effect("names the signed-in account in the detail, and says nothing where the host cannot", () =>
  Effect.gen(function* () {
    const detailFrom = (provider: PullRequestProviderApi) =>
      Effect.gen(function* () {
        const service = yield* makeService({
          projects: [
            project({ id: "p1", title: "web", workspaceRoot: "/a", repository: "acme/web" }),
          ],
          providers: [provider],
        });
        return yield* service.detail({
          projectId: "p1" as ProjectId,
          repository: "acme/web",
          number: 1,
        });
      });
    const readable = fakeProvider("github", {
      getChangeRequest: () =>
        Effect.succeed({
          ...changeRequest(1, "2026-07-02T00:00:00Z"),
          body: "",
          changedFiles: 0,
          mergedAt: null,
          closedAt: null,
          reviewers: [],
          checks: [],
          mergeCapabilities: { merge: true, squash: true, rebase: true },
          viewerPermissions: {
            actions: ["merge"],
            comment: true,
            resolve: true,
            verdicts: ["comment", "approve", "request-changes"],
            requestReviewers: true,
          },
        }),
    });

    const named = yield* detailFrom(readable);
    const unnamed = yield* detailFrom({
      ...readable,
      getViewer: () => Effect.fail(unusable("github", "unauthenticated")),
    });

    assert.strictEqual(named.viewer, "bilal");
    assert.strictEqual(unnamed.viewer, undefined);
  }),
);
