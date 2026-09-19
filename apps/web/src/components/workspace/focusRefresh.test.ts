import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EnvironmentId, ProjectId, type JiraIssuePage } from "@t3tools/contracts";
import { focusRefreshDue, loadFocusSnapshot, refreshFocus, type FocusSource } from "./focusRefresh";
import { focusScope, getFocus, useFocusStore } from "./suggestedFocusState";
vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  });
});

const target = {
  environmentId: EnvironmentId.make("local"),
  projectId: ProjectId.make("project"),
  siteUrl: "https://test.atlassian.net",
  projectKey: "KAN",
};
const issue = {
  id: "1",
  key: "KAN-1",
  summary: "Work",
  issueType: "Task",
  category: "new" as const,
  status: "To Do",
  assignee: null,
  priority: null,
};
const page: JiraIssuePage = { issues: [issue], nextPageToken: null };
const source = (): FocusSource => ({
  listJiraSites: async () => [{ id: "cloud", url: target.siteUrl }],
  listJiraIssues: vi.fn(async () => page),
});
beforeEach(() => {
  useFocusStore.setState({ entries: {} });
});
describe("briefing refresh", () => {
  it("checks fresh Jira data but generates only when input changes", async () => {
    const jira = source();
    const generate = vi.fn(async () => ({ suggestions: [] }));
    await refreshFocus(target, jira, generate);
    await refreshFocus(target, jira, generate);
    expect(jira.listJiraIssues).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(getFocus(focusScope(target)).checkedAt).toBeTypeOf("number");
    expect(getFocus(focusScope(target)).snapshotKey).toHaveLength(64);
    jira.listJiraIssues = async () => ({ ...page, issues: [{ ...issue, priority: "High" }] });
    await refreshFocus(target, jira, generate);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("keeps the old briefing on Jira and model failures and does not retry", async () => {
    const jira = source();
    const generate = vi.fn(async () => ({ suggestions: [] }));
    await refreshFocus(target, jira, generate);
    const previous = getFocus(focusScope(target));
    jira.listJiraIssues = async () => {
      throw new Error("Jira disconnected");
    };
    await refreshFocus(target, jira, generate);
    expect(getFocus(focusScope(target))).toMatchObject({
      result: previous.result,
      generatedAt: previous.generatedAt,
      error: "Jira disconnected",
      busy: false,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    jira.listJiraIssues = async () => ({ ...page, issues: [] });
    await refreshFocus(target, jira, async () => {
      throw new Error("Model unavailable");
    });
    const failed = getFocus(focusScope(target));
    expect(failed.result).toEqual(previous.result);
    expect(failed.error).toBe("Model unavailable");
    expect(failed.checkedSnapshotKey).not.toBe(failed.snapshotKey);
  });
  it("prevents overlapping refreshes for the same project", async () => {
    let release!: (value: JiraIssuePage) => void;
    const jira = source();
    jira.listJiraIssues = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const generate = vi.fn(async () => ({ suggestions: [] }));
    const first = refreshFocus(target, jira, generate);
    await Promise.resolve();
    await refreshFocus(target, jira, generate);
    release(page);
    await first;
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("loads a consistent paginated snapshot with a visible coverage limit", async () => {
    const jira = source();
    let count = 0;
    jira.listJiraIssues = async () => {
      count++;
      return {
        issues: Array.from({ length: 100 }, (_, index) => ({ ...issue, id: `${count}-${index}` })),
        nextPageToken: String(count),
      };
    };
    const snapshot = await loadFocusSnapshot(jira, target);
    expect(count).toBe(5);
    expect(snapshot.issues).toHaveLength(500);
    expect(snapshot.nextPageToken).toBe("limited");
  });
  it("rejects repeated pages instead of claiming complete coverage", async () => {
    const jira = source();
    jira.listJiraIssues = async () => ({ ...page, nextPageToken: "repeat" });
    await expect(loadFocusSnapshot(jira, target)).rejects.toThrow("repeated page");
  });
});
describe("24-hour automatic refresh", () => {
  const day = 24 * 60 * 60 * 1000;
  it("refreshes missing or older-than-24-hour briefings, including after restart", () => {
    expect(focusRefreshDue({ busy: false }, day * 3)).toBe(true);
    expect(focusRefreshDue({ busy: false, checkedAt: day }, day * 2 + 1)).toBe(true);
    expect(focusRefreshDue({ busy: false, checkedAt: day }, day * 2)).toBe(false);
    expect(focusRefreshDue({ busy: false, checkedAt: day }, day + 1000)).toBe(false);
  });
  it("does not repeat failed attempts or overlap active requests", () => {
    expect(focusRefreshDue({ busy: true }, day * 3)).toBe(false);
    expect(focusRefreshDue({ busy: false, lastAttemptAt: day * 2 }, day * 2 + 1000)).toBe(false);
    expect(focusRefreshDue({ busy: false, lastAttemptAt: day }, day * 2 + 1)).toBe(true);
    expect(focusRefreshDue({ busy: false, checkedAt: day * 3 }, day * 2)).toBe(false);
  });
});
