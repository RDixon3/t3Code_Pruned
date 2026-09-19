import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import {
  type PullRequestAction,
  type PullRequestActor,
  type PullRequestMergeMethod,
  type PullRequestOmittedFileStat,
  type PullRequestReaction,
  type PullRequestReactionContent,
  type PullRequestReviewCommentDraft,
  type PullRequestReviewVerdict,
  type PullRequestReviewerCandidateList,
  type PullRequestReviewerKind,
  type PullRequestLabelCandidateList,
  type PullRequestThreadCommentsResult,
  type PullRequestUpdateMethod,
} from "@t3tools/contracts";

import * as GitHubCli from "../sourceControl/GitHubCli.ts";
import * as GitHubGraphQlBudget from "../sourceControl/githubGraphQlBudget.ts";
import * as SourceControlRateLimit from "../sourceControl/SourceControlRateLimit.ts";
import {
  ADD_REACTION_GRAPHQL_MUTATION,
  buildReviewSubmissionJson,
  buildReviewerRequestJson,
  decodePullRequestActivityJson,
  decodePullRequestDetailJson,
  decodePullRequestFilesJson,
  decodePullRequestHeadsJson,
  decodePullRequestNodeIdJson,
  decodeReactionSubjectScopeJson,
  decodeRepositoryAccessJson,
  decodeReviewerCandidatesJson,
  decodeLabelCandidatesJson,
  buildLabelRequestJson,
  LABEL_CANDIDATES_GRAPHQL_QUERY,
  decodeReviewDismissalsJson,
  decodeReviewThreadCommentsJson,
  decodeReviewThreadsJson,
  encodeGraphQlRequestJson,
  PULL_REQUEST_ACTIVITY_JSON_FIELDS,
  BASE_COMPARISON_GRAPHQL_QUERY,
  decodeBaseComparisonJson,
  PULL_REQUEST_DETAIL_JSON_FIELDS,
  PULL_REQUEST_NODE_ID_GRAPHQL_QUERY,
  REACTION_SUBJECT_PULL_REQUEST_GRAPHQL_QUERY,
  REMOVE_REACTION_GRAPHQL_MUTATION,
  REVERT_PULL_REQUEST_GRAPHQL_MUTATION,
  gitHubReactionContent,
  REPOSITORY_ACCESS_JSON_FIELDS,
  RESOLVE_REVIEW_THREAD_GRAPHQL_MUTATION,
  REVIEWER_CANDIDATES_GRAPHQL_QUERY,
  REVIEW_THREAD_COMMENTS_GRAPHQL_QUERY,
  REVIEW_DISMISSALS_GRAPHQL_QUERY,
  REVIEW_THREAD_REPLY_GRAPHQL_MUTATION,
  REVIEW_THREADS_GRAPHQL_QUERY,
  reviewThreadConversation,
  UNRESOLVE_REVIEW_THREAD_GRAPHQL_MUTATION,
  UPDATE_ISSUE_COMMENT_GRAPHQL_MUTATION,
  UPDATE_PULL_REQUEST_GRAPHQL_MUTATION,
  UPDATE_REVIEW_COMMENT_GRAPHQL_MUTATION,
  VIEWER_PERMISSIONS_GRAPHQL_QUERY,
  decodeViewerPermissionsJson,
  decodeWorkflowRunApprovalsJson,
  type GitHubBaseComparison,
  type GitHubPullRequestDetail,
  type GitHubPullRequestActivity,
  type GitHubPullRequestHead,
  type GitHubReviewThreadComments,
  type GitHubRepositoryAccess,
  type GitHubWorkflowRunApproval,
  type GitHubReviewThreadEntry,
  type GitHubReviewThreadPage,
  type GitHubViewerAccess,
} from "./gitHubPullRequestJson.ts";

/**
 * Names the read that produced unusable output, so a failure reports the call it came from
 * rather than borrowing another operation's message.
 */
export class GitHubPullRequestReadError extends Schema.TaggedError<GitHubPullRequestReadError>()(
  "GitHubPullRequestReadError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {
  get detail(): string {
    return `GitHub CLI returned an unreadable ${this.operation} response.`;
  }

  override get message(): string {
    return `GitHub CLI failed in ${this.operation}: ${this.detail}`;
  }
}

/** Not a decode failure: gh answered, the account it answered for just has no login. */
class GitHubViewerLoginUnavailableError extends Schema.TaggedError<GitHubViewerLoginUnavailableError>()(
  "GitHubViewerLoginUnavailableError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
  },
) {
  get detail(): string {
    return "GitHub CLI returned no login for the authenticated account.";
  }

  override get message(): string {
    return `GitHub CLI failed in getViewerLogin: ${this.detail}`;
  }
}

/** Not a decode failure: gh answered, but the pull request carried no update time. */
class GitHubPullRequestUpdatedAtUnavailableError extends Schema.TaggedError<GitHubPullRequestUpdatedAtUnavailableError>()(
  "GitHubPullRequestUpdatedAtUnavailableError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    repository: Schema.String,
    number: Schema.Int,
  },
) {
  get detail(): string {
    return `Pull request ${this.repository}#${this.number} reported no update time.`;
  }

  override get message(): string {
    return `GitHub CLI failed in getPullRequestSummary: ${this.detail}`;
  }
}

/** Not a decode failure: the reader asked to carry on from a cursor this walk never handed out. */
class GitHubDiffCursorError extends Schema.TaggedError<GitHubDiffCursorError>()(
  "GitHubDiffCursorError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
  },
) {
  get detail(): string {
    return "The diff cursor was not one this pull request handed out.";
  }

  override get message(): string {
    return `GitHub CLI failed in getPullRequestDiff: ${this.detail}`;
  }
}

/** Not a decode failure: the reader named a commit that is not a sha this repository could hold. */
class GitHubDiffCommitError extends Schema.TaggedError<GitHubDiffCommitError>()(
  "GitHubDiffCommitError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
  },
) {
  get detail(): string {
    return "The named commit was not a commit sha.";
  }

  override get message(): string {
    return `GitHub CLI failed in getPullRequestDiff: ${this.detail}`;
  }
}

/** The revisions read successfully, but cannot name both sides this file needs. */
class GitHubDiffRevisionsUnavailableError extends Schema.TaggedError<GitHubDiffRevisionsUnavailableError>()(
  "GitHubDiffRevisionsUnavailableError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    number: Schema.Int,
    commit: Schema.optional(Schema.String),
  },
) {
  get detail(): string {
    return this.commit === undefined
      ? `Pull request #${this.number} reported no usable base and head revisions.`
      : `Commit ${this.commit} reported no usable revisions for this file.`;
  }

  override get message(): string {
    return `GitHub CLI failed in getPullRequestDiffFileContents: ${this.detail}`;
  }
}

/** A blob exists, but expanding it would be unsafe or would not produce text. */
class GitHubDiffFileContentsUnavailableError extends Schema.TaggedError<GitHubDiffFileContentsUnavailableError>()(
  "GitHubDiffFileContentsUnavailableError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    path: Schema.String,
    reason: Schema.Literals(["oversized", "binary"]),
  },
) {
  get detail(): string {
    return this.reason === "oversized"
      ? `The diff file '${this.path}' exceeds the 1 MB expansion limit.`
      : `The diff file '${this.path}' is binary.`;
  }

  override get message(): string {
    return `GitHub CLI failed in getPullRequestDiffFileContents: ${this.detail}`;
  }
}

/** Not a decode failure: the reader named a subject this pull request never handed out. */
class GitHubSubjectScopeError extends Schema.TaggedError<GitHubSubjectScopeError>()(
  "GitHubSubjectScopeError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    operation: Schema.String,
  },
) {
  get detail(): string {
    return "The named subject did not belong to the named pull request.";
  }

  override get message(): string {
    return `GitHub CLI failed in ${this.operation}: ${this.detail}`;
  }
}

/** GitHub answered successfully, but approving every returned workflow would be unsafe. */
export class GitHubWorkflowApprovalRefusedError extends Schema.TaggedError<GitHubWorkflowApprovalRefusedError>()(
  "GitHubWorkflowApprovalRefusedError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    number: Schema.Int,
    reason: Schema.Literals(["head-list-truncated", "head-not-unique", "run-list-truncated"]),
    observedCount: Schema.Int,
    limit: Schema.Int,
  },
) {
  get detail(): string {
    if (this.reason === "head-list-truncated") {
      return `GitHub returned more than ${this.limit} pull requests for this head branch.`;
    }
    if (this.reason === "head-not-unique") {
      return `The head revision matched ${this.observedCount} pull requests instead of uniquely matching #${this.number}.`;
    }
    return `GitHub returned more than ${this.limit} workflow runs awaiting approval.`;
  }

  override get message(): string {
    return `GitHub CLI refused listWorkflowRunsRequiringApproval: ${this.detail}`;
  }
}

/** GitHub omitted the immutable head identity needed to scope an approval safely. */
class GitHubWorkflowApprovalHeadUnavailableError extends Schema.TaggedError<GitHubWorkflowApprovalHeadUnavailableError>()(
  "GitHubWorkflowApprovalHeadUnavailableError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    number: Schema.Int,
  },
) {
  get detail(): string {
    return `GitHub did not report a complete head revision for #${this.number}.`;
  }

  override get message(): string {
    return `GitHub CLI refused approve-workflows: ${this.detail}`;
  }
}

/** The pull request moved after its approval candidates were read. */
class GitHubWorkflowApprovalHeadChangedError extends Schema.TaggedError<GitHubWorkflowApprovalHeadChangedError>()(
  "GitHubWorkflowApprovalHeadChangedError",
  {
    command: Schema.Literal("gh"),
    cwd: Schema.String,
    number: Schema.Int,
  },
) {
  get detail(): string {
    return `The head revision of #${this.number} changed before its workflows could be approved.`;
  }

  override get message(): string {
    return `GitHub CLI refused approve-workflows: ${this.detail}`;
  }
}

export type GitHubPullRequestCliError =
  | GitHubCli.GitHubCliError
  | GitHubPullRequestReadError
  | GitHubDiffCursorError
  | GitHubDiffCommitError
  | GitHubDiffRevisionsUnavailableError
  | GitHubDiffFileContentsUnavailableError
  | GitHubSubjectScopeError
  | GitHubWorkflowApprovalRefusedError
  | GitHubWorkflowApprovalHeadUnavailableError
  | GitHubWorkflowApprovalHeadChangedError
  | SourceControlRateLimit.SourceControlRateLimitPausedError
  | GitHubViewerLoginUnavailableError
  | GitHubPullRequestUpdatedAtUnavailableError;

/** A large pull request can produce a multi-megabyte patch; past this it is truncated. */
const DIFF_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const DIFF_TIMEOUT_MS = 60_000;
/** Pierre expansion is for source files, not blobs large enough to stall a review surface. */
const DIFF_FILE_MAX_OUTPUT_BYTES = 1024 * 1024;

/** What the files API serves at most in one response, which is what one slice is made of. */
const DIFF_FILES_PAGE_SIZE = 100;

/**
 * Pages of review threads to follow before the conversation is reported as truncated. GitHub
 * serves a hundred threads a page, so this is a thousand threads — past anything a pull request
 * a person is reading has, and short of walking a repository-sized conversation forever.
 */
const REVIEW_THREAD_PAGES = 10;

export interface GitHubPullRequestDiffSlice {
  readonly patch: string;
  /** Files in this slice had their hunks withheld, as opposed to there being more slices. */
  readonly truncated: boolean;
  /** Where the next slice starts, or null once the patch is whole. */
  readonly nextCursor: string | null;
  /** GitHub's own counts for the files whose hunks it withheld from this slice. */
  readonly omittedFileStats?: ReadonlyArray<PullRequestOmittedFileStat>;
}

export class GitHubPullRequestCli extends Context.Service<
  GitHubPullRequestCli,
  {
    readonly getViewerLogin: (input: {
      readonly cwd: string;
    }) => Effect.Effect<string, GitHubPullRequestCliError>;

    readonly getPullRequestSummary: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<
      {
        readonly number: number;
        readonly title: string;
        readonly url: string;
        readonly headBranch: string;
        readonly baseBranch: string;
        readonly state: "open" | "closed" | "merged";
        readonly isDraft?: boolean;
        readonly closedAt?: string | null;
        readonly mergedAt?: string | null;
        readonly updatedAt: string;
      },
      GitHubPullRequestCliError
    >;

    readonly getPullRequestDetail: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<GitHubPullRequestDetail, GitHubPullRequestCliError>;

    readonly listWorkflowRunsRequiringApproval: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly headSha: string;
      readonly headBranch: string;
      readonly headRepositoryOwner: string;
      readonly isCrossRepository: true;
    }) => Effect.Effect<ReadonlyArray<GitHubWorkflowRunApproval>, GitHubPullRequestCliError>;

    /**
     * How far the branch trails its base, and whether this viewer may update it. Its own read
     * because the comparison needs the head ref the detail answers with — a fork's branch is not
     * addressable in the base repository by name alone.
     */
    readonly getPullRequestBaseComparison: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      /** Qualified `owner:branch`, which is the only form a fork's head resolves under. */
      readonly headRef: string;
      /** Manual action checks may use the quota held back from automatic reads. */
      readonly allowReserve?: boolean | undefined;
    }) => Effect.Effect<GitHubBaseComparison, GitHubPullRequestCliError>;

    readonly getPullRequestActivity: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<GitHubPullRequestActivity, GitHubPullRequestCliError>;

    readonly getPullRequestDiff: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      /** Absent asks for the first slice; anything else is a cursor a slice handed back. */
      readonly cursor?: string | undefined;
      /** One commit's own changes, rather than everything the pull request carries. */
      readonly commit?: string | undefined;
    }) => Effect.Effect<GitHubPullRequestDiffSlice, GitHubPullRequestCliError>;

    readonly getPullRequestDiffFileContents: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly commit?: string | undefined;
      readonly changeType: "change" | "rename-pure" | "rename-changed" | "new" | "deleted";
      readonly oldPath: string;
      readonly newPath: string;
    }) => Effect.Effect<
      { readonly oldContents: string; readonly newContents: string },
      GitHubPullRequestCliError
    >;

    readonly listReviewThreadComments: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<GitHubReviewThreadComments, GitHubPullRequestCliError>;

    readonly getReviewThreadComments: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly threadId: string;
      readonly cursor: string;
    }) => Effect.Effect<PullRequestThreadCommentsResult, GitHubPullRequestCliError>;

    /** One `gh repo view`, which answers what the repository allows and where the viewer stands. */
    readonly getRepositoryAccess: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
    }) => Effect.Effect<GitHubRepositoryAccess, GitHubPullRequestCliError>;

    /** The viewer's standing on its own, for deciding a write without reading the whole detail. */
    readonly getViewerAccess: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      /** Manual action checks may use the quota held back from automatic reads. */
      readonly allowReserve?: boolean | undefined;
    }) => Effect.Effect<GitHubViewerAccess, GitHubPullRequestCliError>;

    /** Who this pull request may be sent to, and who it has already been sent to. */
    readonly listReviewerCandidates: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<PullRequestReviewerCandidateList, GitHubPullRequestCliError>;

    readonly setReviewerRequest: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly reviewers: ReadonlyArray<{
        readonly id: string;
        readonly kind: PullRequestReviewerKind;
      }>;
      /** False deletes the same collection a request posts to, which takes the request back. */
      readonly requested: boolean;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    /** The repository's labels, and which of them this pull request already wears. */
    readonly listLabelCandidates: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
    }) => Effect.Effect<PullRequestLabelCandidateList, GitHubPullRequestCliError>;

    readonly setLabels: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly labels: ReadonlyArray<string>;
      /** False takes each label off; true adds each to whatever is already there. */
      readonly applied: boolean;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    readonly runPullRequestAction: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly action: PullRequestAction;
      readonly mergeMethod?: PullRequestMergeMethod;
      readonly updateMethod?: PullRequestUpdateMethod;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    readonly commentOnPullRequest: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly body: string;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    readonly submitReview: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly verdict: PullRequestReviewVerdict;
      readonly body: string;
      readonly comments: ReadonlyArray<PullRequestReviewCommentDraft>;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    readonly replyToReviewThread: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly threadId: string;
      readonly body: string;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    readonly setReviewThreadResolution: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly threadId: string;
      readonly resolved: boolean;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    /**
     * Adds a reaction to a remark, or takes it back. `subjectId` is any node GitHub calls
     * reactable — a comment, a review, or the pull request itself, which is looked up here
     * because nothing in the conversation names it. A given `subjectId` is confirmed to belong
     * to this pull request before the mutation runs, since nothing else ties the two together.
     */
    readonly setReaction: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly subjectId?: string | undefined;
      readonly content: PullRequestReactionContent;
      readonly reacted: boolean;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    /** Rewrites the pull request's own words, leaving whichever of the two was not given. */
    readonly updatePullRequest: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly title?: string | undefined;
      readonly body?: string | undefined;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;

    /**
     * Rewrites a remark. `commentId` is trusted to be whatever node it names, so it is confirmed
     * to belong to this pull request before the mutation runs, the way a reaction subject is.
     * Whether the remark is the reader's to rewrite is GitHub's own answer, not one asked here.
     */
    readonly updateComment: (input: {
      readonly cwd: string;
      readonly repository: string;
      readonly host: string;
      readonly number: number;
      readonly commentId: string;
      readonly kind: "issue-comment" | "review-comment";
      readonly body: string;
    }) => Effect.Effect<void, GitHubPullRequestCliError>;
  }
>()("t3/pullRequest/GitHubPullRequestCli") {}

/**
 * The GraphQL API takes owner and name as separate arguments, so `owner/repo` is split here.
 * The host is not read off the identity: it travels alongside it, because the identity a
 * project records is the path below its host and never names the host itself.
 */
function parseRepositorySelector(value: string): {
  readonly owner: string;
  readonly name: string;
} {
  const parts = value.trim().split("/").filter(Boolean);
  return { name: parts.at(-1) ?? "", owner: parts.at(-2) ?? "" };
}

/**
 * The page a diff cursor names, or null for anything this walk cannot have issued. The cursor
 * arrives from the reader as a string and goes straight into a request path, so it is parsed
 * rather than trusted; the length bound keeps a page number out of exponential notation.
 */
function diffCursorPage(cursor: string): number | null {
  return /^[1-9][0-9]{0,6}$/.test(cursor) ? Number(cursor) : null;
}

/**
 * A commit sha arrives from the reader and goes straight into a request path, so it is checked
 * rather than trusted: hexadecimal only, from the shortest abbreviation a host prints up to a
 * whole sha.
 */
function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{7,64}$/i.test(value);
}

/**
 * The `after` a paged read carries. gh sends a JSON null only through a typed field, and an
 * untyped `cursor=` would send the empty string, which GitHub refuses as a cursor rather than
 * reading as "start at the beginning".
 */
function cursorVariable(cursor: string | null): readonly [string, string] {
  return cursor === null ? ["-F", "cursor=null"] : ["-f", `cursor=${cursor}`];
}

function actionArgs(
  action: PullRequestAction,
  mergeMethod: PullRequestMergeMethod | undefined,
  updateMethod: PullRequestUpdateMethod | undefined,
): ReadonlyArray<string> {
  switch (action) {
    case "merge":
      return ["merge", `--${mergeMethod ?? "merge"}`];
    // `--auto` arms the same command instead of running it, and still needs the strategy: GitHub
    // stores the strategy with the standing instruction rather than choosing one at merge time.
    case "enable-auto-merge":
      return ["merge", "--auto", `--${mergeMethod ?? "merge"}`];
    case "disable-auto-merge":
      return ["merge", "--disable-auto"];
    // `gh` updates with a merge commit unless asked to rebase, which is GitHub's own default.
    case "update-branch":
      return ["update-branch", ...(updateMethod === "rebase" ? ["--rebase"] : [])];
    case "ready":
      return ["ready"];
    case "draft":
      return ["ready", "--undo"];
    case "close":
      return ["close"];
    case "reopen":
      return ["reopen"];
    case "revert":
      throw new Error("Revert requires a GraphQL mutation");
    // Handled separately because it may approve several workflow runs rather than mutate the
    // pull request itself.
    case "approve-workflows":
      throw new Error("Workflow approval requires run discovery");
  }
}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const github = yield* GitHubCli.GitHubCli;
  const graphQlBudget = yield* GitHubGraphQlBudget.GitHubGraphQlBudget;

  /**
   * The pull request's own node id, which is what a mutation against the pull request itself is
   * addressed by: a reaction on its description, or a rewrite of its words.
   */
  const pullRequestNodeId = (input: {
    readonly cwd: string;
    readonly repository: string;
    readonly host: string;
    readonly number: number;
    readonly operation: string;
  }) => {
    const { owner, name } = parseRepositorySelector(input.repository);
    return graphqlRead({
      cwd: input.cwd,
      host: input.host,
      operation: input.operation,
      allowReserve: true,
      variables: [
        ["-f", `owner=${owner}`],
        ["-f", `name=${name}`],
        ["-F", `number=${input.number}`],
      ],
      query: PULL_REQUEST_NODE_ID_GRAPHQL_QUERY,
      decode: decodePullRequestNodeIdJson,
    });
  };

  /**
   * Whether a client-given subject actually belongs to the pull request the request names. A
   * subject id is trusted to be whatever node it names, and that node can hang off any pull
   * request on the host — so the mutation itself would write wherever the id actually belongs,
   * not wherever the request says it does, unless this confirms the two agree first.
   */
  const subjectBelongsToPullRequest = (input: {
    readonly cwd: string;
    readonly repository: string;
    readonly host: string;
    readonly number: number;
    readonly subjectId: string;
    readonly operation: string;
  }) => {
    const { owner, name } = parseRepositorySelector(input.repository);
    return graphqlRead({
      cwd: input.cwd,
      host: input.host,
      operation: input.operation,
      allowReserve: true,
      variables: [
        ["-f", `owner=${owner}`],
        ["-f", `name=${name}`],
        ["-F", `number=${input.number}`],
        ["-f", `subjectId=${input.subjectId}`],
      ],
      query: REACTION_SUBJECT_PULL_REQUEST_GRAPHQL_QUERY,
      decode: decodeReactionSubjectScopeJson,
    });
  };

  // `gh` resolves a bare `owner/repo` against whichever host it defaults to, which is
  // github.com. Naming the host makes a GitHub Enterprise repository resolve to its own
  // install rather than to a same-named repository on github.com.
  const repositoryArgs = (input: { readonly host: string; readonly repository: string }) => [
    "--repo",
    `${input.host}/${input.repository}`,
  ];

  /**
   * A GraphQL mutation whose answer is not read back. `gh` exits non-zero on a GraphQL error,
   * so a failed mutation is already a failed command rather than a body to inspect.
   *
   * The query and its variables travel over stdin as one document: a variable can carry a
   * body the reader wrote, and argv is visible in process listings and echoed back inside
   * process-runner failure messages.
   */
  const graphql = (input: {
    readonly cwd: string;
    readonly host: string;
    readonly query: string;
    readonly variables: Readonly<Record<string, string>>;
  }) =>
    github
      .execute({
        cwd: input.cwd,
        args: ["api", "graphql", "--hostname", input.host, "--input", "-"],
        stdin: encodeGraphQlRequestJson({ query: input.query, variables: input.variables }),
      })
      .pipe(Effect.asVoid);

  /** A GraphQL read whose answer is decoded, reporting a failure against the read that made it. */
  const graphqlRead = <A>(input: {
    readonly cwd: string;
    readonly host: string;
    readonly operation: string;
    readonly allowReserve?: boolean | undefined;
    /** Variables as `-f` flags, for values this module composed itself. */
    readonly variables?: ReadonlyArray<readonly [string, string]>;
    /**
     * Variables carrying words the reader typed. Document and variables travel over stdin
     * together, because argv is visible in process listings and is echoed back inside a
     * process-runner failure message.
     */
    readonly privateVariables?: Readonly<Record<string, string>>;
    readonly query: string;
    readonly decode: (raw: string) => Result.Result<A, unknown>;
  }): Effect.Effect<A, GitHubPullRequestCliError> => {
    return graphQlBudget
      .query(
        input.host,
        input.query,
        input.allowReserve === true ? { allowReserve: true } : undefined,
      )
      .pipe(
        Effect.flatMap((query) =>
          github.execute(
            input.privateVariables === undefined
              ? {
                  cwd: input.cwd,
                  args: [
                    "api",
                    "graphql",
                    "--hostname",
                    input.host,
                    ...(input.variables ?? []).flat(),
                    "-f",
                    `query=${query}`,
                  ],
                }
              : {
                  cwd: input.cwd,
                  args: ["api", "graphql", "--hostname", input.host, "--input", "-"],
                  stdin: encodeGraphQlRequestJson({
                    query,
                    variables: input.privateVariables,
                  }),
                },
          ),
        ),
        Effect.tap((result) => graphQlBudget.observe(input.host, result.stdout)),
        Effect.flatMap((result) => {
          const decoded = input.decode(result.stdout.trim());
          return Result.isSuccess(decoded)
            ? Effect.succeed(decoded.success)
            : Effect.fail(
                new GitHubPullRequestReadError({
                  command: "gh",
                  cwd: input.cwd,
                  operation: input.operation,
                  cause: decoded.failure,
                }),
              );
        }),
      );
  };

  /**
   * One page of the patch, read from the files API. GitHub refuses `pr diff` outright past 300
   * changed files, and still serves those files' hunks here.
   *
   * A page is a whole number of files, so each one parses on its own; the caller carries on from
   * `nextCursor` for as long as GitHub keeps handing pages back.
   *
   * A named commit is read from the commit endpoint, which lists the same file entries and pages
   * them the same way — only wrapped in an object, which jq unwraps before they are decoded.
   */
  const diffFilesPage = (input: {
    readonly cwd: string;
    readonly repository: string;
    readonly host: string;
    readonly number: number;
    readonly page: number;
    readonly commit?: string | undefined;
  }): Effect.Effect<GitHubPullRequestDiffSlice, GitHubPullRequestCliError> => {
    const { owner, name } = parseRepositorySelector(input.repository);
    const paging = `per_page=${DIFF_FILES_PAGE_SIZE}&page=${input.page}`;
    return github
      .execute({
        cwd: input.cwd,
        args: [
          "api",
          "--hostname",
          input.host,
          input.commit === undefined
            ? `repos/${owner}/${name}/pulls/${input.number}/files?${paging}`
            : `repos/${owner}/${name}/commits/${input.commit}?${paging}`,
          // An empty commit carries no `files` at all, which is a commit with nothing in it
          // rather than an answer that could not be read.
          ...(input.commit === undefined ? [] : ["--jq", ".files // []"]),
        ],
        maxOutputBytes: DIFF_MAX_OUTPUT_BYTES,
        timeoutMs: DIFF_TIMEOUT_MS,
      })
      .pipe(
        Effect.flatMap((result) => {
          // Checked before decoding: a byte-truncated response is a JSON prefix, which would
          // fail to parse. Nothing of this page can be shown, and an empty patch would render
          // as a change with no files rather than as the failure it is; slices already handed
          // over stay with the reader either way.
          if (result.stdoutTruncated) {
            return Effect.fail(
              new GitHubPullRequestReadError({
                command: "gh",
                cwd: input.cwd,
                operation: "getPullRequestDiff",
                cause: new Error(`Page ${input.page} of the changed files was too large to read.`),
              }),
            );
          }
          const decoded = decodePullRequestFilesJson(result.stdout.trim());
          if (!Result.isSuccess(decoded)) {
            return Effect.fail(
              new GitHubPullRequestReadError({
                command: "gh",
                cwd: input.cwd,
                operation: "getPullRequestDiff",
                cause: decoded.failure,
              }),
            );
          }
          // Counted before decoding, so a page whose files all failed to decode still moves on
          // rather than pointing the reader back at the page it just read.
          const morePages = decoded.success.rawCount >= DIFF_FILES_PAGE_SIZE;
          return Effect.succeed({
            patch: decoded.success.patch,
            truncated: decoded.success.truncated,
            nextCursor: morePages ? String(input.page + 1) : null,
            ...(decoded.success.omittedFileStats.length === 0
              ? {}
              : { omittedFileStats: decoded.success.omittedFileStats }),
          });
        }),
      );
  };

  const getPullRequestDiffFileContents: GitHubPullRequestCli["Service"]["getPullRequestDiffFileContents"] =
    (input) =>
      Effect.gen(function* () {
        if (input.commit !== undefined && !isCommitSha(input.commit)) {
          return yield* new GitHubDiffCommitError({ command: "gh", cwd: input.cwd });
        }
        const { owner, name } = parseRepositorySelector(input.repository);
        const refsResult = yield* github.execute({
          cwd: input.cwd,
          args: [
            "api",
            "--hostname",
            input.host,
            input.commit === undefined
              ? `repos/${owner}/${name}/pulls/${input.number}`
              : `repos/${owner}/${name}/commits/${input.commit}`,
            "--jq",
            input.commit === undefined
              ? "[.base.sha, .head.sha] | @tsv"
              : "[.parents[0].sha, .sha] | @tsv",
          ],
          maxOutputBytes: 1024,
          timeoutMs: DIFF_TIMEOUT_MS,
        });
        // Keep a leading tab: a root commit has no parent, and jq represents that absent old
        // revision as the empty field before the tab. Every file in it is new, so that is a
        // usable answer whenever the caller does not need the old side.
        const [baseRef, headRef, ...extraRefs] = refsResult.stdout.trimEnd().split("\t");
        const rootCommitNewFile =
          input.commit !== undefined && input.changeType === "new" && baseRef === "";
        if (
          refsResult.stdoutTruncated ||
          !headRef ||
          extraRefs.length > 0 ||
          (!rootCommitNewFile && (baseRef === undefined || !isCommitSha(baseRef))) ||
          !isCommitSha(headRef)
        ) {
          return yield* new GitHubDiffRevisionsUnavailableError({
            command: "gh",
            cwd: input.cwd,
            number: input.number,
            ...(input.commit === undefined ? {} : { commit: input.commit }),
          });
        }

        const readFile = (revision: string, filePath: string) =>
          github
            .execute({
              cwd: input.cwd,
              args: [
                "api",
                "--hostname",
                input.host,
                "--header",
                "Accept: application/vnd.github.raw+json",
                `repos/${owner}/${name}/contents/${filePath
                  .split("/")
                  .map(encodeURIComponent)
                  .join("/")}?ref=${encodeURIComponent(revision)}`,
              ],
              maxOutputBytes: DIFF_FILE_MAX_OUTPUT_BYTES,
              timeoutMs: DIFF_TIMEOUT_MS,
            })
            .pipe(
              Effect.flatMap((result) =>
                result.stdoutTruncated ||
                result.stdout.includes("\0") ||
                result.stdoutInvalidUtf8 === true
                  ? Effect.fail(
                      new GitHubDiffFileContentsUnavailableError({
                        command: "gh",
                        cwd: input.cwd,
                        path: filePath,
                        reason: result.stdoutTruncated ? "oversized" : "binary",
                      }),
                    )
                  : Effect.succeed(result.stdout),
              ),
            );

        const [oldContents, newContents] = yield* Effect.all(
          [
            input.changeType === "new" ? Effect.succeed("") : readFile(baseRef, input.oldPath),
            input.changeType === "deleted" ? Effect.succeed("") : readFile(headRef, input.newPath),
          ],
          { concurrency: 2 },
        );
        return { oldContents, newContents };
      });

  const getPullRequestDetail: GitHubPullRequestCli["Service"]["getPullRequestDetail"] = (input) =>
    github
      .execute({
        cwd: input.cwd,
        args: [
          "pr",
          "view",
          String(input.number),
          ...repositoryArgs(input),
          "--json",
          PULL_REQUEST_DETAIL_JSON_FIELDS,
        ],
      })
      .pipe(
        Effect.flatMap((result) => {
          const decoded = decodePullRequestDetailJson(result.stdout.trim());
          return Result.isSuccess(decoded)
            ? Effect.succeed(decoded.success)
            : Effect.fail(
                new GitHubPullRequestReadError({
                  command: "gh",
                  cwd: input.cwd,
                  operation: "getPullRequestDetail",
                  cause: decoded.failure,
                }),
              );
        }),
      );

  const workflowApprovalLimit = 1_000;
  const workflowApprovalProbeLimit = String(workflowApprovalLimit + 1);
  const workflowApprovalReadError = (cwd: string, cause: unknown) =>
    new GitHubPullRequestReadError({
      command: "gh",
      cwd,
      operation: "listWorkflowRunsRequiringApproval",
      cause,
    });
  const listWorkflowRunsRequiringApproval: GitHubPullRequestCli["Service"]["listWorkflowRunsRequiringApproval"] =
    (input) =>
      github
        .execute({
          cwd: input.cwd,
          args: [
            "pr",
            "list",
            ...repositoryArgs(input),
            "--state",
            "open",
            "--head",
            input.headBranch,
            "--limit",
            workflowApprovalProbeLimit,
            "--json",
            "number,headRefOid,isCrossRepository,headRepositoryOwner",
          ],
        })
        .pipe(
          Effect.flatMap(
            (
              result,
            ): Effect.Effect<
              GitHubPullRequestHead,
              GitHubPullRequestReadError | GitHubWorkflowApprovalRefusedError
            > => {
              const decoded = decodePullRequestHeadsJson(result.stdout.trim());
              if (!Result.isSuccess(decoded)) {
                return Effect.fail(workflowApprovalReadError(input.cwd, decoded.failure));
              }
              const exactHeads = decoded.success.filter(
                (pullRequest) =>
                  pullRequest.headSha === input.headSha &&
                  pullRequest.isCrossRepository === true &&
                  pullRequest.headRepositoryOwner?.toLowerCase() ===
                    input.headRepositoryOwner.toLowerCase(),
              );
              if (decoded.success.length > workflowApprovalLimit) {
                return Effect.fail(
                  new GitHubWorkflowApprovalRefusedError({
                    command: "gh",
                    cwd: input.cwd,
                    number: input.number,
                    reason: "head-list-truncated",
                    observedCount: decoded.success.length,
                    limit: workflowApprovalLimit,
                  }),
                );
              }
              if (exactHeads.length !== 1 || exactHeads[0]?.number !== input.number) {
                return Effect.fail(
                  new GitHubWorkflowApprovalRefusedError({
                    command: "gh",
                    cwd: input.cwd,
                    number: input.number,
                    reason: "head-not-unique",
                    observedCount: exactHeads.length,
                    limit: workflowApprovalLimit,
                  }),
                );
              }
              return Effect.succeed(exactHeads[0]);
            },
          ),
          Effect.flatMap(() =>
            github.execute({
              cwd: input.cwd,
              args: [
                "run",
                "list",
                ...repositoryArgs(input),
                "--commit",
                input.headSha,
                "--branch",
                input.headBranch,
                "--event",
                "pull_request",
                "--status",
                "action_required",
                "--limit",
                workflowApprovalProbeLimit,
                "--json",
                "databaseId,workflowName,url",
              ],
            }),
          ),
          Effect.flatMap(
            (
              result,
            ): Effect.Effect<
              ReadonlyArray<GitHubWorkflowRunApproval>,
              GitHubPullRequestReadError | GitHubWorkflowApprovalRefusedError
            > => {
              const decoded = decodeWorkflowRunApprovalsJson(result.stdout.trim());
              if (!Result.isSuccess(decoded)) {
                return Effect.fail(workflowApprovalReadError(input.cwd, decoded.failure));
              }
              return decoded.success.length > workflowApprovalLimit
                ? Effect.fail(
                    new GitHubWorkflowApprovalRefusedError({
                      command: "gh",
                      cwd: input.cwd,
                      number: input.number,
                      reason: "run-list-truncated",
                      observedCount: decoded.success.length,
                      limit: workflowApprovalLimit,
                    }),
                  )
                : Effect.succeed(decoded.success);
            },
          ),
        );

  return GitHubPullRequestCli.of({
    getViewerLogin: (input) =>
      github.execute({ cwd: input.cwd, args: ["api", "user", "--jq", ".login"] }).pipe(
        Effect.flatMap((result) => {
          const login = result.stdout.trim();
          return login.length > 0
            ? Effect.succeed(login)
            : Effect.fail(new GitHubViewerLoginUnavailableError({ command: "gh", cwd: input.cwd }));
        }),
      ),

    getPullRequestSummary: (input) =>
      github
        .getPullRequest({
          cwd: input.cwd,
          reference: `https://${input.host}/${input.repository}/pull/${input.number}`,
        })
        .pipe(
          Effect.flatMap((summary) =>
            summary.updatedAt === undefined
              ? Effect.fail(
                  new GitHubPullRequestUpdatedAtUnavailableError({
                    command: "gh",
                    cwd: input.cwd,
                    repository: input.repository,
                    number: input.number,
                  }),
                )
              : Effect.succeed({
                  number: summary.number,
                  title: summary.title,
                  url: summary.url,
                  headBranch: summary.headRefName,
                  baseBranch: summary.baseRefName,
                  state: summary.state ?? "open",
                  ...(summary.isDraft === true ? { isDraft: true } : {}),
                  closedAt: summary.closedAt ?? null,
                  mergedAt: summary.mergedAt ?? null,
                  updatedAt: summary.updatedAt,
                }),
          ),
        ),

    getPullRequestDetail,
    listWorkflowRunsRequiringApproval,

    getPullRequestBaseComparison: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return graphqlRead({
        cwd: input.cwd,
        host: input.host,
        operation: "getPullRequestBaseComparison",
        ...(input.allowReserve === true ? { allowReserve: true } : {}),
        variables: [
          ["-f", `owner=${owner}`],
          ["-f", `name=${name}`],
          ["-F", `number=${input.number}`],
          ["-f", `headRef=${input.headRef}`],
        ],
        query: BASE_COMPARISON_GRAPHQL_QUERY,
        decode: decodeBaseComparisonJson,
      });
    },

    getPullRequestActivity: (input) =>
      github
        .execute({
          cwd: input.cwd,
          args: [
            "pr",
            "view",
            String(input.number),
            ...repositoryArgs(input),
            "--json",
            PULL_REQUEST_ACTIVITY_JSON_FIELDS,
          ],
        })
        .pipe(
          Effect.flatMap((result) => {
            const decoded = decodePullRequestActivityJson(result.stdout.trim());
            return Result.isSuccess(decoded)
              ? Effect.succeed(decoded.success)
              : Effect.fail(
                  new GitHubPullRequestReadError({
                    command: "gh",
                    cwd: input.cwd,
                    operation: "getPullRequestActivity",
                    cause: decoded.failure,
                  }),
                );
          }),
        ),

    getPullRequestDiff: (input) => {
      const filesPage = (page: number) =>
        diffFilesPage({
          cwd: input.cwd,
          repository: input.repository,
          host: input.host,
          number: input.number,
          page,
          ...(input.commit === undefined ? {} : { commit: input.commit }),
        });
      if (input.commit !== undefined && !isCommitSha(input.commit)) {
        return Effect.fail(new GitHubDiffCommitError({ command: "gh", cwd: input.cwd }));
      }
      // A cursor only ever comes from the files walk, so a reader carrying one is already past
      // the point where `gh pr diff` had anything to say.
      if (input.cursor !== undefined) {
        const page = diffCursorPage(input.cursor);
        return page === null
          ? Effect.fail(new GitHubDiffCursorError({ command: "gh", cwd: input.cwd }))
          : filesPage(page);
      }
      // `gh pr diff` speaks for the whole pull request and has no way to name one commit of it.
      if (input.commit !== undefined) {
        return filesPage(1);
      }
      return github
        .execute({
          cwd: input.cwd,
          args: ["pr", "diff", String(input.number), ...repositoryArgs(input), "--color", "never"],
          maxOutputBytes: DIFF_MAX_OUTPUT_BYTES,
          timeoutMs: DIFF_TIMEOUT_MS,
        })
        .pipe(
          Effect.flatMap((result) =>
            // A patch cut at a byte boundary ends mid-file, which is neither a whole slice nor
            // something the reader can carry on from. The files API can serve the same change a
            // whole number of files at a time, so an oversized patch takes that road as well.
            result.stdoutTruncated
              ? filesPage(1)
              : // One read served the whole patch, so there is no next slice to ask for.
                Effect.succeed({ patch: result.stdout, truncated: false, nextCursor: null }),
          ),
          // GitHub answers 406 rather than a diff past 300 changed files, so the patch is read
          // from the files API instead, a page per call. Only once the direct read has failed: a
          // pull request GitHub will serve a diff for must not pay for a second request. A
          // fallback that fails too reports the original refusal, which is the one that explains
          // the page. Narrowed to a command that ran and was refused: a missing `gh` or a
          // signed-out one fails the same way for every request.
          Effect.catchTags({
            GitHubCliCommandError: (error) => filesPage(1).pipe(Effect.mapError(() => error)),
          }),
        );
    },

    getPullRequestDiffFileContents,

    getReviewThreadComments: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return graphqlRead({
        cwd: input.cwd,
        host: input.host,
        operation: "getReviewThreadComments",
        variables: [
          ["-f", `owner=${owner}`],
          ["-f", `name=${name}`],
          ["-F", `number=${input.number}`],
          ["-f", `threadId=${input.threadId}`],
          cursorVariable(input.cursor),
        ],
        query: REVIEW_THREAD_COMMENTS_GRAPHQL_QUERY,
        decode: decodeReviewThreadCommentsJson,
      }).pipe(
        Effect.flatMap(({ belongsToPullRequest, comments, nextCursor }) =>
          belongsToPullRequest
            ? Effect.succeed({ comments, nextCursor })
            : Effect.fail(
                new GitHubSubjectScopeError({
                  command: "gh",
                  cwd: input.cwd,
                  operation: "getReviewThreadComments",
                }),
              ),
        ),
      );
    },

    listReviewThreadComments: (input) =>
      Effect.gen(function* () {
        const { owner, name } = parseRepositorySelector(input.repository);
        const threadPage = (
          cursor: string | null,
        ): Effect.Effect<GitHubReviewThreadPage, GitHubPullRequestCliError> =>
          graphqlRead({
            cwd: input.cwd,
            host: input.host,
            operation: "listReviewThreadComments",
            variables: [
              ["-f", `owner=${owner}`],
              ["-f", `name=${name}`],
              ["-F", `number=${input.number}`],
              cursorVariable(cursor),
            ],
            query: REVIEW_THREADS_GRAPHQL_QUERY,
            decode: decodeReviewThreadsJson,
          });
        const entries: GitHubReviewThreadEntry[] = [];
        const avatarsByLogin = new Map<string, string>();
        const commitStats = new Map<
          string,
          { readonly additions: number; readonly deletions: number }
        >();
        let reviewers: ReadonlyArray<PullRequestActor> = [];
        let reactions: GitHubReviewThreadPage["reactions"] = [];
        const reactionsById = new Map<string, ReadonlyArray<PullRequestReaction>>();
        let commits: GitHubReviewThreadPage["commits"] = [];
        let viewer: GitHubReviewThreadPage["viewer"] = { canUpdate: true, didAuthor: false };
        const dismissalsByReviewId = new Map<string, string>();
        let dismissalCursor: string | null = null;
        let cursor: string | null = null;
        let page = 0;
        do {
          const read: GitHubReviewThreadPage = yield* threadPage(cursor);
          entries.push(...read.threads);
          for (const [login, avatarUrl] of read.avatarsByLogin)
            avatarsByLogin.set(login, avatarUrl);
          // The roster, the commits and the viewer's standing travel with every page, and the
          // first one already carries all of them.
          if (page === 0) {
            reviewers = read.reviewers;
            reactions = read.reactions;
            for (const [id, entry] of read.reactionsById) reactionsById.set(id, entry);
            commits = read.commits;
            viewer = read.viewer;
            for (const [id, message] of read.dismissalsByReviewId)
              dismissalsByReviewId.set(id, message);
            dismissalCursor = read.nextDismissalCursor;
            for (const [oid, stat] of read.commitStats) commitStats.set(oid, stat);
          }
          cursor = read.nextCursor;
          page += 1;
        } while (cursor !== null && page < REVIEW_THREAD_PAGES);

        // Almost never entered: the embedded page already holds every dismissal a pull request
        // ordinarily accrues. Followed so a review whose event fell past that page still finds
        // its reason.
        let dismissalPage = 0;
        while (dismissalCursor !== null && dismissalPage < REVIEW_THREAD_PAGES) {
          const read: {
            readonly dismissalsByReviewId: ReadonlyMap<string, string>;
            readonly nextCursor: string | null;
          } = yield* graphqlRead({
            cwd: input.cwd,
            host: input.host,
            operation: "listReviewThreadComments",
            variables: [
              ["-f", `owner=${owner}`],
              ["-f", `name=${name}`],
              ["-F", `number=${input.number}`],
              ["-f", `cursor=${dismissalCursor}`],
            ],
            query: REVIEW_DISMISSALS_GRAPHQL_QUERY,
            decode: decodeReviewDismissalsJson,
          });
          for (const [id, message] of read.dismissalsByReviewId)
            dismissalsByReviewId.set(id, message);
          dismissalCursor = read.nextCursor;
          dismissalPage += 1;
        }

        const reviewThreads = entries.map((entry) => ({
          ...entry.thread,
          commentCount: entry.commentCount,
          ...(entry.nextCommentCursor === null
            ? {}
            : { nextCommentsCursor: entry.nextCommentCursor }),
        }));
        return {
          comments: reviewThreadConversation(reviewThreads),
          dismissalsByReviewId,
          reviewThreads,
          // GitHub's own count of each thread, so the number the page shows is the host's even
          // where a bound kept some of the words on GitHub.
          commentCount: entries.reduce((total, entry) => total + entry.commentCount, 0),
          truncated: cursor !== null || entries.some((entry) => entry.nextCommentCursor !== null),
          reactions,
          reactionsById,
          reviewers,
          avatarsByLogin,
          commitStats,
          commits,
          viewer,
        };
      }),

    getRepositoryAccess: (input) =>
      github
        .execute({
          cwd: input.cwd,
          args: [
            "repo",
            "view",
            `${input.host}/${input.repository}`,
            "--json",
            REPOSITORY_ACCESS_JSON_FIELDS,
          ],
        })
        .pipe(
          Effect.flatMap((result) => {
            const decoded = decodeRepositoryAccessJson(result.stdout.trim());
            return Result.isSuccess(decoded)
              ? Effect.succeed(decoded.success)
              : Effect.fail(
                  new GitHubPullRequestReadError({
                    command: "gh",
                    cwd: input.cwd,
                    operation: "getRepositoryAccess",
                    cause: decoded.failure,
                  }),
                );
          }),
        ),

    getViewerAccess: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return graphqlRead({
        cwd: input.cwd,
        host: input.host,
        operation: "getViewerAccess",
        ...(input.allowReserve === true ? { allowReserve: true } : {}),
        variables: [
          ["-f", `owner=${owner}`],
          ["-f", `name=${name}`],
          ["-F", `number=${input.number}`],
        ],
        query: VIEWER_PERMISSIONS_GRAPHQL_QUERY,
        decode: decodeViewerPermissionsJson,
      });
    },

    listReviewerCandidates: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return graphqlRead({
        cwd: input.cwd,
        host: input.host,
        operation: "listReviewerCandidates",
        allowReserve: true,
        variables: [
          ["-f", `owner=${owner}`],
          ["-f", `name=${name}`],
          ["-F", `number=${input.number}`],
        ],
        query: REVIEWER_CANDIDATES_GRAPHQL_QUERY,
        decode: decodeReviewerCandidatesJson,
      });
    },

    setReviewerRequest: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return github
        .execute({
          cwd: input.cwd,
          // Posting to a login GitHub has already been asked about is what a re-request is, so
          // there is nothing to say here about somebody who has reviewed once already. The body
          // travels over stdin for the reason every other one does: argv is visible in process
          // listings and echoed back inside process-runner failure messages.
          args: [
            "api",
            "--method",
            input.requested ? "POST" : "DELETE",
            "--hostname",
            input.host,
            `repos/${owner}/${name}/pulls/${input.number}/requested_reviewers`,
            "--input",
            "-",
          ],
          stdin: buildReviewerRequestJson(input.reviewers),
        })
        .pipe(Effect.asVoid);
    },

    listLabelCandidates: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return graphqlRead({
        cwd: input.cwd,
        host: input.host,
        operation: "listLabelCandidates",
        allowReserve: true,
        variables: [
          ["-f", `owner=${owner}`],
          ["-f", `name=${name}`],
          ["-F", `number=${input.number}`],
        ],
        query: LABEL_CANDIDATES_GRAPHQL_QUERY,
        decode: decodeLabelCandidatesJson,
      });
    },

    setLabels: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      // A pull request is an issue to the labels API. Adding posts a list and leaves what was
      // already there; taking off is one delete per label, since the endpoint names one in its
      // path. The name goes into the path encoded, because a label may carry a space or a slash.
      const issue = `repos/${owner}/${name}/issues/${input.number}/labels`;
      if (input.applied) {
        return github
          .execute({
            cwd: input.cwd,
            args: ["api", "--method", "POST", "--hostname", input.host, issue, "--input", "-"],
            stdin: buildLabelRequestJson(input.labels),
          })
          .pipe(Effect.asVoid);
      }
      return Effect.forEach(
        input.labels,
        (label) =>
          github.execute({
            cwd: input.cwd,
            args: [
              "api",
              "--method",
              "DELETE",
              "--hostname",
              input.host,
              `${issue}/${encodeURIComponent(label)}`,
            ],
          }),
        { concurrency: 1, discard: true },
      );
    },

    runPullRequestAction: (input) => {
      if (input.action === "revert") {
        return pullRequestNodeId({ ...input, operation: "revertPullRequest" }).pipe(
          Effect.flatMap((pullRequestId) =>
            graphql({
              cwd: input.cwd,
              host: input.host,
              query: REVERT_PULL_REQUEST_GRAPHQL_MUTATION,
              variables: { pullRequestId },
            }),
          ),
        );
      }
      if (input.action === "approve-workflows") {
        const { owner, name } = parseRepositorySelector(input.repository);
        return getPullRequestDetail(input).pipe(
          Effect.flatMap((detail) => {
            if (detail.isCrossRepository !== true) return Effect.void;
            if (detail.headSha == null || detail.headRepositoryOwner == null) {
              return Effect.fail(
                new GitHubWorkflowApprovalHeadUnavailableError({
                  command: "gh",
                  cwd: input.cwd,
                  number: input.number,
                }),
              );
            }
            const expectedHeadSha = detail.headSha;
            const expectedHeadBranch = detail.headBranch;
            const expectedHeadRepositoryOwner = detail.headRepositoryOwner;
            return listWorkflowRunsRequiringApproval({
              ...input,
              headSha: expectedHeadSha,
              headBranch: expectedHeadBranch,
              headRepositoryOwner: expectedHeadRepositoryOwner,
              isCrossRepository: true,
            }).pipe(
              Effect.flatMap((runs) =>
                Effect.forEach(
                  runs,
                  (run) =>
                    getPullRequestDetail(input).pipe(
                      Effect.flatMap((current) => {
                        if (current.headSha == null || current.headRepositoryOwner == null) {
                          return Effect.fail(
                            new GitHubWorkflowApprovalHeadUnavailableError({
                              command: "gh",
                              cwd: input.cwd,
                              number: input.number,
                            }),
                          );
                        }
                        if (
                          current.isCrossRepository !== true ||
                          current.headSha !== expectedHeadSha ||
                          current.headBranch !== expectedHeadBranch ||
                          current.headRepositoryOwner.toLowerCase() !==
                            expectedHeadRepositoryOwner.toLowerCase()
                        ) {
                          return Effect.fail(
                            new GitHubWorkflowApprovalHeadChangedError({
                              command: "gh",
                              cwd: input.cwd,
                              number: input.number,
                            }),
                          );
                        }
                        return listWorkflowRunsRequiringApproval({
                          ...input,
                          headSha: current.headSha,
                          headBranch: current.headBranch,
                          headRepositoryOwner: current.headRepositoryOwner,
                          isCrossRepository: true,
                        });
                      }),
                      Effect.flatMap((currentRuns) =>
                        currentRuns.some((current) => current.id === run.id)
                          ? github
                              .execute({
                                cwd: input.cwd,
                                args: [
                                  "api",
                                  "--method",
                                  "POST",
                                  "--hostname",
                                  input.host,
                                  `repos/${owner}/${name}/actions/runs/${run.id}/approve`,
                                  "--silent",
                                ],
                              })
                              .pipe(Effect.asVoid)
                          : Effect.void,
                      ),
                    ),
                  { concurrency: 1, discard: true },
                ),
              ),
            );
          }),
        );
      }
      const [subcommand, ...flags] = actionArgs(
        input.action,
        input.mergeMethod,
        input.updateMethod,
      );
      return github
        .execute({
          cwd: input.cwd,
          args: ["pr", subcommand!, String(input.number), ...repositoryArgs(input), ...flags],
        })
        .pipe(Effect.asVoid);
    },

    commentOnPullRequest: (input) =>
      github
        .execute({
          cwd: input.cwd,
          // The body travels over stdin: argv is visible in process listings and is echoed
          // back inside process-runner failure messages.
          args: [
            "pr",
            "comment",
            String(input.number),
            ...repositoryArgs(input),
            "--body-file",
            "-",
          ],
          stdin: input.body,
        })
        .pipe(Effect.asVoid),

    submitReview: (input) => {
      const { owner, name } = parseRepositorySelector(input.repository);
      return github
        .execute({
          cwd: input.cwd,
          // The whole review is one request, so nothing is visible to anyone else until the
          // verdict is sent. The payload travels over stdin for the same reason a comment
          // body does: argv is visible in process listings and echoed back in failures.
          args: [
            "api",
            "--method",
            "POST",
            "--hostname",
            input.host,
            `repos/${owner}/${name}/pulls/${input.number}/reviews`,
            "--input",
            "-",
          ],
          stdin: buildReviewSubmissionJson({
            verdict: input.verdict,
            body: input.body,
            comments: input.comments,
          }),
        })
        .pipe(Effect.asVoid);
    },

    replyToReviewThread: (input) =>
      graphql({
        cwd: input.cwd,
        host: input.host,
        query: REVIEW_THREAD_REPLY_GRAPHQL_MUTATION,
        variables: { threadId: input.threadId, body: input.body },
      }),

    setReviewThreadResolution: (input) =>
      graphql({
        cwd: input.cwd,
        host: input.host,
        query: input.resolved
          ? RESOLVE_REVIEW_THREAD_GRAPHQL_MUTATION
          : UNRESOLVE_REVIEW_THREAD_GRAPHQL_MUTATION,
        variables: { threadId: input.threadId },
      }),

    setReaction: (input) => {
      const givenSubjectId = input.subjectId;
      const subjectId =
        givenSubjectId === undefined
          ? pullRequestNodeId({ ...input, operation: "setReaction" })
          : subjectBelongsToPullRequest({
              ...input,
              subjectId: givenSubjectId,
              operation: "setReaction",
            }).pipe(
              Effect.flatMap((belongs) =>
                belongs
                  ? Effect.succeed(givenSubjectId)
                  : Effect.fail(
                      new GitHubSubjectScopeError({
                        command: "gh",
                        cwd: input.cwd,
                        operation: "setReaction",
                      }),
                    ),
              ),
            );
      return subjectId.pipe(
        Effect.flatMap((subjectId) =>
          graphql({
            cwd: input.cwd,
            host: input.host,
            query: input.reacted ? ADD_REACTION_GRAPHQL_MUTATION : REMOVE_REACTION_GRAPHQL_MUTATION,
            variables: { subjectId, content: gitHubReactionContent(input.content) },
          }),
        ),
      );
    },

    updatePullRequest: (input) =>
      pullRequestNodeId({ ...input, operation: "updatePullRequest" }).pipe(
        Effect.flatMap((pullRequestId) =>
          graphql({
            cwd: input.cwd,
            host: input.host,
            query: UPDATE_PULL_REQUEST_GRAPHQL_MUTATION,
            // A field the caller did not name is left out of the request entirely, so GitHub
            // keeps the words that are there rather than being asked for an empty one.
            variables: {
              pullRequestId,
              ...(input.title === undefined ? {} : { title: input.title }),
              ...(input.body === undefined ? {} : { body: input.body }),
            },
          }),
        ),
      ),

    updateComment: (input) =>
      subjectBelongsToPullRequest({
        cwd: input.cwd,
        repository: input.repository,
        host: input.host,
        number: input.number,
        subjectId: input.commentId,
        operation: "updateComment",
      }).pipe(
        Effect.flatMap((belongs) =>
          belongs
            ? Effect.succeed(input.commentId)
            : Effect.fail(
                new GitHubSubjectScopeError({
                  command: "gh",
                  cwd: input.cwd,
                  operation: "updateComment",
                }),
              ),
        ),
        Effect.flatMap((commentId) =>
          graphql({
            cwd: input.cwd,
            host: input.host,
            query:
              input.kind === "issue-comment"
                ? UPDATE_ISSUE_COMMENT_GRAPHQL_MUTATION
                : UPDATE_REVIEW_COMMENT_GRAPHQL_MUTATION,
            variables: { commentId, body: input.body },
          }),
        ),
      ),
  });
});

export const layer = Layer.effect(GitHubPullRequestCli, make);
