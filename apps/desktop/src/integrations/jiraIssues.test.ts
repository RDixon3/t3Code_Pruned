import { describe, expect, it } from "vite-plus/test";
import {
  jiraStoryPointFields,
  jiraProjectQuery,
  parseJiraIssues,
  parseJiraTransitions,
} from "./jiraIssues.ts";

const issue = (category = "new") => ({
  id: "100",
  key: "TEAM-1",
  fields: {
    summary: "Project task",
    issuetype: { name: "Task" },
    status: { name: "Custom workflow status", statusCategory: { key: category } },
    assignee: null,
    priority: null,
  },
});
describe("Manage Jira data", () => {
  it("scopes the query to one project without a board, sprint, or label filter", () => {
    expect(jiraProjectQuery("TEAM")).toBe('project = "TEAM" ORDER BY updated DESC, key ASC');
    expect(() => jiraProjectQuery('TEAM" OR project != "TEAM')).toThrow("Invalid Jira project key");
  });
  it.each(["new", "indeterminate", "done"])(
    "uses the %s category independently of the status name",
    (category) => {
      expect(parseJiraIssues({ issues: [issue(category)], isLast: true }).issues[0]).toEqual({
        id: "100",
        key: "TEAM-1",
        summary: "Project task",
        issueType: "Task",
        status: "Custom workflow status",
        category,
        assignee: null,
        priority: null,
        storyPoints: null,
      });
    },
  );
  it("preserves Risk type, attribution, and priority", () => {
    const risk = issue();
    const fields = {
      ...risk.fields,
      issuetype: { name: "Risk" },
      assignee: { displayName: "Owner" },
      priority: { name: "High" },
    };
    expect(parseJiraIssues({ issues: [{ ...risk, fields }] }).issues[0]).toMatchObject({
      issueType: "Risk",
      assignee: "Owner",
      priority: "High",
    });
  });
  it("discovers story point fields without assuming a site's custom field IDs", () => {
    expect(
      jiraStoryPointFields({
        names: {
          customfield_12345: "Story Points",
          customfield_23456: "Story point estimate",
          customfield_999: "Budget",
        },
      }),
    ).toEqual(["customfield_12345", "customfield_23456"]);
    expect(jiraStoryPointFields({})).toEqual([]);
  });
  it.each([0, 3, 0.5, null, "3", -1, Infinity])("reads valid story points: %s", (points) => {
    const item = issue();
    expect(
      parseJiraIssues(
        { issues: [{ ...item, fields: { ...item.fields, customfield_12345: points } }] },
        undefined,
        ["customfield_12345"],
      ).issues[0]?.storyPoints,
    ).toBe(typeof points === "number" && Number.isFinite(points) && points >= 0 ? points : null);
  });
  it("does not choose between conflicting estimates", () => {
    const item = issue();
    expect(
      parseJiraIssues(
        {
          issues: [
            { ...item, fields: { ...item.fields, customfield_12345: 3, customfield_23456: 5 } },
          ],
        },
        undefined,
        ["customfield_12345", "customfield_23456"],
      ).issues[0]?.storyPoints,
    ).toBeNull();
  });
  it("handles pagination and empty projects without silently truncating", () => {
    expect(parseJiraIssues({ issues: [], isLast: true })).toEqual({
      issues: [],
      nextPageToken: null,
    });
    expect(
      parseJiraIssues({ issues: [issue()], isLast: true, total: 101 }, "last-page").nextPageToken,
    ).toBeNull();
    expect(
      parseJiraIssues({ issues: [issue()], nextPageToken: "next", isLast: false }).nextPageToken,
    ).toBe("next");
    expect(() => parseJiraIssues({ issues: [issue()], nextPageToken: "next" }, "next")).toThrow(
      "unsupported issue page",
    );
    expect(() => parseJiraIssues({ issues: [issue()], total: 10 })).toThrow(
      "unsupported issue page",
    );
    expect(() => parseJiraIssues({ issues: [], nextPageToken: "next" })).toThrow(
      "unsupported issue page",
    );
  });
  it("rejects missing or unknown status categories instead of assigning the wrong column", () => {
    expect(() => parseJiraIssues({ issues: [issue("unknown")] })).toThrow("status category");
    expect(() => parseJiraIssues({ issues: [{ id: "1" }] })).toThrow("unsupported issue page");
  });
  it("preserves transition destinations for column drops", () => {
    const transition = {
      id: "42",
      name: "Start review",
      to: { name: "Review", statusCategory: { key: "indeterminate" } },
    };
    expect(parseJiraTransitions({ transitions: [transition] })).toEqual([transition]);
  });
  it("keeps Jira transition identifiers rather than inferring moves from column labels", () => {
    expect(
      parseJiraTransitions({ transitions: [{ id: "42", name: "Start review", to: {} }] }),
    ).toEqual([{ id: "42", name: "Start review", to: {} }]);
    expect(parseJiraTransitions({ transitions: [] })).toEqual([]);
    expect(() => parseJiraTransitions({})).toThrow("transition list");
  });
});
