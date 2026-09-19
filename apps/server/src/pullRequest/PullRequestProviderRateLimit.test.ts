import { assert, it } from "@effect/vitest";

import * as AzureDevOpsCli from "../sourceControl/AzureDevOpsCli.ts";
import * as GitHubCli from "../sourceControl/GitHubCli.ts";
import * as SourceControlRateLimit from "../sourceControl/SourceControlRateLimit.ts";
import { azureDevOpsProviderFailure } from "./AzureDevOpsPullRequestProvider.ts";
import { gitHubProviderFailure } from "./GitHubPullRequestProvider.ts";

const cause = new Error("redacted provider failure");

it("classifies rate limits from every pull-request provider", () => {
  assert.deepStrictEqual(
    gitHubProviderFailure(
      new GitHubCli.GitHubCliRateLimitError({ command: "gh", cwd: "/repo", cause }),
    ),
    { reason: "rate-limited" },
  );
  assert.deepStrictEqual(
    azureDevOpsProviderFailure(
      new AzureDevOpsCli.AzureDevOpsCliRateLimitError({
        operation: "execute",
        command: "az",
        cwd: "/repo",
        argumentCount: 1,
        cause,
      }),
    ),
    { reason: "rate-limited" },
  );
});

it("keeps GitHub's exact retry time", () => {
  assert.deepStrictEqual(
    gitHubProviderFailure(
      new SourceControlRateLimit.SourceControlRateLimitPausedError({
        provider: "github",
        host: "github.com",
        retryAt: 1_786_802_400_000,
      }),
    ),
    { reason: "rate-limited", retryAt: 1_786_802_400_000 },
  );
});
