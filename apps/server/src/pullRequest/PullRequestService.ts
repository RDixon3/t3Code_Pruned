import * as Cache from "effect/Cache";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import {
  PullRequestOperationError,
  PullRequestUnavailableError,
  pullRequestHostOf,
  type OrchestrationProjectShell,
  type ProjectId,
  type PullRequestAction,
  type PullRequestActionInput,
  type PullRequestActivity,
  type PullRequestCommentInput,
  type PullRequestCommentUpdateInput,
  type PullRequestDetail,
  type PullRequestDiffFileContentsInput,
  type PullRequestDiffFileContentsResult,
  type PullRequestDiffInput,
  type PullRequestDiffResult,
  type PullRequestInvalidateInput,
  type PullRequestReactionInput,
  type PullRequestRef,
  type PullRequestReviewVerdict,
  type PullRequestReviewerCandidateList,
  type PullRequestReviewerRequestInput,
  type PullRequestLabelCandidateList,
  type PullRequestLabelChangeInput,
  type PullRequestSubmitReviewInput,
  type PullRequestSummary,
  type PullRequestThreadReplyInput,
  type PullRequestThreadResolutionInput,
  type PullRequestThreadCommentsInput,
  type PullRequestThreadCommentsResult,
  type PullRequestUpdateInput,
  type SourceControlProviderInfo,
  type SourceControlProviderKind,
} from "@t3tools/contracts";
import { detectSourceControlProviderFromRemoteUrl } from "@t3tools/shared/sourceControl";

import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as SourceControlProviderRegistry from "../sourceControl/SourceControlProviderRegistry.ts";
import * as SourceControlRateLimit from "../sourceControl/SourceControlRateLimit.ts";
import { type PullRequestProviderApi, PullRequestProviderError } from "./PullRequestProvider.ts";
import { PullRequestProviderRegistry } from "./PullRequestProviderRegistry.ts";

export interface PullRequestMergeEvent extends PullRequestRef {
  readonly mergedAt: string;
}
/** Bound independent provider lookups. */
const REPOSITORY_CONCURRENCY = 12;
const SUMMARY_CACHE_TTL = Duration.seconds(60);
const DETAIL_CACHE_TTL = Duration.seconds(15);
const DIFF_CACHE_TTL = Duration.seconds(60);
/** A commit is content-addressed, so its own diff cannot change under its key. */
const COMMIT_DIFF_CACHE_TTL = Duration.minutes(10);
/** A diff can stay interactive while its next cached value is fetched off the critical path. */
const DIFF_STALE_WINDOW = Duration.minutes(10);
/** How long one host's signed-in login is believed without asking its CLI again. */
const VIEWER_CACHE_TTL = Duration.minutes(10);
const STALE_DETAIL_WINDOW = Duration.minutes(10);
const isPullRequestProviderError = Schema.is(PullRequestProviderError);
const DETAIL_CACHE_CAPACITY = 128;
const DIFF_CACHE_CAPACITY = 128;
const VIEWER_CACHE_CAPACITY = 32;

export type PullRequestError = PullRequestUnavailableError | PullRequestOperationError;

export class PullRequestService extends Context.Service<
  PullRequestService,
  {
    readonly summary: (
      input: PullRequestRef,
      options?: { readonly recoverTransientFailure?: boolean },
    ) => Effect.Effect<PullRequestSummary, PullRequestError>;
    readonly subscribeMerges: Effect.Effect<
      Stream.Stream<PullRequestMergeEvent>,
      never,
      Scope.Scope
    >;
    readonly subscribeRefreshes: Stream.Stream<number>;
    readonly refreshAfterTurn: Effect.Effect<void>;
    readonly detail: (input: PullRequestRef) => Effect.Effect<PullRequestDetail, PullRequestError>;
    readonly activity: (
      input: PullRequestRef,
    ) => Effect.Effect<PullRequestActivity, PullRequestError>;
    readonly threadComments: (
      input: PullRequestThreadCommentsInput,
    ) => Effect.Effect<PullRequestThreadCommentsResult, PullRequestError>;
    readonly diff: (
      input: PullRequestDiffInput,
    ) => Effect.Effect<PullRequestDiffResult, PullRequestError>;
    readonly diffFileContents: (
      input: PullRequestDiffFileContentsInput,
    ) => Effect.Effect<PullRequestDiffFileContentsResult, PullRequestError>;
    readonly runAction: (input: PullRequestActionInput) => Effect.Effect<void, PullRequestError>;
    readonly update: (input: PullRequestUpdateInput) => Effect.Effect<void, PullRequestError>;
    readonly comment: (input: PullRequestCommentInput) => Effect.Effect<void, PullRequestError>;
    readonly updateComment: (
      input: PullRequestCommentUpdateInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly submitReview: (
      input: PullRequestSubmitReviewInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly replyToThread: (
      input: PullRequestThreadReplyInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly setThreadResolution: (
      input: PullRequestThreadResolutionInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly setReaction: (
      input: PullRequestReactionInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly reviewerCandidates: (
      input: PullRequestRef,
    ) => Effect.Effect<PullRequestReviewerCandidateList, PullRequestError>;
    readonly requestReviewers: (
      input: PullRequestReviewerRequestInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly labelCandidates: (
      input: PullRequestRef,
    ) => Effect.Effect<PullRequestLabelCandidateList, PullRequestError>;
    readonly setLabels: (
      input: PullRequestLabelChangeInput,
    ) => Effect.Effect<void, PullRequestError>;
    readonly invalidate: (input: PullRequestInvalidateInput) => Effect.Effect<void>;
  }
>()("t3/pullRequest/PullRequestService") {}

/** What a verdict is called when refusing it, so the sentence reads as an action. */
const VERDICT_LABELS: Record<PullRequestReviewVerdict, string> = {
  comment: "review",
  approve: "approve",
  "request-changes": "request changes on",
};

/**
 * Why an action is refused to this viewer, said as the access it would take rather than as the
 * refusal the host would have answered with. Merging is the one that needs write and nothing
 * else; the other four are also the author's to take, whatever access they have.
 */
const ACTION_ACCESS_REFUSALS: Record<PullRequestAction, string> = {
  merge: "You need write access on this repository to merge.",
  ready:
    "You need write access on this repository, or to have opened this change request, to mark it ready for review.",
  draft:
    "You need write access on this repository, or to have opened this change request, to return it to a draft.",
  close:
    "You need write access on this repository, or to have opened this change request, to close it.",
  "update-branch":
    "You need write access on this repository, or to have opened this change request, to update its branch.",
  reopen:
    "You need write access on this repository, or to have opened this change request, to reopen it.",
  "enable-auto-merge":
    "You need write access on this repository to have it merged for you once it is ready.",
  "disable-auto-merge":
    "You need write access on this repository to stop it being merged for you once it is ready.",
  revert: "You need write access on this repository to open a revert pull request.",
  "approve-workflows":
    "You need write access on this repository to approve workflows from a fork pull request.",
};

/**
 * Why asking for a review is refused, and why the menu behind it is too. Write access is what the
 * hosts that state anything about this want; the ones that state nothing grant it, so this
 * sentence is only ever the answer where a host said no.
 */
const REVIEWER_REQUEST_REFUSAL = "You need write access on this repository to ask for a review.";
const LABEL_CHANGE_REFUSAL = "You need triage access on this repository to change its labels.";

/** A project this page can read: its remote is on a host with an implementation. */
interface SupportedProject {
  readonly project: OrchestrationProjectShell;
  readonly api: PullRequestProviderApi;
  readonly repository: string;
  /** The host the repository lives on, which is the account boundary rather than the kind. */
  readonly host: string;
}

/** A host that cannot be read at all, as opposed to one request that failed. */
function isProviderUnusable(error: PullRequestProviderError): boolean {
  return error.reason === "missing-tool" || error.reason === "unauthenticated";
}

function toUnavailableError(error: PullRequestProviderError): PullRequestUnavailableError {
  return new PullRequestUnavailableError({
    reason: error.reason === "missing-tool" ? "cli-missing" : "cli-unauthenticated",
    provider: error.provider,
    cause: error,
  });
}

function toPullRequestError(
  operation: string,
): (error: PullRequestProviderError) => PullRequestError {
  return (error) =>
    isProviderUnusable(error)
      ? toUnavailableError(error)
      : new PullRequestOperationError({ operation, detail: error.detail, cause: error });
}

function withRateLimitBackoff(
  api: PullRequestProviderApi,
  host: string,
  limits: SourceControlRateLimit.SourceControlRateLimit["Service"],
): PullRequestProviderApi {
  const key = { provider: api.kind, host };
  const protect = <A>(
    operation: string,
    effect: Effect.Effect<A, PullRequestProviderError>,
    allowPaused: boolean,
  ) =>
    limits.check(key, allowPaused ? { allowPaused: true } : undefined).pipe(
      Effect.mapError(
        (error) =>
          new PullRequestProviderError({
            provider: api.kind,
            operation,
            reason: "rate-limited",
            detail: error.detail,
            retryAt: error.retryAt,
            cause: error,
          }),
      ),
      Effect.flatMap((lease) =>
        effect.pipe(
          Effect.tap(() => limits.recordSuccess({ ...key, lease })),
          Effect.tapError((error) =>
            error.reason === "rate-limited"
              ? limits.recordRateLimit({
                  ...key,
                  lease,
                  ...(error.retryAt === undefined ? {} : { retryAt: error.retryAt }),
                })
              : Effect.void,
          ),
        ),
      ),
    );
  const wrap =
    <Args extends ReadonlyArray<unknown>, A>(
      operation: string,
      call: (...args: Args) => Effect.Effect<A, PullRequestProviderError>,
      allowPaused = false,
    ) =>
    (...args: Args) =>
      protect(operation, call(...args), allowPaused);
  const interactive = <Args extends ReadonlyArray<unknown>, A>(
    operation: string,
    call: (...args: Args) => Effect.Effect<A, PullRequestProviderError>,
  ) => wrap(operation, call, true);

  return {
    kind: api.kind,
    capabilities: api.capabilities,
    getViewer: wrap("getViewer", api.getViewer),
    getChangeRequest: wrap("getChangeRequest", api.getChangeRequest),
    ...(api.getChangeRequestSummary === undefined
      ? {}
      : {
          getChangeRequestSummary: wrap("getChangeRequestSummary", api.getChangeRequestSummary),
        }),
    getChangeRequestActivity: wrap("getChangeRequestActivity", api.getChangeRequestActivity),
    ...(api.getReviewThreadComments === undefined
      ? {}
      : {
          getReviewThreadComments: wrap("getReviewThreadComments", api.getReviewThreadComments),
        }),
    getViewerPermissions: interactive("getViewerPermissions", api.getViewerPermissions),
    getDiff: wrap("getDiff", api.getDiff),
    ...(api.getDiffFileContents === undefined
      ? {}
      : { getDiffFileContents: wrap("getDiffFileContents", api.getDiffFileContents) }),
    runAction: interactive("runAction", api.runAction),
    ...(api.updateChangeRequest === undefined
      ? {}
      : {
          updateChangeRequest: interactive("updateChangeRequest", api.updateChangeRequest),
        }),
    comment: interactive("comment", api.comment),
    ...(api.updateComment === undefined
      ? {}
      : { updateComment: interactive("updateComment", api.updateComment) }),
    submitReview: interactive("submitReview", api.submitReview),
    listReviewerCandidates: interactive("listReviewerCandidates", api.listReviewerCandidates),
    setReviewerRequest: interactive("setReviewerRequest", api.setReviewerRequest),
    ...(api.listLabelCandidates === undefined
      ? {}
      : { listLabelCandidates: interactive("listLabelCandidates", api.listLabelCandidates) }),
    ...(api.setLabels === undefined ? {} : { setLabels: interactive("setLabels", api.setLabels) }),
    replyToThread: interactive("replyToThread", api.replyToThread),
    setReaction: interactive("setReaction", api.setReaction),
    setThreadResolution: interactive("setThreadResolution", api.setThreadResolution),
  };
}

/**
 * The provider-native repository selector. `displayName` is the full path below the host, which
 * is what nested GitLab groups need; owner/name is the two-segment fallback for identities
 * recorded before that field existed.
 *
 * Azure DevOps is the exception: `az repos pr list --repository` takes a repository name, and
 * takes the organisation and project from the checkout it detects — so the recorded
 * `org/project/_git/repo` path is refused outright and the whole repository reads as
 * unavailable. Its name is the last segment, which is what this hands over.
 *
 * One function because everything downstream is keyed by what it answers: the rows' own
 * `repository`, the per-repository cursors, and the detail and diff reads a row leads to.
 */
export function repositoryIdentityOf(project: OrchestrationProjectShell): string | null {
  const identity = project.repositoryIdentity;
  if (!identity) return null;
  if (identity.provider === "azure-devops") {
    const segments = (identity.displayName ?? "").split("/").filter((part) => part !== "_git");
    return identity.name || segments.at(-1) || null;
  }
  if (identity.displayName) return identity.displayName;
  return identity.owner && identity.name ? `${identity.owner}/${identity.name}` : null;
}

export const make = Effect.gen(function* () {
  const mergedPullRequests = yield* PubSub.sliding<PullRequestMergeEvent>(64);
  const pullRequestRefreshes = yield* SubscriptionRef.make(0);
  const registry = yield* PullRequestProviderRegistry;
  const projections = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;
  const sourceControlProviders = yield* SourceControlProviderRegistry.SourceControlProviderRegistry;
  const rateLimits = yield* SourceControlRateLimit.SourceControlRateLimit;

  const refineUnknownProjectKinds = (
    projects: ReadonlyArray<OrchestrationProjectShell>,
    filter: { readonly projectId: ProjectId },
  ) => {
    type RefinementCandidate = {
      readonly project: OrchestrationProjectShell;
      readonly provider: SourceControlProviderInfo;
      readonly remoteName: string;
      readonly remoteUrl: string;
    };
    const refinements = new Map<string, RefinementCandidate[]>();
    for (const project of projects) {
      if (project.id !== filter.projectId) continue;
      const identity = project.repositoryIdentity;
      if (identity?.provider !== "unknown" || repositoryIdentityOf(project) === null) continue;
      const { remoteName, remoteUrl } = identity.locator;
      const provider = detectSourceControlProviderFromRemoteUrl(remoteUrl);
      if (provider !== null) {
        const candidates = refinements.get(provider.baseUrl);
        const candidate = { project, provider, remoteName, remoteUrl };
        if (candidates === undefined) refinements.set(provider.baseUrl, [candidate]);
        else candidates.push(candidate);
      }
    }

    return Effect.forEach(
      refinements,
      ([baseUrl, candidates]) =>
        Effect.firstSuccessOf(
          candidates.map(({ project, provider, remoteName, remoteUrl }) =>
            Effect.suspend(() =>
              sourceControlProviders.resolveHandle({
                cwd: project.workspaceRoot,
                context: { provider, remoteName, remoteUrl },
              }),
            ).pipe(
              Effect.flatMap((handle) => {
                const kind = handle.context?.provider.kind;
                return kind === undefined || kind === "unknown"
                  ? Effect.fail(undefined)
                  : Effect.succeed(kind);
              }),
            ),
          ),
        ).pipe(
          Effect.map((kind) => [baseUrl, kind] as const),
          Effect.orElseSucceed(() => [baseUrl, "unknown"] as const),
        ),
      { concurrency: REPOSITORY_CONCURRENCY },
    ).pipe(Effect.map((resolved) => new Map(resolved)));
  };

  const resolveProject = (
    projectId: ProjectId,
  ): Effect.Effect<SupportedProject | undefined, PullRequestError> =>
    projections.getShellSnapshot().pipe(
      Effect.mapError(
        (error) =>
          new PullRequestOperationError({
            operation: "listProjects",
            detail: "The project list could not be read.",
            cause: error,
          }),
      ),
      Effect.flatMap((snapshot) =>
        refineUnknownProjectKinds(snapshot.projects, { projectId }).pipe(
          Effect.map((refinedKinds) => ({
            refinedKinds,
            project: snapshot.projects.find((project) => project.id === projectId),
          })),
        ),
      ),
      Effect.map(({ refinedKinds, project }) => {
        if (project === undefined) return undefined;
        const identity = project.repositoryIdentity;
        let kind = identity?.provider as SourceControlProviderKind | undefined;
        const repository = repositoryIdentityOf(project);
        if (!identity || kind === undefined || repository === null) return undefined;
        if (kind === "unknown") {
          const provider = detectSourceControlProviderFromRemoteUrl(identity.locator.remoteUrl);
          kind = provider === null ? kind : (refinedKinds.get(provider.baseUrl) ?? kind);
        }
        const host = pullRequestHostOf(identity, kind);
        const api = registry.get(kind);
        if (api === null) return undefined;
        return { project, api: withRateLimitBackoff(api, host, rateLimits), repository, host };
      }),
    );

  const requireProject = (ref: PullRequestRef): Effect.Effect<SupportedProject, PullRequestError> =>
    resolveProject(ref.projectId).pipe(
      Effect.flatMap((match): Effect.Effect<SupportedProject, PullRequestError> => {
        if (!match) {
          return Effect.fail(new PullRequestUnavailableError({ reason: "provider-unsupported" }));
        }
        // The repository travels through the client, so it is checked against the project's
        // own remote rather than being handed to a provider verbatim.
        if (match.repository.toLowerCase() !== ref.repository.trim().toLowerCase()) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "resolveRepository",
              detail: "The change request does not belong to the selected project.",
            }),
          );
        }
        return Effect.succeed(match);
      }),
    );

  /**
   * What the signed-in account may do with this change request, asked of the host itself. Every
   * write goes through it: the page hides what a viewer may not do, and a request that arrived
   * without passing through the page — or after the access behind it was withdrawn — must not be
   * handed to a provider on the client's word. Read freshly for that reason, rather than taken
   * from whatever the detail said when the page loaded.
   */
  const viewerPermissionsOf = (project: SupportedProject, ref: PullRequestRef, operation: string) =>
    project.api
      .getViewerPermissions({
        cwd: project.project.workspaceRoot,
        repository: project.repository,
        host: project.host,
        number: ref.number,
      })
      .pipe(Effect.mapError(toPullRequestError(operation)));

  /** Account identity is cached by host, so enterprise and public hosts stay separate. */
  type ResolvedViewer = {
    readonly host: string;
    readonly kind: SourceControlProviderKind;
    readonly viewer: string | null;
    readonly error: PullRequestProviderError | null;
  };
  // Cache only successful lookups; signing in after a failure must take effect immediately.
  const viewersByHost = new Map<string, { readonly at: number; readonly result: ResolvedViewer }>();
  const viewerFlights = yield* Cache.makeWith(
    (key: string): Effect.Effect<ResolvedViewer> => {
      const [host, kind, roots] = JSON.parse(key) as [
        string,
        SourceControlProviderKind,
        ReadonlyArray<string>,
      ];
      const registered = registry.get(kind);
      if (registered === null) {
        return Effect.die(new Error(`Missing pull request provider: ${kind}`));
      }
      const api = withRateLimitBackoff(registered, host, rateLimits);
      return Effect.firstSuccessOf(roots.map((cwd) => api.getViewer({ cwd }))).pipe(
        Effect.map((viewer) => ({
          host,
          kind,
          viewer: viewer as string | null,
          error: null as PullRequestProviderError | null,
        })),
        Effect.tap((result) =>
          Effect.map(Clock.currentTimeMillis, (at) => viewersByHost.set(host, { at, result })),
        ),
        Effect.catch((error) =>
          Effect.succeed({
            host,
            kind,
            viewer: null,
            error,
          }),
        ),
      );
    },
    {
      capacity: VIEWER_CACHE_CAPACITY,
      // The host-wide success map holds the real ten-minute answer. This short entry exists to
      // keep simultaneous cold page reads on one in-flight lookup; failures remain retryable.
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value.error === null ? Duration.seconds(1) : Duration.zero,
    },
  );

  const resolveViewers = (projects: ReadonlyArray<SupportedProject>) =>
    Effect.forEach(
      [...new Set(projects.map(({ host }) => host))],
      (host) =>
        Effect.flatMap(Clock.currentTimeMillis, (now): Effect.Effect<ResolvedViewer> => {
          const held = viewersByHost.get(host);
          if (held !== undefined && now - held.at <= Duration.toMillis(VIEWER_CACHE_TTL)) {
            return Effect.succeed(held.result);
          }
          const forHost = projects.filter((project) => project.host === host);
          const api = forHost[0]!.api;
          const roots = forHost.map(({ project }) => project.workspaceRoot);
          const key = JSON.stringify([host, api.kind, [...new Set(roots)].sort()]);
          return Cache.get(viewerFlights, key);
        }),
      { concurrency: REPOSITORY_CONCURRENCY },
    );

  /** Reuse the signed-in account for requests to the same host. */
  const viewerOf = (project: SupportedProject): Effect.Effect<string | null> =>
    resolveViewers([project]).pipe(Effect.map(([resolved]) => resolved?.viewer ?? null));

  const summaryUncached: PullRequestService["Service"]["summary"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project) => {
        const providerInput = {
          cwd: project.project.workspaceRoot,
          repository: project.repository,
          host: project.host,
          number: input.number,
        };
        const read =
          project.api.getChangeRequestSummary === undefined
            ? project.api.getChangeRequest(providerInput)
            : project.api.getChangeRequestSummary(providerInput);
        return read.pipe(
          Effect.mapError(toPullRequestError("summary")),
          Effect.map((changeRequest): PullRequestSummary => ({
            provider: project.api.kind,
            projectId: project.project.id,
            repository: project.repository,
            number: changeRequest.number,
            title: changeRequest.title,
            url: changeRequest.url,
            state: changeRequest.state,
            ...(changeRequest.isDraft === true ? { isDraft: true } : {}),
            headBranch: changeRequest.headBranch,
            baseBranch: changeRequest.baseBranch,
            closedAt: changeRequest.closedAt ?? null,
            mergedAt: changeRequest.mergedAt ?? null,
            updatedAt: changeRequest.updatedAt,
          })),
        );
      }),
    );

  const detailUncached: PullRequestService["Service"]["detail"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project) =>
        Effect.all(
          [
            project.api
              .getChangeRequest({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
              })
              .pipe(Effect.mapError(toPullRequestError("detail"))),
            viewerOf(project),
          ],
          { concurrency: 2 },
        ).pipe(
          Effect.map(([changeRequest, viewer]): PullRequestDetail => ({
            provider: project.api.kind,
            capabilities: project.api.capabilities,
            projectId: project.project.id,
            projectTitle: project.project.title,
            workspaceRoot: project.project.workspaceRoot,
            repository: project.repository,
            number: changeRequest.number,
            title: changeRequest.title,
            body: changeRequest.body,
            url: changeRequest.url,
            author: changeRequest.author,
            state: changeRequest.state,
            isDraft: changeRequest.isDraft,
            mergeability: changeRequest.mergeability,
            additions: changeRequest.additions,
            deletions: changeRequest.deletions,
            changedFiles: changeRequest.changedFiles,
            headBranch: changeRequest.headBranch,
            ...(changeRequest.headRepositoryNameWithOwner === undefined
              ? {}
              : { headRepositoryNameWithOwner: changeRequest.headRepositoryNameWithOwner }),
            baseBranch: changeRequest.baseBranch,
            createdAt: changeRequest.createdAt,
            updatedAt: changeRequest.updatedAt,
            mergedAt: changeRequest.mergedAt,
            closedAt: changeRequest.closedAt,
            reviewers: changeRequest.reviewers,
            labels: changeRequest.labels,
            checks: changeRequest.checks,
            mergeCapabilities: changeRequest.mergeCapabilities,
            viewerPermissions: changeRequest.viewerPermissions,
            ...(viewer === null || viewer.trim().length === 0 ? {} : { viewer }),
            ...(changeRequest.baseComparison === undefined
              ? {}
              : { baseComparison: changeRequest.baseComparison }),
            ...(changeRequest.behindBy === undefined ? {} : { behindBy: changeRequest.behindBy }),
            ...(changeRequest.autoMergeEnabled === undefined
              ? {}
              : { autoMergeEnabled: changeRequest.autoMergeEnabled }),
            ...(changeRequest.autoMergeMethod === undefined
              ? {}
              : { autoMergeMethod: changeRequest.autoMergeMethod }),
            ...(changeRequest.workflowApprovalsRequired === undefined
              ? {}
              : { workflowApprovalsRequired: changeRequest.workflowApprovalsRequired }),
          })),
        ),
      ),
    );

  const activityUncached: PullRequestService["Service"]["activity"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project) =>
        project.api
          .getChangeRequestActivity({
            cwd: project.project.workspaceRoot,
            repository: project.repository,
            host: project.host,
            number: input.number,
          })
          .pipe(
            Effect.mapError(toPullRequestError("activity")),
            Effect.map((activity): PullRequestActivity => ({
              ...(activity.author === undefined ? {} : { author: activity.author }),
              ...(activity.reviewers === undefined ? {} : { reviewers: activity.reviewers }),
              comments: activity.comments,
              commentCount: activity.commentCount,
              commentsTruncated: activity.commentsTruncated,
              reviewThreads: activity.reviewThreads,
              commits: activity.commits,
              ...(activity.reactions === undefined ? {} : { reactions: activity.reactions }),
            })),
          ),
      ),
    );

  const threadComments: PullRequestService["Service"]["threadComments"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap(
        (project): Effect.Effect<PullRequestThreadCommentsResult, PullRequestError> => {
          const read = project.api.getReviewThreadComments;
          if (read === undefined) {
            return Effect.fail(
              new PullRequestOperationError({
                operation: "threadComments",
                detail: "This host does not page review thread comments.",
              }),
            );
          }
          return read({
            cwd: project.project.workspaceRoot,
            repository: project.repository,
            host: project.host,
            number: input.number,
            threadId: input.threadId,
            cursor: input.cursor,
          }).pipe(Effect.mapError(toPullRequestError("threadComments")));
        },
      ),
    );

  const diffUncached: PullRequestService["Service"]["diff"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project) =>
        project.api.capabilities.diff
          ? project.api
              .getDiff({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
                ...(input.commit === undefined ? {} : { commit: input.commit }),
              })
              .pipe(Effect.mapError(toPullRequestError("diff")))
          : Effect.fail(
              new PullRequestOperationError({
                operation: "diff",
                detail: "This host cannot provide a diff for a change request.",
              }),
            ),
      ),
    );

  const diffFileContents: PullRequestService["Service"]["diffFileContents"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project) => {
        const read = project.api.getDiffFileContents;
        return project.api.capabilities.diff && read
          ? read({
              cwd: project.project.workspaceRoot,
              repository: project.repository,
              host: project.host,
              number: input.number,
              ...(input.commit === undefined ? {} : { commit: input.commit }),
              changeType: input.changeType,
              oldPath: input.oldPath,
              newPath: input.newPath,
            }).pipe(Effect.mapError(toPullRequestError("diffFileContents")))
          : Effect.fail(
              new PullRequestOperationError({
                operation: "diffFileContents",
                detail: "This host cannot expand unchanged pull request lines.",
              }),
            );
      }),
    );

  const runAction = (input: PullRequestActionInput): Effect.Effect<string, PullRequestError> =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<string, PullRequestError> => {
        // The surface hides what a host cannot do, and this refuses it as well: a request that
        // reached here anyway must not be handed to a provider that never claimed the action.
        if (!project.api.capabilities.actions.includes(input.action)) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "runAction",
              detail: `This host cannot ${input.action} a change request.`,
            }),
          );
        }
        // A strategy the host does not offer must be refused rather than passed on: every
        // provider maps an unrecognised method to its own default, so asking Azure DevOps to
        // rebase would quietly merge instead of failing.
        if (
          input.mergeMethod !== undefined &&
          !project.api.capabilities.mergeMethods.includes(input.mergeMethod)
        ) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "runAction",
              detail: `This host cannot merge with the ${input.mergeMethod} strategy.`,
            }),
          );
        }
        // The same for the way a stale branch is brought up to date: a host that only merges
        // must not be asked to rebase and left to pick something else.
        if (
          input.updateMethod !== undefined &&
          !(project.api.capabilities.updateMethods ?? []).includes(input.updateMethod)
        ) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "runAction",
              detail: `This host cannot update a branch by ${input.updateMethod}.`,
            }),
          );
        }
        // What the host can do and what this account may ask of it are two questions, and both
        // have to say yes. The second is asked last, because it costs a request and the checks
        // above do not.
        return viewerPermissionsOf(project, input, "runAction").pipe(
          Effect.flatMap((viewer): Effect.Effect<string, PullRequestError> => {
            if (!viewer.actions.includes(input.action)) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "runAction",
                  detail: ACTION_ACCESS_REFUSALS[input.action],
                }),
              );
            }
            if (
              input.updateMethod !== undefined &&
              !(viewer.updateMethods ?? []).includes(input.updateMethod)
            ) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "runAction",
                  detail: ACTION_ACCESS_REFUSALS["update-branch"],
                }),
              );
            }
            return project.api
              .runAction({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                action: input.action,
                ...(input.mergeMethod === undefined ? {} : { mergeMethod: input.mergeMethod }),
                ...(input.updateMethod === undefined ? {} : { updateMethod: input.updateMethod }),
              })
              .pipe(
                Effect.mapError(toPullRequestError("runAction")),
                Effect.as(project.repository),
              );
          }),
        );
      }),
    );

  const comment: PullRequestService["Service"]["comment"] = (input) =>
    // The contract keeps the body verbatim because it is markdown, so the "did the user
    // actually write something" check lives here.
    (input.body.trim().length === 0
      ? Effect.fail(
          new PullRequestOperationError({
            operation: "comment",
            detail: "A comment cannot be empty.",
          }),
        )
      : requireProject(input)
    ).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        if (!project.api.capabilities.comment) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "comment",
              detail: "This host cannot post a comment on a change request.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "comment").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> => {
            if (!viewer.comment) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "comment",
                  detail:
                    "You need write access on this repository to comment on a change request.",
                }),
              );
            }
            return project.api
              .comment({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                body: input.body,
              })
              .pipe(Effect.mapError(toPullRequestError("comment")));
          }),
        );
      }),
    );

  /**
   * Rewriting the change request's own words, and rewriting a remark, are both left to the host to
   * allow or refuse. Neither is a question a permission read answers: every host lets the person
   * who wrote something rewrite it whatever access they have otherwise, and none of them reports
   * that as a permission — so a check here could only guess, and a wrong guess takes the control
   * away from the one person certain to be allowed.
   */
  const update: PullRequestService["Service"]["update"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        const rewrite = project.api.updateChangeRequest;
        if (project.api.capabilities.edit?.changeRequest !== true || rewrite === undefined) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "update",
              detail: "This host cannot rewrite a change request.",
            }),
          );
        }
        if (input.title === undefined && input.body === undefined) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "update",
              detail: "Nothing was changed.",
            }),
          );
        }
        return rewrite({
          cwd: project.project.workspaceRoot,
          repository: project.repository,
          host: project.host,
          number: input.number,
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.body === undefined ? {} : { body: input.body }),
        }).pipe(Effect.mapError(toPullRequestError("update")));
      }),
    );

  const updateComment: PullRequestService["Service"]["updateComment"] = (input) =>
    (input.body.trim().length === 0
      ? Effect.fail(
          new PullRequestOperationError({
            operation: "updateComment",
            detail: "A comment cannot be empty.",
          }),
        )
      : requireProject(input)
    ).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        const rewrite = project.api.updateComment;
        if (project.api.capabilities.edit?.comment !== true || rewrite === undefined) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "updateComment",
              detail: "This host cannot rewrite a comment.",
            }),
          );
        }
        return rewrite({
          cwd: project.project.workspaceRoot,
          repository: project.repository,
          host: project.host,
          number: input.number,
          commentId: input.commentId,
          kind: input.kind,
          body: input.body,
        }).pipe(Effect.mapError(toPullRequestError("updateComment")));
      }),
    );

  const submitReview: PullRequestService["Service"]["submitReview"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        const review = project.api.capabilities.review;
        const refuse = (detail: string) =>
          Effect.fail(new PullRequestOperationError({ operation: "submitReview", detail }));
        // The surface hides what a host cannot do, and this refuses it as well: a request that
        // reached here anyway must not be handed to a provider that never claimed it.
        if (!review.verdicts.includes(input.verdict)) {
          return refuse(`This host cannot ${VERDICT_LABELS[input.verdict]} a change request.`);
        }
        if (input.comments.length > 0 && !review.inlineComment) {
          return refuse("This host cannot comment on a line of a change request.");
        }
        // A verdict with nothing attached to it is a request every host rejects, and doing so
        // here says which of the two is missing rather than reporting the host's refusal.
        if (
          input.verdict !== "approve" &&
          input.body.trim().length === 0 &&
          input.comments.length === 0
        ) {
          return refuse("A review needs a summary or at least one comment.");
        }
        return viewerPermissionsOf(project, input, "submitReview").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> => {
            if (!viewer.verdicts.includes(input.verdict)) {
              return refuse(
                `You need write access on this repository to ${
                  VERDICT_LABELS[input.verdict]
                } a change request.`,
              );
            }
            if (input.comments.length > 0 && !viewer.comment) {
              return refuse(
                "You need write access on this repository to comment on a line of a change request.",
              );
            }
            return project.api
              .submitReview({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                verdict: input.verdict,
                body: input.body,
                comments: input.comments,
              })
              .pipe(Effect.mapError(toPullRequestError("submitReview")));
          }),
        );
      }),
    );

  const replyToThread: PullRequestService["Service"]["replyToThread"] = (input) =>
    (input.body.trim().length === 0
      ? Effect.fail(
          new PullRequestOperationError({
            operation: "replyToThread",
            detail: "A reply cannot be empty.",
          }),
        )
      : requireProject(input)
    ).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        if (!project.api.capabilities.review.reply) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "replyToThread",
              detail: "This host cannot reply to a review conversation.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "replyToThread").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> => {
            if (!viewer.comment) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "replyToThread",
                  detail:
                    "You need write access on this repository to reply to a review conversation.",
                }),
              );
            }
            return project.api
              .replyToThread({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                threadId: input.threadId,
                body: input.body,
              })
              .pipe(Effect.mapError(toPullRequestError("replyToThread")));
          }),
        );
      }),
    );

  const setThreadResolution: PullRequestService["Service"]["setThreadResolution"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        if (!project.api.capabilities.review.resolve) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "setThreadResolution",
              detail: "This host cannot resolve a review conversation.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "setThreadResolution").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> => {
            if (!viewer.resolve) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "setThreadResolution",
                  detail:
                    "You need write access on this repository, or to have opened this change request, to resolve a review conversation.",
                }),
              );
            }
            return project.api
              .setThreadResolution({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                threadId: input.threadId,
                resolved: input.resolved,
              })
              .pipe(Effect.mapError(toPullRequestError("setThreadResolution")));
          }),
        );
      }),
    );

  /**
   * Reacting is gated on the host alone. Every host with reactions takes one from whoever can read
   * the change request, so there is no access left to check that reading it has not already
   * settled.
   */
  const setReaction: PullRequestService["Service"]["setReaction"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        if (project.api.capabilities.reactions !== true) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "setReaction",
              detail: "This host has no reactions.",
            }),
          );
        }
        return project.api
          .setReaction({
            cwd: project.project.workspaceRoot,
            repository: project.repository,
            host: project.host,
            number: input.number,
            ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
            content: input.content,
            reacted: input.reacted,
          })
          .pipe(Effect.mapError(toPullRequestError("setReaction")));
      }),
    );

  /**
   * Who may be asked is only ever wanted by somebody about to ask, because the menu it fills is
   * the one the request is made from. So the same permission guards both: a page that could open
   * the menu without it would offer a list whose every press was going to be turned down.
   */
  const reviewerCandidates: PullRequestService["Service"]["reviewerCandidates"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap(
        (project): Effect.Effect<PullRequestReviewerCandidateList, PullRequestError> => {
          if (!project.api.capabilities.reviewers.listCandidates) {
            return Effect.fail(
              new PullRequestOperationError({
                operation: "reviewerCandidates",
                detail: "This host cannot say who may review a change request.",
              }),
            );
          }
          return viewerPermissionsOf(project, input, "reviewerCandidates").pipe(
            Effect.flatMap(
              (viewer): Effect.Effect<PullRequestReviewerCandidateList, PullRequestError> =>
                viewer.requestReviewers
                  ? project.api
                      .listReviewerCandidates({
                        cwd: project.project.workspaceRoot,
                        repository: project.repository,
                        host: project.host,
                        number: input.number,
                      })
                      .pipe(Effect.mapError(toPullRequestError("reviewerCandidates")))
                  : Effect.fail(
                      new PullRequestOperationError({
                        operation: "reviewerCandidates",
                        detail: REVIEWER_REQUEST_REFUSAL,
                      }),
                    ),
            ),
          );
        },
      ),
    );

  const requestReviewers: PullRequestService["Service"]["requestReviewers"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        if (!project.api.capabilities.reviewers.request) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "requestReviewers",
              detail: "This host cannot ask somebody for a review.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "requestReviewers").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> => {
            if (!viewer.requestReviewers) {
              return Effect.fail(
                new PullRequestOperationError({
                  operation: "requestReviewers",
                  detail: REVIEWER_REQUEST_REFUSAL,
                }),
              );
            }
            return project.api
              .setReviewerRequest({
                cwd: project.project.workspaceRoot,
                repository: project.repository,
                host: project.host,
                number: input.number,
                reviewers: input.reviewers,
                requested: input.requested,
              })
              .pipe(Effect.mapError(toPullRequestError("requestReviewers")));
          }),
        );
      }),
    );

  /**
   * The labels, like the reviewer candidates, are wanted only by somebody about to change them,
   * so the same permission guards the list and the change.
   */
  const labelCandidates: PullRequestService["Service"]["labelCandidates"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<PullRequestLabelCandidateList, PullRequestError> => {
        const list = project.api.listLabelCandidates;
        if (project.api.capabilities.labels !== true || list === undefined) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "labelCandidates",
              detail: "This host cannot change the labels on a change request.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "labelCandidates").pipe(
          Effect.flatMap(
            (viewer): Effect.Effect<PullRequestLabelCandidateList, PullRequestError> =>
              viewer.labels === false
                ? Effect.fail(
                    new PullRequestOperationError({
                      operation: "labelCandidates",
                      detail: LABEL_CHANGE_REFUSAL,
                    }),
                  )
                : list({
                    cwd: project.project.workspaceRoot,
                    repository: project.repository,
                    host: project.host,
                    number: input.number,
                  }).pipe(Effect.mapError(toPullRequestError("labelCandidates"))),
          ),
        );
      }),
    );

  const setLabels: PullRequestService["Service"]["setLabels"] = (input) =>
    requireProject(input).pipe(
      Effect.flatMap((project): Effect.Effect<void, PullRequestError> => {
        const change = project.api.setLabels;
        if (project.api.capabilities.labels !== true || change === undefined) {
          return Effect.fail(
            new PullRequestOperationError({
              operation: "setLabels",
              detail: "This host cannot change the labels on a change request.",
            }),
          );
        }
        return viewerPermissionsOf(project, input, "setLabels").pipe(
          Effect.flatMap((viewer): Effect.Effect<void, PullRequestError> =>
            viewer.labels === false
              ? Effect.fail(
                  new PullRequestOperationError({
                    operation: "setLabels",
                    detail: LABEL_CHANGE_REFUSAL,
                  }),
                )
              : change({
                  cwd: project.project.workspaceRoot,
                  repository: project.repository,
                  host: project.host,
                  number: input.number,
                  labels: input.labels,
                  applied: input.applied,
                }).pipe(Effect.mapError(toPullRequestError("setLabels"))),
          ),
        );
      }),
    );

  const context = yield* Effect.context<never>();
  const runFork = Effect.runForkWith(context);

  /**
   * The diff is not live-polled and is expensive enough to keep its stale-while-revalidate path.
   * Explicit refreshes and mutations still strand held values through the reference epoch.
   */
  const staleDiff = (() => {
    const staleMs = Duration.toMillis(DIFF_STALE_WINDOW);
    const held = new Map<string, { readonly at: number; readonly value: PullRequestDiffResult }>();
    const record = (key: string, value: PullRequestDiffResult) =>
      Effect.map(Clock.currentTimeMillis, (at) => {
        held.delete(key);
        if (held.size >= DIFF_CACHE_CAPACITY) {
          const oldest = held.keys().next().value;
          if (oldest !== undefined) held.delete(oldest);
        }
        held.set(key, { at, value });
      });
    return <E>(key: string, read: Effect.Effect<PullRequestDiffResult, E>) => {
      const recorded = read.pipe(Effect.tap((value) => record(key, value)));
      return Effect.flatMap(Clock.currentTimeMillis, (now) => {
        const snapshot = held.get(key);
        if (snapshot === undefined || now - snapshot.at > staleMs) return recorded;
        // Run as its own fiber rather than a child: the caller is answered and gone before the
        // refresh lands. The read still coalesces on the cache key, so ten stale reads in one
        // window cost one host request — and a failed refresh costs nothing but the retry.
        return Effect.sync(() => runFork(Effect.ignore(recorded))).pipe(Effect.as(snapshot.value));
      });
    };
  })();

  const makeLastGoodRead = <A>(capacity: number) => {
    const held = new Map<string, { readonly at: number; readonly value: A }>();
    const record = (key: string, value: A) =>
      Effect.map(Clock.currentTimeMillis, (at) => {
        held.delete(key);
        if (held.size >= capacity) {
          const oldest = held.keys().next().value;
          if (oldest !== undefined) held.delete(oldest);
        }
        held.set(key, { at, value });
      });
    const read = (key: string, effect: Effect.Effect<A, PullRequestError>) =>
      effect.pipe(
        Effect.tap((value) => record(key, value)),
        Effect.catchTags({
          PullRequestOperationError: (error) => {
            if (!isPullRequestProviderError(error.cause)) {
              return Effect.fail(error);
            }
            const provider = error.cause;
            if (provider.reason !== "failed" && provider.reason !== "rate-limited") {
              return Effect.fail(error);
            }
            return Effect.flatMap(Clock.currentTimeMillis, (now) => {
              const snapshot = held.get(key);
              if (
                snapshot === undefined ||
                now - snapshot.at > Duration.toMillis(STALE_DETAIL_WINDOW)
              ) {
                return Effect.fail(error);
              }
              return Effect.logWarning("using recent pull request data after a failed refresh", {
                operation: error.operation,
                reason: provider.reason,
              }).pipe(Effect.as(snapshot.value));
            });
          },
        }),
      );
    /**
     * A change request already read does not wait on the host again. `reuse` answers from
     * what we hold and spends nothing — title, author, and state barely move, and a linked
     * thread already names the change request. `revalidate` answers the same way and
     * refreshes behind it, so line counts and the rest can change in place.
     */
    const serveHeld = (
      key: string,
      effect: Effect.Effect<A, PullRequestError>,
      mode: "reuse" | "revalidate",
    ) => {
      const snapshot = held.get(key);
      if (snapshot === undefined) return read(key, effect);
      if (mode === "reuse") return Effect.succeed(snapshot.value);
      return Effect.sync(() => runFork(Effect.ignore(read(key, effect)))).pipe(
        Effect.as(snapshot.value),
      );
    };
    return { peek: (key: string) => held.get(key)?.value, read, record, serveHeld };
  };
  const lastGoodSummary = makeLastGoodRead<PullRequestSummary>(DETAIL_CACHE_CAPACITY);
  const lastGoodDetail = makeLastGoodRead<PullRequestDetail>(DETAIL_CACHE_CAPACITY);

  // Epochs are the invalidation mechanism: a key carries its scope's epoch, so bumping the
  // epoch strands every entry made under the old one — no enumerating a cache whose keys
  // (cursors, commits) nothing holds a list of. The counter is shared and monotonic so a
  // scope re-entering `refEpochs` after eviction can never mint a key an old entry still has.
  let epochCounter = 0;
  let turnRefreshEpoch = 0;
  const refEpochs = new Map<string, number>();
  const REF_EPOCH_CAPACITY = 2_048;
  const refScope = (ref: PullRequestRef) => `${ref.projectId} ${ref.repository} ${ref.number}`;
  const refEpoch = (ref: PullRequestRef) =>
    Math.max(turnRefreshEpoch, refEpochs.get(refScope(ref)) ?? 0);
  const refCacheKey = (ref: PullRequestRef) =>
    JSON.stringify([refEpoch(ref), ref.projectId, ref.repository, ref.number]);
  const bumpRefEpoch = (ref: PullRequestRef) => {
    const scope = refScope(ref);
    if (!refEpochs.has(scope) && refEpochs.size >= REF_EPOCH_CAPACITY) {
      const oldest = refEpochs.keys().next().value;
      if (oldest !== undefined) refEpochs.delete(oldest);
    }
    refEpochs.set(scope, ++epochCounter);
  };

  const summaryCache = yield* Cache.makeWith(
    (key: string) => {
      const [, projectId, repository, number] = JSON.parse(key) as [number, string, string, number];
      return summaryUncached({ projectId, repository, number } as PullRequestRef);
    },
    {
      capacity: DETAIL_CACHE_CAPACITY,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? SUMMARY_CACHE_TTL : Duration.zero),
    },
  );
  const summary: PullRequestService["Service"]["summary"] = (input, options) => {
    const key = refCacheKey(input);
    const cached = Cache.get(summaryCache, key);
    const held = lastGoodSummary.peek(key);
    return held !== undefined &&
      (options?.recoverTransientFailure !== false || held.state === "merged")
      ? Effect.succeed(held)
      : cached.pipe(
          Effect.tap((value) =>
            shouldReplaceHeldSummary(key, value) ? lastGoodSummary.record(key, value) : Effect.void,
          ),
        );
  };

  const detailCache = yield* Cache.makeWith(
    (key: string) => {
      const [, projectId, repository, number] = JSON.parse(key) as [number, string, string, number];
      return detailUncached({ projectId, repository, number } as PullRequestRef);
    },
    {
      capacity: DETAIL_CACHE_CAPACITY,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? DETAIL_CACHE_TTL : Duration.zero),
    },
  );
  const summaryFromDetail = (detail: PullRequestDetail): PullRequestSummary => ({
    provider: detail.provider,
    projectId: detail.projectId,
    repository: detail.repository,
    number: detail.number,
    title: detail.title,
    url: detail.url,
    state: detail.state,
    ...(detail.isDraft === true ? { isDraft: true } : {}),
    headBranch: detail.headBranch,
    baseBranch: detail.baseBranch,
    closedAt: detail.closedAt,
    mergedAt: detail.mergedAt,
    updatedAt: detail.updatedAt,
  });
  const shouldReplaceHeldSummary = (key: string, next: PullRequestSummary) => {
    const current = lastGoodSummary.peek(key);
    if (current === undefined) return true;
    if (current.state === "merged" && next.state !== "merged") return false;
    return next.updatedAt >= current.updatedAt;
  };
  const detail: PullRequestService["Service"]["detail"] = (input) => {
    const key = refCacheKey(input);
    // Record the summary from a host or cache read, not the stale value
    // `serveHeld` returns immediately. Skip the write when that read is older
    // than a later strict summary — display reuse would otherwise keep the
    // regression and never ask the host again.
    return lastGoodDetail.serveHeld(
      key,
      Cache.get(detailCache, key).pipe(
        Effect.tap((value) => {
          const summary = summaryFromDetail(value);
          return shouldReplaceHeldSummary(key, summary)
            ? lastGoodSummary.record(key, summary)
            : Effect.void;
        }),
      ),
      "revalidate",
    );
  };

  const activityCache = yield* Cache.makeWith(
    (key: string) => {
      const [, projectId, repository, number] = JSON.parse(key) as [number, string, string, number];
      return activityUncached({ projectId, repository, number } as PullRequestRef);
    },
    {
      capacity: DETAIL_CACHE_CAPACITY,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? DETAIL_CACHE_TTL : Duration.zero),
    },
  );
  const activity: PullRequestService["Service"]["activity"] = (input) => {
    const key = refCacheKey(input);
    return Cache.get(activityCache, key);
  };

  const diffCache = yield* Cache.makeWith(
    (key: string) => {
      const [, projectId, repository, number, cursor, commit] = JSON.parse(key) as [
        number,
        string,
        string,
        number,
        string | null,
        string | null,
      ];
      return diffUncached({
        projectId,
        repository,
        number,
        ...(cursor === null ? {} : { cursor }),
        ...(commit === null ? {} : { commit }),
      } as PullRequestDiffInput);
    },
    {
      capacity: DIFF_CACHE_CAPACITY,
      timeToLive: (exit, key) => {
        if (!Exit.isSuccess(exit)) return Duration.zero;
        const commit = (JSON.parse(key) as ReadonlyArray<unknown>)[5];
        return commit === null ? DIFF_CACHE_TTL : COMMIT_DIFF_CACHE_TTL;
      },
    },
  );
  const diff: PullRequestService["Service"]["diff"] = (input) => {
    const key = JSON.stringify([
      refEpoch(input),
      input.projectId,
      input.repository,
      input.number,
      input.cursor ?? null,
      input.commit ?? null,
      input.commit === undefined
        ? (lastGoodSummary.peek(refCacheKey(input))?.updatedAt ?? null)
        : null,
    ]);
    return staleDiff(key, Cache.get(diffCache, key));
  };

  const invalidate: PullRequestService["Service"]["invalidate"] = (input) => {
    const reference = input.reference;
    if (reference !== undefined) {
      return Effect.sync(() => bumpRefEpoch(reference));
    }
    return Effect.sync(() => {
      viewersByHost.clear();
    }).pipe(Effect.andThen(Cache.invalidateAll(viewerFlights)));
  };

  const refreshAfterTurn: PullRequestService["Service"]["refreshAfterTurn"] = Effect.suspend(() => {
    turnRefreshEpoch = ++epochCounter;
    return SubscriptionRef.set(pullRequestRefreshes, turnRefreshEpoch);
  });

  // Invalidate the changed request for all readers after a successful mutation.
  const invalidatedByMutation =
    <I extends PullRequestRef>(
      method: (input: I) => Effect.Effect<void, PullRequestError>,
    ): ((input: I) => Effect.Effect<void, PullRequestError>) =>
    (input) =>
      method(input).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            bumpRefEpoch(input);
          }),
        ),
      );
  const runActionAndInvalidate: PullRequestService["Service"]["runAction"] = Effect.fn(
    "PullRequestService.runActionAndInvalidate",
  )(function* (input) {
    const repository = yield* runAction(input);
    bumpRefEpoch({ ...input, repository });
    if (input.action === "merge") {
      // A successful merge action can merely enqueue the PR or enable auto-merge.
      const confirmed = yield* summaryUncached({ ...input, repository }).pipe(
        Effect.catch((error) =>
          Effect.logWarning("failed to confirm pull request merge", { error }).pipe(
            Effect.as(null),
          ),
        ),
      );
      if (confirmed?.state !== "merged") return;
      yield* PubSub.publish(mergedPullRequests, {
        projectId: input.projectId,
        repository,
        number: input.number,
        mergedAt: DateTime.formatIso(yield* DateTime.now),
      });
    }
  });

  return PullRequestService.of({
    summary,
    subscribeMerges: PubSub.subscribe(mergedPullRequests).pipe(
      Effect.map((subscription) => Stream.fromSubscription(subscription)),
    ),
    subscribeRefreshes: SubscriptionRef.changes(pullRequestRefreshes).pipe(
      Stream.filter((revision) => revision > 0),
    ),
    refreshAfterTurn,
    detail,
    activity,
    threadComments,
    diff,
    diffFileContents,
    runAction: runActionAndInvalidate,
    update: invalidatedByMutation(update),
    comment: invalidatedByMutation(comment),
    updateComment: invalidatedByMutation(updateComment),
    submitReview: invalidatedByMutation(submitReview),
    replyToThread: invalidatedByMutation(replyToThread),
    setThreadResolution: invalidatedByMutation(setThreadResolution),
    setReaction: invalidatedByMutation(setReaction),
    // The candidate list is deliberately read fresh per menu-open, so it stays uncached.
    reviewerCandidates,
    requestReviewers: invalidatedByMutation(requestReviewers),
    labelCandidates,
    setLabels: invalidatedByMutation(setLabels),
    invalidate,
  });
});

export const layer = Layer.effect(PullRequestService, make);
