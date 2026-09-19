import { useMemo } from "react";
import { useProjects } from "../../state/entities";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useClientSettings } from "../../hooks/useSettings";
import { selectProjectGroupingSettings } from "../../logicalProject";
import { buildSidebarProjectSnapshots } from "../../sidebarProjectGrouping";
import { useUiStateStore } from "../../uiStateStore";
import type { ProjectContext } from "./projectContext";

/** Share the stock sidebar's persisted project scope across Manage and Build. */
export function useWorkspaceProject() {
  const projects = useProjects();
  const settings = useClientSettings(selectProjectGroupingSettings);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const scopeKey = useUiStateStore((state) => state.sidebarProjectScopeKey);
  const groups = useMemo(
    () =>
      buildSidebarProjectSnapshots({
        projects,
        settings,
        primaryEnvironmentId,
        resolveEnvironmentLabel: () => null,
      }),
    [projects, settings, primaryEnvironmentId],
  );
  const project = groups.find((group) => group.projectKey === scopeKey) ?? null;
  const context: ProjectContext | null = project
    ? {
        id: project.projectKey,
        name: project.displayName,
        workspace: { environmentId: project.environmentId, projectId: project.id },
      }
    : null;
  return { project, context, groups, scopeKey };
}
