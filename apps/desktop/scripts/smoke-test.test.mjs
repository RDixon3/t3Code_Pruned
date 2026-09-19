import * as NodeEvents from "node:events";
import * as NodePath from "node:path";
import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  assertIsolatedUserData,
  makeSmokeEnvironment,
  waitForDesktopReady,
} from "./smoke-test.mjs";

const root = NodePath.resolve("isolated-smoke");
function fixture() {
  const child = Object.assign(new NodeEvents.EventEmitter(), {
    exitCode: null,
    signalCode: null,
    stdout: new NodeEvents.EventEmitter(),
    stderr: new NodeEvents.EventEmitter(),
  });
  const page = Object.assign(new NodeEvents.EventEmitter(), {
    waitForURL: vi.fn(async () => undefined),
    getByRole: () => ({ waitFor: async () => undefined, click: async () => undefined }),
    evaluate: vi.fn(async () => true),
    pageErrors: vi.fn(async () => []),
  });
  const app = Object.assign(new NodeEvents.EventEmitter(), {
    process: () => child,
    windows: () => [page],
    firstWindow: vi.fn(async () => page),
    evaluate: async () => NodePath.join(root, "home", "profile"),
  });
  return { app, page, child };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("isolates user state and omits ambient dev endpoints and credentials", () => {
  const env = makeSmokeEnvironment(root, {
    Path: "/tools",
    HOME: "/real",
    T3CODE_HOME: "/real-state",
    VITE_DEV_SERVER_URL: "http://dev",
    OPENAI_API_KEY: "secret",
    ELECTRON_RUN_AS_NODE: "1",
  });
  expect(env.Path).toBe("/tools");
  expect(env.HOME).toBe(NodePath.join(root, "home"));
  expect(env.T3CODE_HOME).toBe(NodePath.join(root, "state"));
  expect(env).not.toHaveProperty("VITE_DEV_SERVER_URL");
  expect(env).not.toHaveProperty("OPENAI_API_KEY");
  expect(env).not.toHaveProperty("ELECTRON_RUN_AS_NODE");
  expect(() => assertIsolatedUserData(root, NodePath.join(root, "profile"))).not.toThrow();
  expect(() => assertIsolatedUserData(root, root + "-other/profile")).toThrow("non-isolated");
});
it("requires a usable window, connected local environment, and IPC", async () => {
  const { app } = fixture();
  await expect(waitForDesktopReady(app, root)).resolves.toBeUndefined();
});
it("fails even if the process exits cleanly before its first window", async () => {
  const { app, child } = fixture();
  app.firstWindow.mockImplementation(() => new Promise(() => {}));
  const result = waitForDesktopReady(app, root);
  child.emit("exit", 0);
  await expect(result).rejects.toThrow("exited before startup");
});
it("fails when a launched app never becomes ready", async () => {
  vi.useFakeTimers();
  const { app } = fixture();
  app.firstWindow.mockImplementation(() => new Promise(() => {}));
  const result = expect(waitForDesktopReady(app, root, 20)).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(20);
  await result;
});
it("fails on renderer exceptions before readiness", async () => {
  const { app, page } = fixture();
  app.firstWindow.mockImplementation(() => new Promise(() => {}));
  const result = waitForDesktopReady(app, root);
  page.emit("pageerror", new Error("Renderer crashed"));
  await expect(result).rejects.toThrow("Renderer crashed");
});
it("fails when the preload bridge was rejected", async () => {
  const { app, page } = fixture();
  page.evaluate.mockRejectedValue(new Error("IPC sender rejected"));
  await expect(waitForDesktopReady(app, root)).rejects.toThrow("IPC sender rejected");
});
it("rejects a previously emitted renderer exception", async () => {
  const { app, page } = fixture();
  page.pageErrors.mockResolvedValue([new Error("Early preload error")]);
  await expect(waitForDesktopReady(app, root)).rejects.toThrow("Early preload error");
});

it("accepts absent saved settings on a fresh desktop profile", async () => {
  const { app, page } = fixture();
  vi.stubGlobal("window", { desktopBridge: { getClientSettings: async () => null } });
  page.evaluate.mockImplementation(async (readiness) => readiness());
  await expect(waitForDesktopReady(app, root)).resolves.toBeUndefined();
});
it("fails when the preload did not expose the desktop bridge", async () => {
  const { app, page } = fixture();
  vi.stubGlobal("window", {});
  page.evaluate.mockImplementation(async (readiness) => readiness());
  await expect(waitForDesktopReady(app, root)).rejects.toThrow("preload IPC is unavailable");
});
