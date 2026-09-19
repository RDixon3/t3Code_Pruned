import type { JiraIssue, JiraTransition } from "@t3tools/contracts";

/** Column categories are not Jira transition names or IDs. */
export function jiraColumnTransitions(
  transitions: readonly JiraTransition[],
  category: JiraIssue["category"],
) {
  return transitions.filter((transition) => transition.to?.statusCategory?.key === category);
}
