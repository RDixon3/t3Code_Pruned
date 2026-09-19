import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import {
  PullRequestActionInput,
  PullRequestCapabilities,
  PullRequestReviewerRequestInput,
} from "./pullRequest.ts";
const decodeReviewerRequest = Schema.decodeUnknownSync(PullRequestReviewerRequestInput);
const decodeAction = Schema.decodeUnknownSync(PullRequestActionInput);

describe("PullRequestReviewerRequestInput", () => {
  const ref = { projectId: "p1", repository: "acme/web", number: 1 };
  const reviewer = { id: "octocat", kind: "user" };

  it("carries the same shape whichever direction the request goes", () => {
    // One operation, turned around: `requested` is the whole difference between asking somebody
    // for a review and taking the request back.
    for (const requested of [true, false]) {
      expect(decodeReviewerRequest({ ...ref, reviewers: [reviewer], requested }).requested).toBe(
        requested,
      );
    }
  });

  it("refuses a request that names nobody, which no host would do anything with", () => {
    expect(() => decodeReviewerRequest({ ...ref, reviewers: [], requested: true })).toThrow();
  });

  it("bounds the reviewers, because they travel into a body the page composed", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `user${index}`, kind: "user" }));
    expect(
      decodeReviewerRequest({ ...ref, reviewers: many(25), requested: true }).reviewers,
    ).toHaveLength(25);
    expect(() => decodeReviewerRequest({ ...ref, reviewers: many(26), requested: true })).toThrow();
  });

  it("keeps a team apart from a person, which is a different thing to ask", () => {
    expect(
      decodeReviewerRequest({
        ...ref,
        reviewers: [reviewer, { id: "web-platform", kind: "team" }],
        requested: true,
      }).reviewers.map((entry) => entry.kind),
    ).toEqual(["user", "team"]);
  });
});

describe("updating a branch that has fallen behind its base", () => {
  const ref = { projectId: "project-1", repository: "acme/web", number: 7 };

  it("carries the way the branch should be brought up to date", () => {
    expect(decodeAction({ ...ref, action: "update-branch", updateMethod: "rebase" })).toMatchObject(
      {
        action: "update-branch",
        updateMethod: "rebase",
      },
    );
  });

  it("takes the action without a method, which is the host's own default", () => {
    expect(decodeAction({ ...ref, action: "update-branch" }).updateMethod).toBeUndefined();
  });

  it("refuses a way no host offers", () => {
    expect(() =>
      decodeAction({ ...ref, action: "update-branch", updateMethod: "squash" }),
    ).toThrow();
  });
});

describe("leaving a merge for the host to make once it is ready", () => {
  const ref = { projectId: "project-1", repository: "acme/web", number: 7 };

  it("carries the strategy the deferred merge should use, as merging now does", () => {
    expect(
      decodeAction({ ...ref, action: "enable-auto-merge", mergeMethod: "squash" }),
    ).toMatchObject({ action: "enable-auto-merge", mergeMethod: "squash" });
  });

  it("takes the arming back without a strategy, because there is nothing to choose", () => {
    expect(decodeAction({ ...ref, action: "disable-auto-merge" }).mergeMethod).toBeUndefined();
  });
});

describe("reverting a merged pull request", () => {
  it("carries the revert action without merge options", () => {
    const action = decodeAction({
      projectId: "project-1",
      repository: "acme/web",
      number: 7,
      action: "revert",
    });

    expect(action.action).toBe("revert");
    expect(action.mergeMethod).toBeUndefined();
  });
});

describe("approving fork workflows", () => {
  it("carries workflow approval as its own action", () => {
    const action = decodeAction({
      projectId: "project-1",
      repository: "acme/web",
      number: 7,
      action: "approve-workflows",
    });

    expect(action.action).toBe("approve-workflows");
  });
});

describe("PullRequestCapabilities", () => {
  const decodeCapabilities = Schema.decodeUnknownSync(PullRequestCapabilities);
  const base = {
    diff: true,
    comment: true,
    actions: [],
    mergeMethods: [],
    search: true,
    review: { inlineComment: true, reply: true, resolve: true, verdicts: [] },
    reviewers: { request: true, listCandidates: true },
  };

  it("decodes a server that says nothing about reactions as a server with none", () => {
    expect(decodeCapabilities(base).reactions).toBeUndefined();
  });
});
