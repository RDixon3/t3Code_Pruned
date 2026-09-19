import * as Cause from "effect/Cause";
import { useCallback } from "react";
import { cocoGenerateFocus } from "../../state/coco";
import { useAtomCommand } from "../../state/use-atom-command";
import { focusScope, type FocusTarget } from "./suggestedFocusState";
import { refreshFocus } from "./focusRefresh";

export function useFocusRefresh() {
  const generate = useAtomCommand(cocoGenerateFocus, { reportFailure: false, reportDefect: false });
  return useCallback(
    async (target: FocusTarget) => {
      const source = window.desktopBridge;
      if (!source?.listJiraSites || !source.listJiraIssues) return;
      const run = () =>
        refreshFocus(
          target,
          { listJiraSites: source.listJiraSites!, listJiraIssues: source.listJiraIssues! },
          async (snapshot) => {
            const response = await generate({
              environmentId: target.environmentId,
              input: {
                projectId: target.projectId,
                siteUrl: target.siteUrl,
                projectKey: target.projectKey,
                snapshot,
              },
            });
            if (response._tag === "Failure") throw Cause.squash(response.cause);
            return response.value;
          },
        );
      // Electron/Web Locks prevent two windows from doing the same project refresh concurrently.
      if (navigator.locks)
        await navigator.locks.request(
          `coco-focus:${focusScope(target)}`,
          { ifAvailable: true },
          (lock) => (lock ? run() : undefined),
        );
      else await run();
    },
    [generate],
  );
}
