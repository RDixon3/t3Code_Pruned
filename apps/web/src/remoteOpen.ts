import type { ConnectionTarget } from "@t3tools/client-runtime/connection";
import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo } from "react";
import { isDesktopLocalConnectionTarget } from "~/connection/desktopLocal";
import { isLoopbackHostname } from "~/environments/primary/target";
import { useEnvironmentPresentation } from "~/state/presentation";

export type RemoteOpenState =
  | { readonly mode: "local-exec" }
  | { readonly mode: "remote-unavailable" };
export type RemoteOpenMode = RemoteOpenState["mode"];
export interface RemoteOpenResolution {
  readonly state: RemoteOpenState;
  readonly isResolved: boolean;
}

/** Editor operations run only in the local desktop or development environment. */
export function resolveRemoteOpenState(input: {
  readonly target: ConnectionTarget | null;
  readonly isDesktopRenderer: boolean;
}): RemoteOpenState {
  const { target } = input;
  if (target === null) return { mode: "remote-unavailable" };
  if (isDesktopLocalConnectionTarget(target)) return { mode: "local-exec" };
  if (target._tag === "PrimaryConnectionTarget") {
    if (input.isDesktopRenderer) return { mode: "local-exec" };
    try {
      if (isLoopbackHostname(new URL(target.httpBaseUrl).hostname)) return { mode: "local-exec" };
    } catch {}
  }
  return { mode: "remote-unavailable" };
}
export function useRemoteOpenResolution(environmentId: EnvironmentId | null): RemoteOpenResolution {
  const { presentation } = useEnvironmentPresentation(environmentId);
  return useMemo(
    () => ({
      state: resolveRemoteOpenState({
        target: presentation?.entry.target ?? null,
        isDesktopRenderer: window.desktopBridge !== undefined,
      }),
      isResolved: presentation !== null,
    }),
    [presentation],
  );
}
export function useRemoteOpenState(environmentId: EnvironmentId | null): RemoteOpenState {
  return useRemoteOpenResolution(environmentId).state;
}
