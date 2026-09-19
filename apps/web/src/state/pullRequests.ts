import { useAtomValue } from "@effect/atom-react";
import {
  createLinkedPullRequestSummaryAtomFamily,
  createPullRequestEnvironmentAtoms,
} from "@t3tools/client-runtime/state/pull-requests";
import type { EnvironmentId, PullRequestRef, PullRequestSummary } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useLayoutEffect } from "react";

import { connectionAtomRuntime } from "../connection/runtime";
import { appAtomRegistry } from "../rpc/atomRegistry";

export const pullRequestEnvironment = createPullRequestEnvironmentAtoms(connectionAtomRuntime);
export const linkedPullRequestDetailAtom = createLinkedPullRequestSummaryAtomFamily(
  connectionAtomRuntime,
  pullRequestEnvironment.refreshes,
);

const observedPullRequestSummaryAtom = Atom.family((key: string) =>
  Atom.make<PullRequestSummary | null>(null).pipe(
    Atom.setIdleTTL(5 * 60_000),
    Atom.withLabel(`web-pull-requests:observed-summary:${key}`),
  ),
);

export function newestPullRequestSummary(
  current: PullRequestSummary | null,
  observed: PullRequestSummary | null,
): PullRequestSummary | null {
  if (current === null) return observed;
  if (observed === null) return current;
  if (current.state === "merged") return current;
  if (observed.state === "merged") return observed;
  return Date.parse(observed.updatedAt) >= Date.parse(current.updatedAt) ? observed : current;
}

export function useSharedPullRequestSummary(
  environmentId: EnvironmentId | null,
  reference: PullRequestRef | null,
  current: PullRequestSummary | null,
): PullRequestSummary | null {
  const key =
    environmentId === null || reference === null
      ? "none"
      : JSON.stringify([
          environmentId,
          reference.projectId,
          reference.repository.toLowerCase(),
          reference.number,
        ]);
  const atom = observedPullRequestSummaryAtom(key);
  const observed = useAtomValue(atom);
  useLayoutEffect(() => {
    if (environmentId === null || current === null) return;
    appAtomRegistry.modify(atom, (previous) => {
      const next = newestPullRequestSummary(previous, current);
      return next === previous ? [false, previous] : [true, next];
    });
  }, [atom, current, environmentId]);
  return newestPullRequestSummary(current, observed);
}

export function usePullRequestTurnRefresh(environmentId: EnvironmentId): number | null {
  const result = useAtomValue(pullRequestEnvironment.refreshes({ environmentId, input: {} }));
  return Option.getOrNull(AsyncResult.value(result));
}
