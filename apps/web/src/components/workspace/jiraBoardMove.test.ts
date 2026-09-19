import { describe, expect, it } from "vite-plus/test";
import { jiraColumnTransitions } from "./jiraBoardMove";

describe("Jira column moves", () => {
  const transitions = [
    { id: "7", name: "Begin", to: { name: "Doing", statusCategory: { key: "indeterminate" } } },
    { id: "8", name: "Review", to: { name: "Review", statusCategory: { key: "indeterminate" } } },
    { id: "9", name: "Resolve", to: { name: "Closed", statusCategory: { key: "done" } } },
    { id: "10", name: "Done" },
  ];
  it("matches the destination category, never the transition name", () => {
    expect(jiraColumnTransitions(transitions, "done").map((t) => t.id)).toEqual(["9"]);
  });
  it("keeps multiple valid transitions for the user to choose", () => {
    expect(jiraColumnTransitions(transitions, "indeterminate").map((t) => t.id)).toEqual([
      "7",
      "8",
    ]);
  });
  it("does not invent a move when none is available", () => {
    expect(jiraColumnTransitions(transitions, "new")).toEqual([]);
    expect(
      jiraColumnTransitions(
        [{ id: "1", name: "Done", to: { statusCategory: { key: "unknown" } } }],
        "done",
      ),
    ).toEqual([]);
  });
});
