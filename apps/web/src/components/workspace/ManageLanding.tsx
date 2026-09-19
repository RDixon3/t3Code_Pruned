import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import type { ReactNode } from "react";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { JiraProjectBoard } from "./JiraProjectBoard";
import { SidebarInset } from "../ui/sidebar";
import type { ProjectContext } from "./projectContext";
import { ProjectJiraLink } from "../settings/ProjectJiraLink";
import { HelpLink } from "../help/HelpLink";
import type { ContextItem } from "../../lib/contextItem";

export function ManageLanding({
  project,
  onAddToChat,
  onAddContextItem,
}: {
  project: ProjectContext | null;
  onAddToChat?: ((text: string) => void) | undefined;
  onAddContextItem?: ((item: ContextItem) => void) | undefined;
}) {
  const heading = (
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-semibold tracking-tight">
        {project?.name ?? "Project overview"}
      </h1>
      <div className="no-drag mt-1 flex flex-wrap items-center gap-2">
        {project && (
          <ProjectJiraLink
            environmentId={project.workspace.environmentId}
            projectId={project.workspace.projectId}
            appearance="subtitle"
          />
        )}
        <HelpLink article="manage" label="Manage guide" />
      </div>
    </div>
  );
  return (
    <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground">
      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
        {project ? (
          <LinkedBoard
            key={`${project.workspace.environmentId}:${project.workspace.projectId}`}
            environmentId={project.workspace.environmentId}
            projectId={project.workspace.projectId}
            heading={heading}
            onAddToChat={onAddToChat}
            onAddContextItem={onAddContextItem}
          />
        ) : (
          <JiraProjectBoard jira={null} hasProject={false} heading={heading} />
        )}
      </main>
    </SidebarInset>
  );
}

function LinkedBoard({
  environmentId,
  projectId,
  heading,
  onAddToChat,
  onAddContextItem,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  heading: ReactNode;
  onAddToChat?: ((text: string) => void) | undefined;
  onAddContextItem?: ((item: ContextItem) => void) | undefined;
}) {
  const jira = useEnvironmentSettings(
    environmentId,
    (settings) => settings.cocoProjectContexts[projectId]?.jira ?? null,
  );
  return (
    <JiraProjectBoard
      key={`${jira?.siteUrl}:${jira?.projectKey}`}
      jira={jira}
      environmentId={environmentId}
      projectId={projectId}
      hasProject
      heading={heading}
      onAddToChat={onAddToChat}
      onAddContextItem={onAddContextItem}
    />
  );
}
