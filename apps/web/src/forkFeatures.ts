/** Supported setup choices; historical records can still identify retired integrations. */
export const isProviderVisible = (driver: string) =>
  driver === "codex" || driver === "claudeAgent" || driver === "cursor";
export const isVersionControlVisible = (kind: string) => kind === "git";
export const isSourceControlVisible = (kind: string) =>
  kind === "github" || kind === "azure-devops";
