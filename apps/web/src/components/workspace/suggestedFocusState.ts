import type { CoCoFocusResult, JiraIssuePage } from "@t3tools/contracts";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { create } from "zustand";

export function focusSnapshotKey(snapshot: JiraIssuePage): string {
  return JSON.stringify({
    incomplete: Boolean(snapshot.nextPageToken),
    issues: [...snapshot.issues]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: issue.status,
        category: issue.category,
        assignee: issue.assignee,
        priority: issue.priority,
        storyPoints: issue.storyPoints ?? null,
      })),
  });
}
export interface FocusTarget {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  siteUrl: string;
  projectKey: string;
}
export function focusScope(target: FocusTarget) {
  return JSON.stringify([
    "pm-briefing-v1",
    target.environmentId,
    target.projectId,
    target.siteUrl,
    target.projectKey,
  ]);
}
export interface FocusEntry {
  target?: FocusTarget;
  lastAttemptAt?: number;
  checkedAt?: number;
  checkedSnapshotKey?: string;
  issueCount?: number;
  busy: boolean;
  error?: string | undefined;
  result?: CoCoFocusResult;
  snapshotKey?: string;
  generatedAt?: number;
  incomplete?: boolean;
}
const empty: FocusEntry = { busy: false };
// Device-local saved briefings; running state must never survive a restart.
export function savedFocusEntries(entries: Record<string, FocusEntry>) {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, { ...value, busy: false }]),
  );
}
export const useFocusStore = create<{ entries: Record<string, FocusEntry> }>()(
  persist(() => ({ entries: {} }), {
    name: "coco-project-briefings-v1",
    storage: createJSONStorage(() => ({
      getItem: (key) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key)),
      setItem: (key, value) => {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      },
    })),
    partialize: (state) => ({ entries: savedFocusEntries(state.entries) }),
  }),
);
export function getFocus(scope: string): FocusEntry {
  return useFocusStore.getState().entries[scope] ?? empty;
}
export function setFocus(scope: string, value: FocusEntry) {
  useFocusStore.setState(({ entries }) => ({ entries: { ...entries, [scope]: value } }));
}

export function focusFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.includes("Unknown request tag: coco.generateFocus"))
    return "The running backend does not include Suggested focus yet. Rebuild and restart the dev app, then try again.";
  return message.trim() || "Could not generate suggestions. Try again.";
}
