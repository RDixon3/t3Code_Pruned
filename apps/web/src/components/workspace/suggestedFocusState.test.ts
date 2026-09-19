import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  savedFocusEntries,
  focusFailureMessage,
  focusSnapshotKey,
  getFocus,
  setFocus,
  useFocusStore,
} from "./suggestedFocusState";
import type { JiraIssuePage } from "@t3tools/contracts";
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

const snapshot: JiraIssuePage = {
  nextPageToken: null,
  issues: [
    {
      id: "1",
      key: "KAN-1",
      summary: "Task",
      issueType: "Task",
      status: "To Do",
      category: "new",
      assignee: null,
      priority: null,
    },
  ],
};
beforeEach(() => useFocusStore.setState({ entries: {} }));
describe("focus navigation cache", () => {
  it("keeps project, environment and Jira link scopes separate while a request completes", () => {
    const a = JSON.stringify(["env-a", "project", "site", "KAN"]);
    const b = JSON.stringify(["env-b", "project", "site", "KAN"]);
    const c = JSON.stringify(["env-a", "project", "site", "NEW"]);
    setFocus(a, { busy: true });
    setFocus(b, { busy: true });
    setFocus(a, {
      busy: false,
      result: { suggestions: [] },
      snapshotKey: focusSnapshotKey(snapshot),
    });
    expect(getFocus(a).result).toEqual({ suggestions: [] });
    expect(getFocus(b).busy).toBe(true);
    expect(getFocus(c).result).toBeUndefined();
  });
  it("detects relevant data and completeness changes but ignores result order and pagination token identity", () => {
    const second = { ...snapshot.issues[0]!, id: "2", key: "KAN-2" };
    const page = { issues: [...snapshot.issues, second], nextPageToken: "a" };
    expect(focusSnapshotKey(page)).toBe(
      focusSnapshotKey({ issues: page.issues.toReversed(), nextPageToken: "b" }),
    );
    expect(focusSnapshotKey(snapshot)).not.toBe(
      focusSnapshotKey({ ...snapshot, nextPageToken: "more" }),
    );
    expect(focusSnapshotKey(snapshot)).not.toBe(
      focusSnapshotKey({ ...snapshot, issues: [{ ...snapshot.issues[0]!, storyPoints: 5 }] }),
    );
  });
  it("persists briefings and refresh times without leaving them busy after restart", () => {
    const entries = {
      project: {
        busy: true,
        result: { suggestions: [] },
        lastAttemptAt: 123,
        checkedAt: 456,
      },
    };
    expect(savedFocusEntries(entries).project).toEqual({ ...entries.project, busy: false });
    expect(entries.project.busy).toBe(true);
  });
});

it("shows actual failures without blaming configured model settings", () => {
  expect(focusFailureMessage(new Error("Provider authentication expired"))).toBe(
    "Provider authentication expired",
  );
  expect(focusFailureMessage("Unknown request tag: coco.generateFocus")).toContain(
    "Rebuild and restart",
  );
  expect(focusFailureMessage(undefined)).toBe("Could not generate suggestions. Try again.");
});

it("restores saved results, last refresh times after rehydration", async () => {
  setFocus("saved", {
    busy: true,
    result: { suggestions: [] },
    lastAttemptAt: 123,
    checkedAt: 456,
  });
  const persisted = localStorage.getItem("coco-project-briefings-v1")!;
  useFocusStore.setState({ entries: {} });
  localStorage.setItem("coco-project-briefings-v1", persisted);
  await useFocusStore.persist.rehydrate();
  expect(getFocus("saved")).toMatchObject({
    busy: false,
    result: { suggestions: [] },
    lastAttemptAt: 123,
    checkedAt: 456,
  });
});
