import { useEffect, useRef } from "react";
import { usePrimaryEnvironment } from "../../state/environments";
import { usePrimarySettings } from "../../hooks/useSettings";
import { useProjects } from "../../state/entities";
import { isHostLocalSdkEnvironment } from "../chat/serviceNowSdkHost";
import { focusRefreshDue } from "./focusRefresh";
import { focusScope, getFocus, setFocus, useFocusStore } from "./suggestedFocusState";
import { useFocusRefresh } from "./useFocusRefresh";

/** App-level timer, independent of Manage mounting or sidebar selection. */
export function FocusScheduler() {
  const environment = usePrimaryEnvironment();
  const contexts = usePrimarySettings((settings) => settings.cocoProjectContexts);
  const projects = useProjects();
  const refresh = useFocusRefresh();
  const current = useRef({ environment, contexts, projects, refresh });
  useEffect(() => {
    current.current = { environment, contexts, projects, refresh };
  }, [environment, contexts, projects, refresh]);
  useEffect(() => {
    let running = false;
    let stopped = false;
    const tick = async () => {
      if (running || stopped) return;
      const { environment, projects, contexts } = current.current;
      const bridge = window.desktopBridge;
      if (
        !isHostLocalSdkEnvironment(
          environment?.entry.target,
          environment?.serverConfig?.environment.platform.os,
          bridge?.getClientPlatform?.(),
          window.location.href,
        )
      )
        return;
      const targets = projects.flatMap((project) => {
        const jira = contexts[project.id]?.jira;
        return project.environmentId === environment?.environmentId && jira
          ? [
              {
                environmentId: project.environmentId,
                projectId: project.id,
                siteUrl: jira.siteUrl,
                projectKey: jira.projectKey,
              },
            ]
          : [];
      });
      if (!targets.some((target) => focusRefreshDue(getFocus(focusScope(target)), Date.now())))
        return;
      const run = async () => {
        running = true;
        try {
          // Other desktop windows may have already claimed today's run.
          const busy = Object.entries(useFocusStore.getState().entries).filter(
            ([, entry]) => entry.busy,
          );
          await useFocusStore.persist.rehydrate();
          for (const [scope, entry] of busy) setFocus(scope, entry);
          for (const target of targets) {
            if (stopped) return;
            const latest = current.current;
            const link = latest.contexts[target.projectId]?.jira;
            if (
              target.environmentId !== latest.environment?.environmentId ||
              link?.siteUrl !== target.siteUrl ||
              link.projectKey !== target.projectKey ||
              !latest.projects.some(
                (project) =>
                  project.id === target.projectId && project.environmentId === target.environmentId,
              )
            )
              continue;
            if (!focusRefreshDue(getFocus(focusScope(target)), Date.now())) continue;
            await latest.refresh(target);
          }
        } finally {
          running = false;
        }
      };
      try {
        if (navigator.locks)
          await navigator.locks.request("coco-focus-automatic", { ifAvailable: true }, (lock) =>
            lock ? run() : undefined,
          );
        else await run();
      } catch {
        /* Retain saved results if the desktop connection is unavailable. */
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 60_000);
    const sync = (event: StorageEvent) => {
      if (
        event.key === "coco-project-briefings-v1" &&
        !Object.values(useFocusStore.getState().entries).some((entry) => entry.busy)
      )
        void useFocusStore.persist.rehydrate();
    };
    window.addEventListener("storage", sync);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return null;
}
