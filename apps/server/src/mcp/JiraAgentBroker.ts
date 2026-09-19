import {
  JiraAgentError,
  type JiraAgentHost,
  type JiraAgentEvent,
  type JiraAgentResponse,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

export class JiraAgentBroker extends Context.Service<
  JiraAgentBroker,
  {
    install: (
      register: (tools: typeof JiraAgentHost.Type.tools) => Effect.Effect<void, JiraAgentError>,
    ) => Effect.Effect<void>;
    connect: (
      sessionId: string,
      host: typeof JiraAgentHost.Type,
    ) => Stream.Stream<typeof JiraAgentEvent.Type, JiraAgentError>;
    respond: (sessionId: string, response: typeof JiraAgentResponse.Type) => Effect.Effect<void>;
    invoke: (name: string, args: Record<string, unknown>) => Effect.Effect<unknown, JiraAgentError>;
  }
>()("t3/mcp/JiraAgentBroker") {}

export const layer = Layer.effect(
  JiraAgentBroker,
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    let register:
      | ((tools: typeof JiraAgentHost.Type.tools) => Effect.Effect<void, JiraAgentError>)
      | undefined;
    let host:
      | { sessionId: string; queue: Queue.Queue<typeof JiraAgentEvent.Type>; names: Set<unknown> }
      | undefined;
    const pending = new Map<string, Deferred.Deferred<unknown, JiraAgentError>>();
    const unavailable = () =>
      new JiraAgentError({
        message:
          "Jira tools are unavailable. Keep the connected CoCo desktop open. Reconnect Jira in Settings if needed.",
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
                return yield* new JiraAgentError({
                  message: "Another desktop window is already providing Jira tools.",
                });
              if (!register) return yield* unavailable();
              const queue = yield* Queue.unbounded<typeof JiraAgentEvent.Type>();
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
              yield* Effect.logInfo("Jira chat tools registered", {
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
                    new JiraAgentError({
                      message:
                        "Jira desktop disconnected. A dispatched write may have completed; check Jira before retrying.",
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
            yield* Deferred.fail(deferred, new JiraAgentError({ message: response.error }));
          else yield* Deferred.succeed(deferred, response.result);
        }),
      invoke: (name, args) =>
        Effect.gen(function* () {
          const connection = host;
          if (!connection || !connection.names.has(name)) return yield* unavailable();
          const requestId = yield* crypto.randomUUIDv4.pipe(Effect.orDie);
          if (host !== connection) return yield* unavailable();
          const expiresAt = (yield* Clock.currentTimeMillis) + 120_000;
          const deferred = yield* Deferred.make<unknown, JiraAgentError>();
          pending.set(requestId, deferred);
          return yield* Effect.gen(function* () {
            yield* Queue.offer(connection.queue, {
              type: "request",
              request: { requestId, name, expiresAt, arguments: args },
            });
            return yield* Deferred.await(deferred);
          }).pipe(
            Effect.timeoutOrElse({
              duration: "2 minutes",
              orElse: () =>
                Effect.fail(
                  new JiraAgentError({
                    message:
                      "Jira tool timed out. A dispatched write may have completed; check Jira before retrying.",
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
