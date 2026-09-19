import { afterEach, assert, expect, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as AzureDevOpsCli from "../sourceControl/AzureDevOpsCli.ts";
import * as AzureDevOpsPullRequestCli from "./AzureDevOpsPullRequestCli.ts";
import * as AzureDevOpsPullRequestProvider from "./AzureDevOpsPullRequestProvider.ts";

const mockedExecute = vi.fn<AzureDevOpsCli.AzureDevOpsCli["Service"]["execute"]>();

const layer = it.layer(
  AzureDevOpsPullRequestCli.layer.pipe(
    Layer.provide(
      Layer.mock(AzureDevOpsCli.AzureDevOpsCli)({
        execute: mockedExecute,
      }),
    ),
  ),
);

function output(stdout: string) {
  return {
    exitCode: ChildProcessSpawner.ExitCode(0),
    stdout,
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
  };
}

/** The arguments of the nth az invocation. */
function argsOfCall(index: number): ReadonlyArray<string> {
  const call = mockedExecute.mock.calls[index];
  assert.isDefined(call);
  return call[0].args;
}

afterEach(() => {
  mockedExecute.mockReset();
});

layer("AzureDevOpsPullRequestCli.layer", (it) => {
  it.effect("reads the signed-in account, which az reports as a bare value", () =>
    Effect.gen(function* () {
      // `--query user` unwraps the object, so the wrapper has to put it back.
      mockedExecute.mockReturnValueOnce(
        // @effect-diagnostics-next-line preferSchemaOverJson:off
        Effect.succeed(output(JSON.stringify({ name: "bilal@acme.dev", type: "user" }))),
      );
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const viewer = yield* cli.getViewer({ cwd: "/w" });

      assert.strictEqual(viewer, "bilal@acme.dev");
      expect(argsOfCall(0)).toEqual([
        "account",
        "show",
        "--query",
        "user",
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect("fails when nobody is signed in", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(Effect.succeed(output("")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const error = yield* Effect.flip(cli.getViewer({ cwd: "/w" }));

      assert.strictEqual(error._tag, "AzureDevOpsViewerUnavailableError");
    }),
  );

  it.effect("completes a pull request to merge it, squashing only when asked", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.runPullRequestAction({
        cwd: "/w",
        number: 42,
        action: "merge",
        mergeMethod: "squash",
      });

      expect(argsOfCall(0)).toEqual([
        "repos",
        "pr",
        "update",
        "--detect",
        "true",
        "--id",
        "42",
        "--status",
        "completed",
        "--squash",
        "true",
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect("stores the squash choice with an auto-completion, as a merge now does", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.runPullRequestAction({
        cwd: "/w",
        number: 42,
        action: "enable-auto-merge",
        mergeMethod: "squash",
      });

      expect(argsOfCall(0)).toEqual([
        "repos",
        "pr",
        "update",
        "--detect",
        "true",
        "--id",
        "42",
        "--auto-complete",
        "true",
        "--squash",
        "true",
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect.each([
    { action: "enable-auto-merge", expected: ["--auto-complete", "true"] },
    { action: "disable-auto-merge", expected: ["--auto-complete", "false"] },
    { action: "draft", expected: ["--draft", "true"] },
    { action: "ready", expected: ["--draft", "false"] },
    { action: "close", expected: ["--status", "abandoned"] },
    { action: "reopen", expected: ["--status", "active"] },
  ] as const)("moves a pull request with $action", ({ action, expected }) =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.runPullRequestAction({ cwd: "/w", number: 42, action });

      expect(argsOfCall(0)).toEqual([
        "repos",
        "pr",
        "update",
        "--detect",
        "true",
        "--id",
        "42",
        ...expected,
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect.each([
    { name: "a title", rewrite: { title: "Add the page" }, expected: ["--title=Add the page"] },
    {
      name: "a description",
      rewrite: { body: "Why the page changed" },
      expected: ["--description=Why the page changed"],
    },
    {
      name: "both",
      rewrite: { title: "Add the page", body: "Why the page changed" },
      expected: ["--title=Add the page", "--description=Why the page changed"],
    },
  ] as const)("rewrites $name, sending nothing it was not given", ({ rewrite, expected }) =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.updatePullRequest({ cwd: "/w", number: 42, ...rewrite });

      expect(argsOfCall(0)).toEqual([
        "repos",
        "pr",
        "update",
        "--detect",
        "true",
        "--id",
        "42",
        ...expected,
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect("sends a description that starts with a dash as one value, not as a flag", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.updatePullRequest({
        cwd: "/w",
        number: 42,
        body: "- rewrote the page\n- kept the rest",
      });

      // One argument, so the leading dash of an ordinary bullet list never reaches az as a flag,
      // and the whole text stays together where `--description` would otherwise take several.
      expect(argsOfCall(0)).toContain("--description=- rewrote the page\n- kept the rest");
    }),
  );

  it.effect("rewrites through the provider, which says it takes one", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValue(Effect.succeed(output("{}")));
      const provider = yield* AzureDevOpsPullRequestProvider.make;

      // False for a remark because nothing here can post one, so there is none to rewrite.
      expect(provider.capabilities.edit).toEqual({ changeRequest: true, comment: false });
      assert.isDefined(provider.updateChangeRequest);
      yield* provider.updateChangeRequest({
        cwd: "/w",
        repository: "web",
        host: "dev.azure.com",
        number: 42,
        title: "Add the page",
      });

      expect(argsOfCall(0)).toContain("--title=Add the page");
      expect(argsOfCall(0)).not.toContain("--description");
    }),
  );

  it.effect("reads the conversation through the REST API, pinned to a version", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(
        Effect.succeed(
          output(
            // @effect-diagnostics-next-line preferSchemaOverJson:off
            JSON.stringify({
              value: [
                {
                  id: 1,
                  comments: [
                    { id: 1, content: "Looks good.", publishedDate: "2026-07-02T00:00:00Z" },
                  ],
                },
              ],
            }),
          ),
        ),
      );
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const comments = yield* cli.listThreads({
        cwd: "/w",
        threadsUrl: "https://dev.azure.com/acme/platform/_apis/git/r/web/pullRequests/42/threads",
      });

      assert.strictEqual(comments.length, 1);
      expect(argsOfCall(0)).toContain("rest");
      expect(argsOfCall(0)).toContain(
        "https://dev.azure.com/acme/platform/_apis/git/r/web/pullRequests/42/threads?api-version=7.1",
      );
    }),
  );

  it.effect("reports a pull request it cannot place as its own outcome", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(
        Effect.succeed(
          output(
            // Well-formed, but with nothing to build a link from: not a decode failure.
            // @effect-diagnostics-next-line preferSchemaOverJson:off
            JSON.stringify({
              pullRequestId: 42,
              title: "Add the page",
              sourceRefName: "refs/heads/feat/page",
              targetRefName: "refs/heads/main",
              creationDate: "2026-07-01T00:00:00Z",
            }),
          ),
        ),
      );
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const error = yield* Effect.flip(cli.getPullRequest({ cwd: "/w", number: 42 }));

      assert.strictEqual(error._tag, "AzureDevOpsPullRequestIncompleteError");
    }),
  );

  it.effect("fails the read when az returns something unreadable", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(Effect.succeed(output('{"message":"not found"}')));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const error = yield* Effect.flip(cli.getPullRequest({ cwd: "/w", number: 42 }));

      assert.strictEqual(error._tag, "AzureDevOpsPullRequestReadError");
    }),
  );

  it.effect("adds reviewers with the one command Azure has for it", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(Effect.succeed(output("[]")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.setPullRequestReviewers({
        cwd: "/w",
        number: 42,
        reviewers: ["octocat@acme.test", "hubot@acme.test"],
        requested: true,
      });

      expect(argsOfCall(0)).toEqual([
        "repos",
        "pr",
        "reviewer",
        "add",
        "--detect",
        "true",
        "--id",
        "42",
        "--reviewers",
        "octocat@acme.test",
        "hubot@acme.test",
        "--only-show-errors",
        "--output",
        "json",
      ]);
    }),
  );

  it.effect("takes a reviewer off the pull request with the same command's counterpart", () =>
    Effect.gen(function* () {
      mockedExecute.mockReturnValueOnce(Effect.succeed(output("[]")));
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      yield* cli.setPullRequestReviewers({
        cwd: "/w",
        number: 42,
        reviewers: ["octocat@acme.test"],
        requested: false,
      });

      expect(argsOfCall(0)).toContain("remove");
    }),
  );

  it.effect("refuses a reviewer az would read as a flag, before running anything", () =>
    Effect.gen(function* () {
      const cli = yield* AzureDevOpsPullRequestCli.AzureDevOpsPullRequestCli;

      const error = yield* Effect.flip(
        cli.setPullRequestReviewers({
          cwd: "/w",
          number: 42,
          reviewers: ["--query"],
          requested: true,
        }),
      );

      assert.strictEqual(error._tag, "AzureDevOpsReviewerNameError");
      assert.strictEqual(mockedExecute.mock.calls.length, 0);
    }),
  );
});
