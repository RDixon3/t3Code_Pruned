import { describe, expect, it } from "vite-plus/test";
import { jiraToolData, parseJiraSites, parseJiraProjects } from "./jiraDiscovery.ts";

const project = { id: "10001", key: "TEAM", name: "Team" };
describe("Jira discovery responses", () => {
  it("reads JSON text and structured results", () => {
    expect(jiraToolData({ content: [{ type: "text", text: JSON.stringify([project]) }] })).toEqual([
      project,
    ]);
    expect(jiraToolData({ structuredContent: { values: [project] } })).toEqual({
      values: [project],
    });
  });
  it("normalizes site origins and keeps only link metadata", () => {
    expect(
      parseJiraSites([
        {
          id: "cloud",
          name: "Team",
          url: "https://team.atlassian.net/",
          scopes: ["read:jira-work"],
        },
      ]),
    ).toEqual([{ id: "cloud", name: "Team", url: "https://team.atlassian.net" }]);
    expect(parseJiraSites([])).toEqual([]);
    expect(() =>
      parseJiraSites([{ id: "cloud", name: "Team", url: "http://team.atlassian.net" }]),
    ).toThrow("site list");
  });
  it("handles empty, paged, and unpaged project lists", () => {
    expect(parseJiraProjects([], 0)).toEqual({ projects: [], nextStartAt: null });
    expect(parseJiraProjects([project], 0)).toEqual({ projects: [project], nextStartAt: null });
    expect(parseJiraProjects({ values: [project], startAt: 0, total: 2 }, 0).nextStartAt).toBe(1);
    expect(
      parseJiraProjects({ values: [project], startAt: 1, total: 2, isLast: true }, 1).nextStartAt,
    ).toBeNull();
    expect(parseJiraProjects({ values: [project], isLast: false }, 0).nextStartAt).toBe(1);
  });
  it("rejects malformed and nonadvancing pages instead of showing an empty success", () => {
    for (const data of [
      {},
      { values: [{}] },
      { values: [], isLast: false },
      { values: [project], startAt: 0 },
    ]) {
      expect(() => parseJiraProjects(data, 1)).toThrow("project page");
    }
    expect(() =>
      jiraToolData({ content: [{ type: "text", text: "private malformed data" }] }),
    ).toThrow("unrecognized response");
    expect(() =>
      jiraToolData({ isError: true, content: [{ type: "text", text: "private tool error" }] }),
    ).toThrow("Test the connection");
  });
});
