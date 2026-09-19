import { describe, expect, it } from "vite-plus/test";
import { latestBuildThread } from "./latestBuildThread";

const thread = (id: string, environmentId: string, projectId: string, date: string) => ({
  id,
  environmentId,
  projectId,
  createdAt: date,
  updatedAt: date,
  archivedAt: null as string | null,
});

describe("Build project selection", () => {
  it("does not cross projects or environments even when another thread is newer", () => {
    const selected = thread("selected", "local", "project", "2026-09-01");
    expect(
      latestBuildThread(
        [{ environmentId: "local", projectId: "project" }],
        [
          thread("other-project", "local", "other", "2026-09-09"),
          thread("other-environment", "remote", "project", "2026-09-09"),
          selected,
        ],
      ),
    ).toBe(selected);
  });
  it("resumes the latest conversation rather than a recently edited or archived record", () => {
    const recent = {
      ...thread("recent", "local", "project", "2026-09-02"),
      latestUserMessageAt: "2026-09-08",
    };
    expect(
      latestBuildThread(
        [{ environmentId: "local", projectId: "project" }],
        [
          {
            ...thread("metadata-change", "local", "project", "2026-09-09"),
            latestUserMessageAt: "2026-09-01",
          },
          { ...thread("archived", "local", "project", "2026-09-09"), archivedAt: "2026-09-09" },
          recent,
        ],
      ),
    ).toBe(recent);
  });
  it("does not choose an arbitrary project when none is selected or has threads", () => {
    const threads = [thread("one", "local", "project", "2026-09-01")];
    expect(latestBuildThread([], threads)).toBeNull();
    expect(latestBuildThread([{ environmentId: "local", projectId: "empty" }], threads)).toBeNull();
  });
});
