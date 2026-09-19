import { jiraAgentStatus } from "../../state/jiraAgent";
import { describe, expect, it, vi } from "vite-plus/test";
import type { JiraAgentEvent } from "@t3tools/contracts";
import { Atom, AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { createJiraAgentConsumer } from "./jiraAgentConsumer";

const request = {
  type: "request" as const,
  request: { requestId: "write-1", name: "editJiraIssue", arguments: {}, expiresAt: 1000 },
};
describe("Jira agent request consumer", () => {
  it("starts the lazy host stream and reports readiness before handling calls", async () => {
    const registry = AtomRegistry.make();
    const source = Atom.make(
      AsyncResult.success<typeof JiraAgentEvent.Type, Error>({ type: "connected" }),
    );
    let started = false;
    const stream = Atom.make((get) => {
      started = true;
      return get(source);
    });
    const call = vi.fn(async () => ({ content: [] }));
    let done!: () => void;
    const replied = new Promise<void>((resolve) => {
      done = resolve;
    });
    const send = vi.fn(async () => {
      done();
    });
    const unmount = registry.mount(createJiraAgentConsumer(stream, 1, call, send));
    try {
      expect(started).toBe(true);
      await Promise.resolve();
      expect(registry.get(jiraAgentStatus)).toContain("Jira chat tools ready (1)");
      registry.set(source, AsyncResult.success(request));
      await replied;
      expect(call).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      registry.dispose();
    }
  });
  it("does not replay cached or repeated writes", async () => {
    const registry = AtomRegistry.make();
    const stream = Atom.make(AsyncResult.success<typeof JiraAgentEvent.Type, Error>(request));
    const call = vi.fn(async () => ({ content: [] }));
    let done!: () => void;
    const response = new Promise<void>((resolve) => {
      done = resolve;
    });
    const send = vi.fn(async () => {
      done();
    });
    const consumer = createJiraAgentConsumer(stream, 1, call, send);
    const unmount = registry.mount(consumer);
    await Promise.resolve();
    expect(call).not.toHaveBeenCalled();
    registry.set(
      stream,
      AsyncResult.success({ ...request, request: { ...request.request, requestId: "write-2" } }),
    );
    await response;
    registry.set(
      stream,
      AsyncResult.success({ ...request, request: { ...request.request, requestId: "write-2" } }),
    );
    expect(call).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    unmount();
    registry.dispose();
  });
  it("reports a tool failure once without retrying it", async () => {
    const registry = AtomRegistry.make();
    const stream = Atom.make(
      AsyncResult.success<typeof JiraAgentEvent.Type, Error>({ type: "connected" }),
    );
    const call = vi.fn(async () => {
      throw new Error("private upstream failure");
    });
    let done!: () => void;
    const response = new Promise<void>((resolve) => {
      done = resolve;
    });
    const send = vi.fn(async () => {
      done();
    });
    const unmount = registry.mount(createJiraAgentConsumer(stream, 1, call, send));
    registry.set(stream, AsyncResult.success(request));
    await response;
    expect(call).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "write-1",
        error: expect.stringContaining("may have completed"),
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain("private");
    unmount();
    registry.dispose();
  });
});
