import type { CoCoFocusResult, JiraIssuePage } from "@t3tools/contracts";
import {
  focusFailureMessage,
  focusScope,
  focusSnapshotKey,
  getFocus,
  setFocus,
  type FocusTarget,
  type FocusEntry,
} from "./suggestedFocusState";

export interface FocusSource {
  listJiraSites: () => Promise<readonly { id: string; url: string }[]>;
  listJiraIssues: (input: {
    cloudId: string;
    projectKey: string;
    nextPageToken?: string;
  }) => Promise<JiraIssuePage>;
}
/** Independent of board pagination: always fetch from page one, capped at 500 issues. */
export async function loadFocusSnapshot(
  source: FocusSource,
  target: FocusTarget,
): Promise<JiraIssuePage> {
  const site = (await source.listJiraSites()).find(
    (site) => site.url.replace(/\/$/, "") === target.siteUrl.replace(/\/$/, ""),
  );
  if (!site) throw new Error("The linked Jira site is unavailable. Check the Jira connection.");
  const issues = new Map<string, JiraIssuePage["issues"][number]>();
  const seen = new Set<string>();
  let token: string | undefined;
  for (let page = 0; page < 5; page++) {
    const result = await source.listJiraIssues({
      cloudId: site.id,
      projectKey: target.projectKey,
      ...(token ? { nextPageToken: token } : {}),
    });
    for (const issue of result.issues) issues.set(issue.id, issue);
    if (!result.nextPageToken)
      return {
        issues: [...issues.values()].slice(0, 500),
        nextPageToken: issues.size > 500 ? "limited" : null,
      };
    if (seen.has(result.nextPageToken))
      throw new Error("Jira returned a repeated page. The previous briefing was kept.");
    seen.add(result.nextPageToken);
    token = result.nextPageToken;
    if (issues.size >= 500) break;
  }
  return { issues: [...issues.values()].slice(0, 500), nextPageToken: "limited" };
}
export async function refreshFocus(
  target: FocusTarget,
  source: FocusSource,
  generate: (snapshot: JiraIssuePage) => Promise<CoCoFocusResult>,
) {
  const scope = focusScope(target);
  if (getFocus(scope).busy) return;
  setFocus(scope, {
    ...getFocus(scope),
    target,
    busy: true,
    lastAttemptAt: Date.now(),
    error: undefined,
  });
  try {
    const snapshot = await loadFocusSnapshot(source, target);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(focusSnapshotKey(snapshot)),
    );
    const key = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    setFocus(scope, {
      ...getFocus(scope),
      checkedAt: Date.now(),
      checkedSnapshotKey: key,
      issueCount: snapshot.issues.length,
    });
    if (getFocus(scope).result && getFocus(scope).snapshotKey === key) return;
    const result = await generate(snapshot);
    setFocus(scope, {
      ...getFocus(scope),
      result,
      snapshotKey: key,
      generatedAt: Date.now(),
      incomplete: Boolean(snapshot.nextPageToken),
    });
  } catch (error) {
    setFocus(scope, { ...getFocus(scope), error: focusFailureMessage(error) });
  } finally {
    setFocus(scope, { ...getFocus(scope), busy: false });
  }
}
/** A failed attempt also waits 24 hours, avoiding automatic retry loops. */
export function focusRefreshDue(entry: FocusEntry, now: number): boolean {
  if (entry.busy) return false;
  const last = Math.max(entry.checkedAt ?? 0, entry.lastAttemptAt ?? 0);
  return last === 0 || now - last > 24 * 60 * 60 * 1000;
}
