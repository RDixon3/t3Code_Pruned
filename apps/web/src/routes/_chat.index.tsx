import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshIcon } from "~/components/ui/refresh-icon";

import { NoProjectsHero } from "../components/NoProjectsHero";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { latestBuildThread } from "../components/workspace/latestBuildThread";
import { useWorkspaceProject } from "../components/workspace/useWorkspaceProject";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useThreadShells,
} from "../state/entities";

function ChatIndexRouteView() {
  return <IndexDraftLanding />;
}

/**
 * Build opens the selected project's most recent thread, or its stock draft
 * when no thread exists. Project selection is shared with Manage.
 */
function IndexDraftLanding() {
  const projects = useProjects();
  const { project: selectedProject } = useWorkspaceProject();
  const navigate = useNavigate();
  const threads = useThreadShells();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const handleNewThread = useNewThreadHandler();
  const startingRef = useRef(false);
  const [startState, setStartState] = useState({ failed: false, retryRequest: 0 });

  const mostRecentThread = useMemo(
    () => latestBuildThread(selectedProject?.memberProjectRefs ?? [], threads),
    [selectedProject, threads],
  );

  useEffect(() => {
    if (!bootstrapped || selectedProject === null || startingRef.current) {
      return;
    }
    startingRef.current = true;
    const opening = mostRecentThread
      ? navigate({
          to: "/$environmentId/$threadId",
          params: { environmentId: mostRecentThread.environmentId, threadId: mostRecentThread.id },
          replace: true,
        })
      : handleNewThread(scopeProjectRef(selectedProject.environmentId, selectedProject.id), {
          replace: true,
        });
    void opening.catch(() => {
      startingRef.current = false;
      setStartState((state) => ({ ...state, failed: true }));
    });
  }, [
    bootstrapped,
    handleNewThread,
    selectedProject,
    mostRecentThread,
    navigate,
    startState.retryRequest,
  ]);

  if (!bootstrapped) {
    return null;
  }
  if (selectedProject !== null) {
    return startState.failed ? (
      <DraftStartError
        onRetry={() => {
          setStartState((state) => ({
            failed: false,
            retryRequest: state.retryRequest + 1,
          }));
        }}
      />
    ) : null;
  }
  // First-run routing to the welcome wizard happens in FirstRunGate at the
  // root, before this route ever renders.
  if (projects.length === 0) return <NoProjectsHero />;
  return (
    <SidebarInset className="h-dvh min-h-0 bg-background text-foreground">
      <WorkspacePageHeader>
        <h1 className="text-sm font-medium">Build</h1>
      </WorkspacePageHeader>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Select a project</EmptyTitle>
          <EmptyDescription>
            Choose a project in the sidebar to open its most recent thread.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </SidebarInset>
  );
}

function DraftStartError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <Empty className="flex-1">
        <EmptyHeader className="max-w-md">
          <EmptyTitle className="text-foreground text-xl">Couldn’t start a new thread</EmptyTitle>
          <EmptyDescription className="mt-2 text-sm text-muted-foreground/78">
            The project is still available. Try opening the draft again.
          </EmptyDescription>
          <div className="mt-5 flex justify-center">
            <Button size="sm" onClick={onRetry}>
              <RefreshIcon className="size-4" />
              Try again
            </Button>
          </div>
        </EmptyHeader>
      </Empty>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
