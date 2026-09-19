import { useParams } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { ReactNode } from "react";
import { type CSSProperties, useState } from "react";
import { useComposerDraftStore } from "../../composerDraftStore";
import { resolveThreadRouteTarget } from "../../threadRoutes";
import { useProject, useThreadShell } from "../../state/entities";
import { useResizableWidth } from "../../hooks/useResizableWidth";
import { RightPanelResizeHandle } from "../preview/RightPanelResizeHandle";
import { ManageLanding } from "./ManageLanding";
import { useWorkspaceProject } from "./useWorkspaceProject";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import type { ContextItem } from "../../lib/contextItem";

/** Keep the stock chat route mounted, including its draft promotion and shortcuts. */
export function ManageWorkspace({ children }: { children: ReactNode }) {
  const params = useParams({ strict: false });
  const target = resolveThreadRouteTarget(params);
  const thread = useThreadShell(target?.kind === "server" ? target.threadRef : null);
  const draft = useComposerDraftStore((state) =>
    target?.kind === "draft" ? state.getDraftSession(target.draftId) : null,
  );
  const owner = thread ?? draft;
  const owningProject = useProject(
    owner ? scopeProjectRef(owner.environmentId, owner.projectId) : null,
  );
  const { context: selected } = useWorkspaceProject();
  const project = target
    ? owningProject
      ? {
          id: owningProject.id,
          name: owningProject.title,
          workspace: scopeProjectRef(owningProject.environmentId, owningProject.id),
        }
      : null
    : selected;
  const [tab, setTab] = useState<"work" | "chat">("work");
  const { width, handlers } = useResizableWidth({
    storageKey: "coco:manage-chat-width",
    defaultWidth: 560,
    minWidth: 360,
    maxWidth: 800,
    edge: "left",
  });
  const addToChat =
    target && owningProject
      ? (text: string) => {
          const composerTarget = target.kind === "draft" ? target.draftId : target.threadRef;
          const store = useComposerDraftStore.getState();
          const prompt = store.getComposerDraft(composerTarget)?.prompt ?? "";
          store.setPrompt(composerTarget, prompt ? `${prompt}\n\n${text}` : text);
          setTab("chat");
        }
      : undefined;
  const addContextItem =
    target && owningProject
      ? (item: ContextItem) => {
          const composerTarget = target.kind === "draft" ? target.draftId : target.threadRef;
          if (!useComposerDraftStore.getState().addContextItem(composerTarget, item)) {
            toastManager.add({
              type: "error",
              title: "Could not add context",
              description: "Remove a context item from the chat draft and try again.",
            });
            return;
          }
          setTab("chat");
        }
      : undefined;
  return (
    <div className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex gap-2 border-b p-2 xl:hidden">
        <Button
          size="sm"
          variant={tab === "work" ? "secondary" : "ghost"}
          onClick={() => setTab("work")}
        >
          Project work
        </Button>
        <Button
          size="sm"
          variant={tab === "chat" ? "secondary" : "ghost"}
          onClick={() => setTab("chat")}
        >
          Chat
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className={`${tab === "work" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 xl:flex`}>
          <ManageLanding
            project={project}
            onAddToChat={addToChat}
            onAddContextItem={addContextItem}
          />
        </div>
        <div
          aria-label="Project chat"
          style={{ "--manage-chat-width": `${width}px` } as CSSProperties}
          className={`${tab === "chat" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l xl:flex xl:w-(--manage-chat-width) xl:max-w-[50%] xl:flex-none [&>[data-slot=sidebar-inset]]:h-full [&>[data-slot=sidebar-inset]]:min-w-0`}
        >
          <RightPanelResizeHandle handlers={handlers} className="hidden xl:block" />
          {children}
        </div>
      </div>
    </div>
  );
}
