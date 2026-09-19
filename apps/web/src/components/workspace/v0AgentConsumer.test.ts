import { v0AgentStatus } from "../../state/v0Agent";
import { describe, expect, it, vi } from "vite-plus/test";
import type { V0AgentEvent } from "@t3tools/contracts";
import { Atom, AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { createV0AgentConsumer } from "./v0AgentConsumer";

const request = {
  type: "request" as const,
  request: { requestId: "write-1", name: "editV0Issue", arguments: {}, expiresAt: 1000 },
};
describe("V0 agent request consumer", () => {
  it("starts the lazy host stream and reports readiness before handling calls", async () => {
    const registry = AtomRegistry.make();
    const source = Atom.make(
      AsyncResult.success<typeof V0AgentEvent.Type, Error>({ type: "connected" }),
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
    const unmount = registry.mount(createV0AgentConsumer(stream, 1, call, send));
    try {
      expect(started).toBe(true);
      await Promise.resolve();
      expect(registry.get(v0AgentStatus)).toContain("v0 chat tools ready (1)");
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
    const stream = Atom.make(AsyncResult.success<typeof V0AgentEvent.Type, Error>(request));
    const call = vi.fn(async () => ({ content: [] }));
    let done!: () => void;
    const response = new Promise<void>((resolve) => {
      done = resolve;
    });
    const send = vi.fn(async () => {
      done();
    });
    const consumer = createV0AgentConsumer(stream, 1, call, send);
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
      AsyncResult.success<typeof V0AgentEvent.Type, Error>({ type: "connected" }),
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
    const unmount = registry.mount(createV0AgentConsumer(stream, 1, call, send));
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

it("does not retry tool execution when delivering its response fails", async () => {
  const registry = AtomRegistry.make();
  const stream = Atom.make(
    AsyncResult.success<typeof V0AgentEvent.Type, Error>({ type: "connected" }),
  );
  const call = vi.fn(async () => ({ content: [] }));
  const send = vi.fn(async () => {
    throw new Error("connection lost");
  });
  let finish!: () => void;
  const failed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const unsubscribe = registry.subscribe(v0AgentStatus, (value) => {
    if (value.includes("could not be delivered")) finish();
  });
  const unmount = registry.mount(createV0AgentConsumer(stream, 1, call, send));
  try {
    registry.set(stream, AsyncResult.success(request));
    await failed;
    expect(call).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    unmount();
    unsubscribe();
    registry.dispose();
  }
});
