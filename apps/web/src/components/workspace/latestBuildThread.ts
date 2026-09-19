import { sortThreads, type ThreadSortInput } from "../../lib/threadSort";

export function latestBuildThread<
  T extends ThreadSortInput & {
    readonly id: string;
    readonly environmentId: string;
    readonly projectId: string;
    readonly archivedAt: string | null;
  },
>(
  refs: ReadonlyArray<{ environmentId: string; projectId: string }>,
  threads: ReadonlyArray<T>,
): T | null {
  return (
    sortThreads(
      threads.filter(
        (thread) =>
          thread.archivedAt === null &&
          refs.some(
            (ref) =>
              ref.environmentId === thread.environmentId && ref.projectId === thread.projectId,
          ),
      ),
      "updated_at",
    )[0] ?? null
  );
}
