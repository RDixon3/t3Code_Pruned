import { useCallback } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { DraftId, useComposerDraftStore } from "../composerDraftStore";
import { readThreadShell } from "../state/entities";
import { useUiStateStore } from "../uiStateStore";
import type { HelpArticleId } from "./catalog";

import {
  nextHelpReturn,
  retainHelpReturn,
  resolveHelpReturnHref,
  type HelpReturnTarget,
} from "./returnTarget";
export { isHelpPath } from "./returnTarget";

let returnTarget: HelpReturnTarget | null = null;

export function updateHelpVisit(pathname: string) {
  returnTarget = retainHelpReturn(returnTarget, pathname);
}
function captureHelpReturn(href: string) {
  const state = useUiStateStore.getState();
  returnTarget = nextHelpReturn(returnTarget, {
    href,
    manage: state.manageLayout === true,
    projectScope: state.sidebarProjectScopeKey,
  });
}
export function useOpenHelp() {
  const navigate = useNavigate();
  const router = useRouter();
  return useCallback(
    (articleId: HelpArticleId = "getting-started", hash = "") => {
      // The desktop uses hash history; the shell URL is not the current app route.
      captureHelpReturn(router.state.location.href);
      void navigate({ to: "/help/$articleId", params: { articleId }, hash });
    },
    [navigate, router],
  );
}

export function useHelpReturn() {
  const navigate = useNavigate();
  const label = returnTarget?.href.startsWith("/settings")
    ? "Back to Settings"
    : "Back to workspace";
  const goBack = useCallback(() => {
    const href = resolveHelpReturnHref(
      returnTarget,
      (environmentId, threadId) =>
        readThreadShell({
          environmentId: EnvironmentId.make(environmentId),
          threadId: ThreadId.make(threadId),
        }) !== null,
      (draftId) => useComposerDraftStore.getState().getDraftSession(DraftId.make(draftId)) !== null,
    );
    if (returnTarget) {
      const state = useUiStateStore.getState();
      state.setManageLayout(returnTarget.manage);
      state.setSidebarProjectScopeKey(
        href === returnTarget.href ? returnTarget.projectScope : null,
      );
    }
    returnTarget = null;
    void navigate({ href });
  }, [navigate]);
  return { goBack, label };
}
