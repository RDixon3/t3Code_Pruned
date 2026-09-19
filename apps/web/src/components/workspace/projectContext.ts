import type { ScopedProjectRef } from "@t3tools/contracts";

// Business projects reference T3 workspaces; they never replace session ownership.
// Connector data belongs here rather than in the agent or provider contracts.
export interface ProjectContext {
  readonly id: string;
  readonly name: string;
  readonly jira?: {
    readonly siteUrl: string;
    readonly projectKey: string;
  };
  readonly workspace: ScopedProjectRef;
  readonly sharePointSiteUrl?: string;
}
