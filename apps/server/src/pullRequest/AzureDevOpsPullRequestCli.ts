import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type {
  PullRequestAction,
  PullRequestComment,
  PullRequestMergeMethod,
} from "@t3tools/contracts";

import * as AzureDevOpsCli from "../sourceControl/AzureDevOpsCli.ts";
import {
  decodePullRequestJson,
  decodeThreadsJson,
  decodeViewerJson,
  type AzureDevOpsPullRequest,
} from "./azureDevOpsPullRequestJson.ts";

/**
 * Names the read that produced unusable output, so a failure reports the call it came from
 * rather than borrowing another operation's message.
 */
class AzureDevOpsPullRequestReadError extends Schema.TaggedError<AzureDevOpsPullRequestReadError>()(
  "AzureDevOpsPullRequestReadError",
  {
    command: Schema.Literal("az"),
    cwd: Schema.String,
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {
  get detail(): string {
    return `Azure CLI returned an unreadable ${this.operation} response.`;
  }

  override get message(): string {
    return `Azure CLI failed in ${this.operation}: ${this.detail}`;
  }
}

/** Not a decode failure: az answered, the account it answered for just has no name. */
class AzureDevOpsViewerUnavailableError extends Schema.TaggedError<AzureDevOpsViewerUnavailableError>()(
  "AzureDevOpsViewerUnavailableError",
  {
    command: Schema.Literal("az"),
    cwd: Schema.String,
  },
) {
  get detail(): string {
    return "Azure CLI returned no account for the current sign-in.";
  }

  override get message(): string {
    return `Azure CLI failed in getViewer: ${this.detail}`;
  }
}

/**
 * Not a decode failure either: az answered with a well-formed pull request that simply carries
 * no branch or link, which is a response this cannot place rather than one it cannot read.
 */
class AzureDevOpsPullRequestIncompleteError extends Schema.TaggedError<AzureDevOpsPullRequestIncompleteError>()(
  "AzureDevOpsPullRequestIncompleteError",
  {
    command: Schema.Literal("az"),
    cwd: Schema.String,
    number: Schema.Int,
  },
) {
  get detail(): string {
    return "Azure DevOps returned no branch or link for the pull request.";
  }

  override get message(): string {
    return `Azure CLI failed in getPullRequest: ${this.detail}`;
  }
}

/**
 * Not a decode failure: the reader named a reviewer `az` would read as a flag of its own. The
 * reviewers travel as argv rather than in a request body — `az repos pr reviewer` takes them no
 * other way — so anything that could leave the value position is refused rather than sent.
 */
class AzureDevOpsReviewerNameError extends Schema.TaggedError<AzureDevOpsReviewerNameError>()(
  "AzureDevOpsReviewerNameError",
  {
    command: Schema.Literal("az"),
    cwd: Schema.String,
  },
) {
  get detail(): string {
    return "A reviewer is named by an email address or an identity id.";
  }

  override get message(): string {
    return `Azure CLI failed in setPullRequestReviewers: ${this.detail}`;
  }
}

export type AzureDevOpsPullRequestCliError =
  | AzureDevOpsCli.AzureDevOpsCliError
  | AzureDevOpsPullRequestReadError
  | AzureDevOpsPullRequestIncompleteError
  | AzureDevOpsReviewerNameError
  | AzureDevOpsViewerUnavailableError;

/** The version every REST call below is pinned to, so a new default cannot reshape a response. */
const REST_API_VERSION = "7.1";

export class AzureDevOpsPullRequestCli extends Context.Service<
  AzureDevOpsPullRequestCli,
  {
    readonly getViewer: (input: {
      readonly cwd: string;
    }) => Effect.Effect<string, AzureDevOpsPullRequestCliError>;

    readonly getPullRequest: (input: {
      readonly cwd: string;
      readonly number: number;
    }) => Effect.Effect<AzureDevOpsPullRequest, AzureDevOpsPullRequestCliError>;

    /** Threads are not reachable through `az repos pr`, so they come from the REST API. */
    readonly listThreads: (input: {
      readonly cwd: string;
      readonly threadsUrl: string;
    }) => Effect.Effect<ReadonlyArray<PullRequestComment>, AzureDevOpsPullRequestCliError>;

    readonly runPullRequestAction: (input: {
      readonly cwd: string;
      readonly number: number;
      readonly action: PullRequestAction;
      readonly mergeMethod?: PullRequestMergeMethod;
    }) => Effect.Effect<void, AzureDevOpsPullRequestCliError>;

    /** Rewrites the pull request's own words, through the same command that moves it. */
    readonly updatePullRequest: (input: {
      readonly cwd: string;
      readonly number: number;
      readonly title?: string | undefined;
      readonly body?: string | undefined;
    }) => Effect.Effect<void, AzureDevOpsPullRequestCliError>;

    /**
     * Adds reviewers to a pull request, or takes them off it. `az repos pr reviewer` is the whole
     * of what Azure offers here: it adds and removes named identities, and has no counterpart that
     * says who could be named.
     */
    readonly setPullRequestReviewers: (input: {
      readonly cwd: string;
      readonly number: number;
      readonly reviewers: ReadonlyArray<string>;
      readonly requested: boolean;
    }) => Effect.Effect<void, AzureDevOpsPullRequestCliError>;
  }
>()("t3/pullRequest/AzureDevOpsPullRequestCli") {}

/**
 * Azure moves a pull request by setting its state rather than by named commands: completing it
 * is the merge, abandoning it is the close, and reactivating it is the reopen. Squashing is a
 * completion option rather than a strategy of its own.
 */
function actionArgs(
  action: PullRequestAction,
  mergeMethod: PullRequestMergeMethod | undefined,
): ReadonlyArray<string> {
  switch (action) {
    case "merge":
      return ["--status", "completed", "--squash", mergeMethod === "squash" ? "true" : "false"];
    // Auto-complete is Azure's own name for it: the pull request stays active and Azure completes
    // it once its policies pass. The squash choice is stored with it, as it is for a merge now.
    case "enable-auto-merge":
      return [
        "--auto-complete",
        "true",
        ...(mergeMethod === undefined
          ? []
          : ["--squash", mergeMethod === "squash" ? "true" : "false"]),
      ];
    case "disable-auto-merge":
      return ["--auto-complete", "false"];
    case "ready":
      return ["--draft", "false"];
    case "draft":
      return ["--draft", "true"];
    case "close":
      return ["--status", "abandoned"];
    // Never reached: this host does not declare the action, so nothing offers it.
    case "update-branch":
      return [];
    case "reopen":
      return ["--status", "active"];
    // Never reached: this host does not declare the action, so the service refuses it first.
    case "revert":
    case "approve-workflows":
      throw new Error(`Azure DevOps pull request action ${action} is unsupported`);
  }
}

/**
 * A reviewer Azure could be given: an email address, a display name or an identity guid, and
 * nothing that starts with a dash. The dash is the whole point — these are argv, and a value that
 * looks like a flag stops being a value.
 */
function isReviewerName(value: string): boolean {
  const name = value.trim();
  return name.length > 0 && !name.startsWith("-");
}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const azure = yield* AzureDevOpsCli.AzureDevOpsCli;

  // Every command resolves the organization, project and repository from the checkout, which is
  // what the rest of the Azure wrapper does. The remote takes three shapes and only `az` knows
  // how to read all of them.
  const detectArgs = ["--detect", "true"] as const;

  const executeJson = (input: { readonly cwd: string; readonly args: ReadonlyArray<string> }) =>
    azure.execute({
      cwd: input.cwd,
      args: [...input.args, "--only-show-errors", "--output", "json"],
    });

  return AzureDevOpsPullRequestCli.of({
    getViewer: (input) =>
      executeJson({ cwd: input.cwd, args: ["account", "show", "--query", "user"] }).pipe(
        Effect.flatMap((result): Effect.Effect<string, AzureDevOpsPullRequestCliError> => {
          // `--query user` narrows the payload to the account, so it is nested back under the
          // key the decoder reads to keep one shape for the signed-in user.
          const decoded = decodeViewerJson(`{"user":${result.stdout.trim() || "null"}}`);
          if (!Result.isSuccess(decoded)) {
            return Effect.fail(
              new AzureDevOpsPullRequestReadError({
                command: "az",
                cwd: input.cwd,
                operation: "getViewer",
                cause: decoded.failure,
              }),
            );
          }
          return decoded.success === null
            ? Effect.fail(new AzureDevOpsViewerUnavailableError({ command: "az", cwd: input.cwd }))
            : Effect.succeed(decoded.success);
        }),
      ),

    getPullRequest: (input) =>
      executeJson({
        cwd: input.cwd,
        args: ["repos", "pr", "show", ...detectArgs, "--id", String(input.number)],
      }).pipe(
        Effect.flatMap(
          (result): Effect.Effect<AzureDevOpsPullRequest, AzureDevOpsPullRequestCliError> => {
            const decoded = decodePullRequestJson(result.stdout.trim());
            if (!Result.isSuccess(decoded)) {
              return Effect.fail(
                new AzureDevOpsPullRequestReadError({
                  command: "az",
                  cwd: input.cwd,
                  operation: "getPullRequest",
                  cause: decoded.failure,
                }),
              );
            }
            // Null means Azure answered with too little to place the pull request. Nothing
            // failed underneath it, so it is its own outcome rather than a decode failure.
            return decoded.success === null
              ? Effect.fail(
                  new AzureDevOpsPullRequestIncompleteError({
                    command: "az",
                    cwd: input.cwd,
                    number: input.number,
                  }),
                )
              : Effect.succeed(decoded.success);
          },
        ),
      ),

    listThreads: (input) =>
      executeJson({
        cwd: input.cwd,
        args: [
          "rest",
          "--method",
          "get",
          "--url",
          `${input.threadsUrl}?api-version=${REST_API_VERSION}`,
        ],
      }).pipe(
        Effect.flatMap((result) => {
          const decoded = decodeThreadsJson(result.stdout.trim());
          return Result.isSuccess(decoded)
            ? Effect.succeed(decoded.success)
            : Effect.fail(
                new AzureDevOpsPullRequestReadError({
                  command: "az",
                  cwd: input.cwd,
                  operation: "listThreads",
                  cause: decoded.failure,
                }),
              );
        }),
      ),

    setPullRequestReviewers: (input) =>
      input.reviewers.some((reviewer) => !isReviewerName(reviewer))
        ? Effect.fail(new AzureDevOpsReviewerNameError({ command: "az", cwd: input.cwd }))
        : azure
            .execute({
              cwd: input.cwd,
              args: [
                "repos",
                "pr",
                "reviewer",
                input.requested ? "add" : "remove",
                ...detectArgs,
                "--id",
                String(input.number),
                // One `--reviewers` takes them all, because az reads the flag as a list and a
                // second one would replace the first rather than add to it.
                "--reviewers",
                ...input.reviewers,
                "--only-show-errors",
                "--output",
                "json",
              ],
            })
            .pipe(Effect.asVoid),

    runPullRequestAction: (input) =>
      azure
        .execute({
          cwd: input.cwd,
          args: [
            "repos",
            "pr",
            "update",
            ...detectArgs,
            "--id",
            String(input.number),
            ...actionArgs(input.action, input.mergeMethod),
            "--only-show-errors",
            "--output",
            "json",
          ],
        })
        .pipe(Effect.asVoid),

    updatePullRequest: (input) =>
      azure
        .execute({
          cwd: input.cwd,
          args: [
            "repos",
            "pr",
            "update",
            ...detectArgs,
            "--id",
            String(input.number),
            // One argument rather than a flag and a value beside it: a description usually opens
            // with a bullet, and az reads a dash in the next argv slot as a flag of its own.
            // `--description` also takes several strings, and this keeps the whole text as one.
            ...(input.title === undefined ? [] : [`--title=${input.title}`]),
            ...(input.body === undefined ? [] : [`--description=${input.body}`]),
            "--only-show-errors",
            "--output",
            "json",
          ],
        })
        .pipe(Effect.asVoid),
  });
});

export const layer = Layer.effect(AzureDevOpsPullRequestCli, make);
