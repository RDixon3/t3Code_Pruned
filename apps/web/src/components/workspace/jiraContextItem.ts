import type { JiraIssue } from "@t3tools/contracts";
import type { ContextItem } from "../../lib/contextItem";

/** Capture the board's loaded fields without fetching or claiming they were refreshed. */
export function jiraContextItem(issue: JiraIssue, cloudId: string, siteUrl: string): ContextItem {
  let url: string | undefined;
  try {
    const site = new URL(siteUrl);
    if (site.protocol === "https:" && !site.username && !site.password) {
      url = new URL(`/browse/${encodeURIComponent(issue.key)}`, site).href;
    }
  } catch {
    // A snapshot remains useful when its source link is unavailable.
  }
  return {
    source: "jira",
    sourceLabel: "Jira",
    sourceScope: cloudId,
    recordId: issue.key,
    title: issue.summary,
    kind: issue.issueType.toLowerCase() === "risk" ? "risk" : "issue",
    ...(url ? { url } : {}),
    content: `${issue.key}: ${issue.summary}\nType: ${issue.issueType}\nStatus: ${issue.status}\nAssignee: ${issue.assignee ?? "Unassigned"}`,
  };
}
