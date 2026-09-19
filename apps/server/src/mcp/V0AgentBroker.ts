import {
  V0AgentError,
  V0_AGENT_TIMEOUT_MS,
  type V0AgentHost,
  type V0AgentEvent,
  type V0AgentResponse,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

export class V0AgentBroker extends Context.Service<
  V0AgentBroker,
  {
    install: (
      register: (tools: typeof V0AgentHost.Type.tools) => Effect.Effect<void, V0AgentError>,
    ) => Effect.Effect<void>;
    connect: (
      sessionId: string,
      host: typeof V0AgentHost.Type,
    ) => Stream.Stream<typeof V0AgentEvent.Type, V0AgentError>;
    respond: (sessionId: string, response: typeof V0AgentResponse.Type) => Effect.Effect<void>;
    invoke: (name: string, args: Record<string, unknown>) => Effect.Effect<unknown, V0AgentError>;
  }
>()("t3/mcp/V0AgentBroker") {}

export const layer = Layer.effect(
  V0AgentBroker,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    let register:
      | ((tools: typeof V0AgentHost.Type.tools) => Effect.Effect<void, V0AgentError>)
      | undefined;
    let host:
      | { sessionId: string; queue: Queue.Queue<typeof V0AgentEvent.Type>; names: Set<unknown> }
      | undefined;
    const pending = new Map<string, Deferred.Deferred<unknown, V0AgentError>>();
    const unavailable = () =>
      new V0AgentError({
        message:
          "v0 tools are unavailable. Keep the connected CoCo desktop open. Reconnect v0 in Settings if needed.",
      });
    return {
      install: (next) =>
        Effect.sync(() => {
          register = next;
        }),
      connect: (sessionId, input) =>
        Stream.unwrap(
          Effect.acquireRelease(
            Effect.gen(function* () {
              if (host)
                return yield* new V0AgentError({
                  message: "Another desktop window is already providing v0 tools.",
                });
              if (!register) return yield* unavailable();
              const queue = yield* Queue.unbounded<typeof V0AgentEvent.Type>();
              const connection = {
                sessionId,
                queue,
                names: new Set(input.tools.map((tool) => tool.name)),
              };
              host = connection;
              yield* register(input.tools).pipe(
                Effect.onError(() =>
                  Effect.gen(function* () {
                    host = undefined;
                    yield* Queue.shutdown(queue);
                  }),
                ),
              );
              yield* Effect.logInfo("v0 chat tools registered", {
                toolCount: input.tools.length,
              });
              yield* Queue.offer(queue, { type: "connected" });
              return connection;
            }),
            (connection) =>
              Effect.gen(function* () {
                if (host !== connection) return;
                host = undefined;
                for (const deferred of pending.values())
                  yield* Deferred.fail(
                    deferred,
                    new V0AgentError({
                      message:
                        "v0 desktop disconnected. A dispatched write may have completed; inspect the existing v0 chat before retrying; do not repeat generation automatically.",
                    }),
                  );
                pending.clear();
                yield* Queue.shutdown(connection.queue);
              }),
          ).pipe(Effect.map((connection) => Stream.fromQueue(connection.queue))),
        ),
      respond: (sessionId, response) =>
        Effect.gen(function* () {
          if (host?.sessionId !== sessionId) return;
          const deferred = pending.get(response.requestId);
          if (!deferred) return;
          if (response.error)
            yield* Deferred.fail(deferred, new V0AgentError({ message: response.error }));
          else yield* Deferred.succeed(deferred, response.result);
        }),
      invoke: (name, args) =>
        Effect.gen(function* () {
          const connection = host;
          if (!connection || !connection.names.has(name)) return yield* unavailable();
          const requestId = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
          if (host !== connection) return yield* unavailable();
          const expiresAt = (yield* Clock.currentTimeMillis) + V0_AGENT_TIMEOUT_MS;
          const deferred = yield* Deferred.make<unknown, V0AgentError>();
          pending.set(requestId, deferred);
          return yield* Effect.gen(function* () {
            yield* Queue.offer(connection.queue, {
              type: "request",
              request: { requestId, name, expiresAt, arguments: args },
            });
            return yield* Deferred.await(deferred);
          }).pipe(
            Effect.timeoutOrElse({
              duration: V0_AGENT_TIMEOUT_MS,
              orElse: () =>
                Effect.fail(
                  new V0AgentError({
                    message:
                      "v0 tool timed out. A dispatched write may have completed; inspect the existing v0 chat before retrying; do not repeat generation automatically.",
                  }),
                ),
            }),
            Effect.ensuring(
              Effect.sync(() => {
                pending.delete(requestId);
              }),
            ),
          );
        }),
    };
  }),
);
