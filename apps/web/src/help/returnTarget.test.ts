import { describe, expect, it, vi } from "vite-plus/test";

import {
  isHelpPath,
  nextHelpReturn,
  retainHelpReturn,
  resolveHelpReturnHref,
  safeReturnHref,
  type HelpReturnTarget,
} from "./returnTarget";

const workspace: HelpReturnTarget = {
  href: "/environment-a/thread-a?view=changes#message-42",
  manage: true,
  projectScope: "project-a",
};

describe("Help return destination", () => {
  it("keeps the originating environment, thread, query, hash, mode, and project", () => {
    const captured = nextHelpReturn(null, workspace);
    const exists = vi.fn(
      (environmentId: string, threadId: string) =>
        environmentId === "environment-a" && threadId === "thread-a",
    );
    const draftExists = vi.fn(() => false);

    expect(captured).toEqual(workspace);
    expect(resolveHelpReturnHref(captured, exists, draftExists)).toBe(workspace.href);
    expect(exists).toHaveBeenCalledExactlyOnceWith("environment-a", "thread-a");
    expect(draftExists).not.toHaveBeenCalled();
  });

  it("preserves the first workspace through articles and linked Settings", () => {
    let captured = nextHelpReturn(null, workspace);
    for (const href of [
      "/help/jira#connect-with-sso",
      "/help/manage",
      "/settings/integrations#jira",
      "/help/troubleshooting",
      "/settings/projects?project=project-b",
    ]) {
      captured = retainHelpReturn(captured, href.split(/[?#]/)[0]!);
      captured = nextHelpReturn(captured, {
        href,
        manage: false,
        projectScope: "project-b",
      });
    }

    expect(captured).toEqual(workspace);
  });

  it("starts a new Settings-origin visit after abandoning Help for Build", () => {
    let captured = nextHelpReturn(null, workspace);
    captured = retainHelpReturn(captured, "/help/jira");
    expect(captured).toEqual(workspace);

    captured = retainHelpReturn(captured, "/");
    expect(captured).toBeNull();
    captured = retainHelpReturn(captured, "/settings/integrations");
    const settings = {
      href: "/settings/integrations#servicenow-sdk",
      manage: false,
      projectScope: "project-b",
    };
    captured = nextHelpReturn(captured, settings);
    captured = retainHelpReturn(captured, "/help/servicenow");

    expect(captured).toEqual(settings);
    expect(
      resolveHelpReturnHref(
        captured,
        () => false,
        () => false,
      ),
    ).toBe(settings.href);
  });

  it("does not retain an abandoned visit when another conversation is opened", () => {
    const captured = retainHelpReturn(workspace, "/environment-b/thread-b");

    expect(captured).toBeNull();
    expect(retainHelpReturn(captured, "/settings")).toBeNull();
    expect(retainHelpReturn(captured, "/help/getting-started")).toBeNull();
  });

  it("captures a newly chosen workspace for a subsequent Help visit", () => {
    const nextWorkspace = {
      href: "/environment-b/thread-b",
      manage: false,
      projectScope: "project-b",
    };

    expect(nextHelpReturn(workspace, nextWorkspace)).toEqual(nextWorkspace);
  });

  it("returns to Settings when Help was first opened there", () => {
    const settings = {
      href: "/settings/providers?provider=codex#setup",
      manage: false,
      projectScope: null,
    };
    const captured = nextHelpReturn(null, settings);
    const exists = vi.fn(() => false);
    const draftExists = vi.fn(() => false);

    expect(captured).toEqual(settings);
    expect(resolveHelpReturnHref(captured, exists, draftExists)).toBe(settings.href);
    expect(exists).not.toHaveBeenCalled();
    expect(draftExists).not.toHaveBeenCalled();
  });

  it("keeps an existing draft without selecting a server conversation", () => {
    const draft = { ...workspace, href: "/draft/draft%20one?panel=files#composer" };
    const exists = vi.fn(() => false);
    const draftExists = vi.fn((id: string) => id === "draft one");

    expect(resolveHelpReturnHref(draft, exists, draftExists)).toBe(draft.href);
    expect(draftExists).toHaveBeenCalledExactlyOnceWith("draft one");
    expect(exists).not.toHaveBeenCalled();
  });

  it("returns to project selection when the originating draft was deleted", () => {
    const exists = vi.fn(() => true);
    const draftExists = vi.fn(() => false);

    expect(
      resolveHelpReturnHref({ ...workspace, href: "/draft/deleted-draft" }, exists, draftExists),
    ).toBe("/settings/projects");
    expect(exists).not.toHaveBeenCalled();
  });

  it("does not substitute an unrelated conversation for a deleted originating thread", () => {
    const exists = vi.fn(
      (environmentId: string, threadId: string) =>
        environmentId === "environment-b" && threadId === "thread-a",
    );

    expect(resolveHelpReturnHref(workspace, exists, () => false)).toBe("/settings/projects");
    expect(exists).toHaveBeenCalledExactlyOnceWith("environment-a", "thread-a");
  });

  it("decodes route identifiers for lookup while retaining the original destination", () => {
    const target = { ...workspace, href: "/environment%20a/thread%20a?panel=diff#change" };
    const exists = vi.fn(() => true);

    expect(resolveHelpReturnHref(target, exists, () => false)).toBe(target.href);
    expect(exists).toHaveBeenCalledExactlyOnceWith("environment a", "thread a");
  });

  it("uses project selection for a direct Help visit with no originating workspace", () => {
    const exists = vi.fn(() => true);
    const draftExists = vi.fn(() => true);

    expect(nextHelpReturn(null, { ...workspace, href: "/help/getting-started" })).toBeNull();
    expect(resolveHelpReturnHref(null, exists, draftExists)).toBe("/settings/projects");
    expect(exists).not.toHaveBeenCalled();
    expect(draftExists).not.toHaveBeenCalled();
  });

  it.each([
    "https://example.com/work",
    "//example.com/work",
    "javascript:alert(1)",
    "/\\example.com/work",
    "/environment-a/thread-a\n",
    "/help",
    "/help/technical?topic=storage#logs",
  ])("rejects an unsafe or recursive destination: %s", (href) => {
    const exists = vi.fn(() => true);
    const draftExists = vi.fn(() => true);

    expect(safeReturnHref(href)).toBe("/settings/projects");
    expect(resolveHelpReturnHref({ ...workspace, href }, exists, draftExists)).toBe(
      "/settings/projects",
    );
    expect(exists).not.toHaveBeenCalled();
    expect(draftExists).not.toHaveBeenCalled();
  });

  it.each(["/environment-a/%E0%A4%A", "/draft/%invalid"])(
    "recovers from an invalid encoded route: %s",
    (href) => {
      const exists = vi.fn(() => true);
      const draftExists = vi.fn(() => true);

      expect(resolveHelpReturnHref({ ...workspace, href }, exists, draftExists)).toBe(
        "/settings/projects",
      );
      expect(exists).not.toHaveBeenCalled();
      expect(draftExists).not.toHaveBeenCalled();
    },
  );

  it("recognizes Help routes without treating similarly named routes as Help", () => {
    expect(isHelpPath("/help")).toBe(true);
    expect(isHelpPath("/help/technical")).toBe(true);
    expect(isHelpPath("/helpful/project")).toBe(false);
    expect(isHelpPath("/settings/help")).toBe(false);
  });
});
