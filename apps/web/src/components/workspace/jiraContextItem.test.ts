import type { JiraIssue } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { contextItemKey, upsertContextItem } from "../../lib/contextItem";
import { jiraContextItem } from "./jiraContextItem";

const issue: JiraIssue = {
  id: "10001",
  key: "OPS-42",
  summary: "Confirm release approval",
  issueType: "Risk",
  status: "In Progress",
  category: "indeterminate",
  assignee: "Jordan",
  priority: "High",
};

describe("jiraContextItem", () => {
  it("captures the loaded risk fields without inventing a refresh time", () => {
    const item = jiraContextItem(issue, "cloud-one", "https://example.atlassian.net/");
    expect(item).toMatchObject({
      source: "jira",
      sourceLabel: "Jira",
      sourceScope: "cloud-one",
      recordId: "OPS-42",
      title: "Confirm release approval",
      kind: "risk",
      url: "https://example.atlassian.net/browse/OPS-42",
    });
    expect(item.content).toContain("Status: In Progress\nAssignee: Jordan");
    expect(item.capturedAt).toBeUndefined();
    expect(upsertContextItem([], item)).toEqual([item]);
  });

  it("keeps the same issue key from different Jira clouds distinct", () => {
    const first = jiraContextItem(issue, "cloud-one", "https://one.atlassian.net");
    const second = jiraContextItem(issue, "cloud-two", "https://two.atlassian.net");
    expect(contextItemKey(first)).not.toBe(contextItemKey(second));
    expect(upsertContextItem([first], second)).toEqual([first, second]);
  });

  it("refreshes a selected record in place when added again", () => {
    const first = jiraContextItem(issue, "cloud-one", "https://example.atlassian.net");
    const updated = jiraContextItem(
      { ...issue, status: "Done", assignee: null, issueType: "Task" },
      "cloud-one",
      "https://example.atlassian.net",
    );
    expect(upsertContextItem([first], updated)).toEqual([updated]);
    expect(first.content).toContain("Status: In Progress");
    expect(updated.content).toContain("Status: Done\nAssignee: Unassigned");
    expect(updated.kind).toBe("issue");
  });

  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://user:secret@example.com",
    "not a URL",
  ])("retains the snapshot without exposing an unsafe source link: %s", (siteUrl) => {
    const item = jiraContextItem(issue, "cloud-one", siteUrl);
    expect(item.url).toBeUndefined();
    expect(item.content).toContain(issue.summary);
    expect(upsertContextItem([], item)).toEqual([item]);
  });
});
