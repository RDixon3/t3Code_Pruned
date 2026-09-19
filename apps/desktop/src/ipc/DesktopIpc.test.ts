import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

import * as DesktopIpc from "./DesktopIpc.ts";
import { trustDesktopIpcSender } from "./TrustedIpcSender.ts";

const invokeMethod: DesktopIpc.DesktopIpcMethod<never, never> = {
  channel: "desktop.test.invoke",
  handler: () => Effect.void,
};

const syncMethod: DesktopIpc.DesktopSyncIpcMethod<never, never> = {
  channel: "desktop.test.sync",
  handler: () => Effect.void,
};

function makeIpcMain(
  overrides: Partial<DesktopIpc.DesktopIpcMain> = {},
): DesktopIpc.DesktopIpcMain {
  return {
    removeHandler: vi.fn(),
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

describe("DesktopIpc", () => {
  it.effect("preserves invoke registration context and cause", () =>
    Effect.gen(function* () {
      const cause = new Error("invoke registration failed");
      const ipcMain = makeIpcMain({
        handle: () => {
          throw cause;
        },
      });
      const ipc = DesktopIpc.make(ipcMain);

      const error = yield* Effect.flip(Effect.scoped(ipc.handle(invokeMethod)));

      assert.instanceOf(error, DesktopIpc.DesktopIpcRegistrationError);
      assert.strictEqual(error.handlerKind, "invoke");
      assert.strictEqual(error.channel, invokeMethod.channel);
      assert.strictEqual(error.cause, cause);
      assert.include(error.message, "invoke");
      assert.include(error.message, invokeMethod.channel);
      assert.notInclude(error.message, cause.message);
    }),
  );

  it.effect("forwards the invoke sender to the method", () =>
    Effect.gen(function* () {
      let listener: DesktopIpc.DesktopIpcHandleListener | undefined;
      const ipc = DesktopIpc.make(
        makeIpcMain({
          handle: (_channel, registered) => {
            listener = registered;
          },
        }),
      );
      const frame = { url: "t3code://app/" };
      const sender = { sender: { id: 7, mainFrame: frame }, senderFrame: frame };
      const revoke = trustDesktopIpcSender(sender.sender, frame.url);
      let received: DesktopIpc.DesktopIpcInvokeEvent | undefined;

      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* ipc.handle({
            channel: "desktop.test.sender",
            handler: (_raw, event) =>
              Effect.sync(() => {
                received = event;
              }),
          });
          yield* Effect.promise(async () => listener!(sender, undefined));
        }),
      );

      assert.strictEqual(received, sender);
      revoke();
    }),
  );

  it.effect("rejects untrusted invoke and sync callers before running privileged handlers", () =>
    Effect.gen(function* () {
      let invoke: DesktopIpc.DesktopIpcHandleListener | undefined;
      let sync: DesktopIpc.DesktopIpcSyncListener | undefined;
      const called = vi.fn();
      const ipc = DesktopIpc.make(
        makeIpcMain({
          handle: (_channel, listener) => {
            invoke = listener;
          },
          on: (_channel, listener) => {
            sync = listener;
          },
        }),
      );
      const frame = { url: "t3code://app/" };
      const guest = {
        sender: { id: 8, mainFrame: frame },
        senderFrame: frame,
        returnValue: undefined as unknown,
      };
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* ipc.handle({ channel: "desktop.test.invoke", handler: () => Effect.sync(called) });
          yield* ipc.handleSync({
            channel: "desktop.test.sync",
            handler: () => Effect.sync(called),
          });
          assert.throws(() => invoke!(guest, undefined), "Desktop request was rejected.");
          sync!(guest);
          assert.strictEqual(guest.returnValue, null);
          assert.strictEqual(called.mock.calls.length, 0);
        }),
      );
    }),
  );

  it.effect("preserves sync unregistration context and cause in the finalizer defect", () =>
    Effect.gen(function* () {
      const cause = new Error("sync unregistration failed");
      let removeCount = 0;
      const ipcMain = makeIpcMain({
        removeAllListeners: () => {
          removeCount += 1;
          if (removeCount === 2) throw cause;
        },
      });
      const ipc = DesktopIpc.make(ipcMain);

      const exit = yield* Effect.exit(Effect.scoped(ipc.handleSync(syncMethod)));

      assert.isTrue(exit._tag === "Failure");
      if (exit._tag === "Success") return;
      const error = Cause.squash(exit.cause);
      assert.instanceOf(error, DesktopIpc.DesktopIpcUnregistrationError);
      assert.strictEqual(error.handlerKind, "sync");
      assert.strictEqual(error.channel, syncMethod.channel);
      assert.strictEqual(error.cause, cause);
      assert.notInclude(error.message, cause.message);
    }),
  );
});
