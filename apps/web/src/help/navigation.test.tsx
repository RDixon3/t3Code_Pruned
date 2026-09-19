import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { uiState, readThreadShell, getDraftSession } = vi.hoisted(() => {
  const state = {
    manageLayout: false,
    sidebarProjectScopeKey: null as string | null,
    setManageLayout: vi.fn((value: boolean) => {
      state.manageLayout = value;
    }),
    setSidebarProjectScopeKey: vi.fn((value: string | null) => {
      state.sidebarProjectScopeKey = value;
    }),
  };
  return {
    uiState: state,
    readThreadShell: vi.fn(() => ({ id: "thread-a" })),
    getDraftSession: vi.fn(() => null),
  };
});

vi.mock("../uiStateStore", () => ({ useUiStateStore: { getState: () => uiState } }));
vi.mock("../state/entities", () => ({ readThreadShell }));
vi.mock("../composerDraftStore", () => ({
  DraftId: { make: (value: string) => value },
  useComposerDraftStore: { getState: () => ({ getDraftSession }) },
}));

import { updateHelpVisit, useHelpReturn, useOpenHelp } from "./navigation";

function SourcePage() {
  const openHelp = useOpenHelp();
  return <button onClick={() => openHelp("jira", "connect-with-sso")}>Open Help</button>;
}

function HelpPage() {
  const { goBack, label } = useHelpReturn();
  return <button onClick={goBack}>{label}</button>;
}

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    location: new URL("http://localhost/#/settings/general"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("history", {});
  vi.stubGlobal("self", {});
  vi.stubGlobal("addEventListener", vi.fn());
  uiState.manageLayout = false;
  uiState.sidebarProjectScopeKey = null;
  vi.clearAllMocks();
  updateHelpVisit("/");
});

afterEach(async () => {
  await act(() => renderer?.unmount());
  renderer = undefined;
  updateHelpVisit("/");
  vi.unstubAllGlobals();
});

async function openSource(href: string) {
  const root = createRootRoute({ component: Outlet });
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/settings/$page", component: SourcePage }),
    createRoute({
      getParentRoute: () => root,
      path: "/$environmentId/$threadId",
      validateSearch: (search: Record<string, unknown>) => search,
      component: SourcePage,
    }),
    createRoute({ getParentRoute: () => root, path: "/help/$articleId", component: HelpPage }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    isServer: false,
    scrollRestoration: () => false,
  });
  await router.load();
  await act(() => {
    renderer = create(<RouterProvider router={router} />);
  });
  return router;
}

async function pressButton(router: Awaited<ReturnType<typeof openSource>>, label: string) {
  const button = renderer!.root.findByType("button");
  expect(button.children).toEqual([label]);
  await act(async () => {
    button.props.onClick();
    await router.load();
  });
}

describe("Help navigation through the application router", () => {
  it("returns to Settings when Electron's shell keeps the app route in its hash", async () => {
    const router = await openSource("/settings/general");
    expect(window.location.pathname + window.location.hash).toBe("/#/settings/general");

    await pressButton(router, "Open Help");
    expect(router.state.location.href).toBe("/help/jira#connect-with-sso");
    await pressButton(router, "Back to Settings");

    expect(router.state.location.href).toBe("/settings/general");
    expect(readThreadShell).not.toHaveBeenCalled();
  });

  it("restores a thread's route, query, hash, mode, and project instead of the shell URL", async () => {
    const originalHref = "/environment-a/thread-a?view=changes#message-42";
    uiState.manageLayout = true;
    uiState.sidebarProjectScopeKey = "project-a";
    const router = await openSource(originalHref);

    await pressButton(router, "Open Help");
    uiState.manageLayout = false;
    uiState.sidebarProjectScopeKey = "project-b";
    await pressButton(router, "Back to workspace");

    expect(router.state.location.href).toBe(originalHref);
    expect(readThreadShell).toHaveBeenCalledExactlyOnceWith({
      environmentId: "environment-a",
      threadId: "thread-a",
    });
    expect(uiState.manageLayout).toBe(true);
    expect(uiState.sidebarProjectScopeKey).toBe("project-a");
  });
});
