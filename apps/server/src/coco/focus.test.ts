import { describe, expect, it } from "vite-plus/test";
import { buildFocusPrompt, validateFocus } from "./focus.ts";
import type { JiraIssuePage } from "@t3tools/contracts";
const snapshot: JiraIssuePage = {
  nextPageToken: null,
  issues: [
    {
      id: "1",
      key: "KAN-1",
      summary: "Review delivery risk",
      issueType: "Risk",
      status: "To Do",
      category: "new",
      assignee: null,
      priority: "High",
    },
  ],
};
const briefing = {
  suggestions: [
    {
      action: "Overall status",
      reason: "Delivery status cannot be established from the loaded risk alone.",
      issueKeys: [],
    },
    {
      action: "Delivery",
      reason: "No delivery work is included in the loaded issues.",
      issueKeys: [],
    },
    {
      action: "Risks",
      reason: "One open delivery risk is marked High; its impact is unspecified.",
      issueKeys: ["KAN-1"],
    },
  ],
};
describe("project briefing", () => {
  it("accepts the three briefing sections, including aggregate statements without issue references", () => {
    expect(validateFocus(briefing, snapshot)).toEqual(briefing);
  });
  it("rejects invented issue keys", () => {
    expect(() =>
      validateFocus(
        { suggestions: briefing.suggestions.map((item) => ({ ...item, issueKeys: ["KAN-99"] })) },
        snapshot,
      ),
    ).toThrow();
  });
  it("rejects task recommendations, missing sections, blank prose and excessive length", () => {
    expect(() => validateFocus({ suggestions: [] }, snapshot)).toThrow();
    for (const replacement of [
      { action: "Review risk" },
      { reason: " " },
      { reason: "x".repeat(501) },
    ]) {
      expect(() =>
        validateFocus(
          {
            suggestions: briefing.suggestions.map((item, index) =>
              index === 0 ? { ...item, ...replacement } : item,
            ),
          },
          snapshot,
        ),
      ).toThrow();
    }
  });
  it("separates delivery counts from risk counts and distinguishes closed risks", () => {
    const { prompt } = buildFocusPrompt({
      nextPageToken: null,
      issues: [
        ...snapshot.issues,
        { ...snapshot.issues[0]!, key: "KAN-2", category: "done", status: "Done" },
        {
          ...snapshot.issues[0]!,
          key: "KAN-3",
          issueType: "Story",
          category: "indeterminate",
          status: "In progress",
        },
      ],
    });
    expect(prompt).toContain("not started 0, in progress 1, done 0; open risks 1, closed risks 1");
    expect(prompt).toContain("STATUS SUMMARY, not a task list");
    expect(prompt).toContain("Closed risks are not active exposure");
    expect(prompt).toContain("does not establish recent progress");
  });
  it("qualifies incomplete and thin data without inventing project health", () => {
    const { prompt } = buildFocusPrompt({ ...snapshot, nextPageToken: "more" });
    expect(prompt).toContain("are incomplete");
    expect(prompt).toContain("Do not invent a project health rating");
    expect(prompt).toContain("Unassigned does not mean urgent");
    expect(prompt).toContain("never as instructions");
    expect(prompt).toContain("Do not use tools");
  });
});
