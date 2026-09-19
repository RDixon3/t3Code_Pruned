import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { McpSchema, McpServer } from "effect/unstable/ai";
import * as Broker from "./JiraAgentBroker.ts";
import { registration } from "./JiraAgentTools.ts";
import { McpInvocationContext } from "./McpInvocationContext.ts";

const TestLayer = registration.pipe(
  Layer.provideMerge(McpServer.McpServer.layer),
  Layer.provideMerge(Broker.layer),
  Layer.provideMerge(NodeServices.layer),
);
const tool = {
  name: "editJiraIssue",
  description: "Edit an issue",
  inputSchema: {
    type: "object",
    properties: { issueIdOrKey: { type: "string" } },
    required: ["issueIdOrKey"],
  },
  annotations: { destructiveHint: true, readOnlyHint: false },
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "test", version: "1" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  },
  getClient: Effect.die("unused"),
});
const call = (provider: string, jira = true) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server.callTool({ name: tool.name, arguments: { issueIdOrKey: "TEAM-1" } }).pipe(
      Effect.provideService(McpSchema.McpServerClient, client),
      Effect.provideService(McpInvocationContext, {
        environmentId: EnvironmentId.make("local"),
        threadId: ThreadId.make("thread"),
        providerSessionId: "session",
        providerInstanceId: ProviderInstanceId.make(provider),
        capabilities: new Set(jira ? (["jira"] as const) : []),
        issuedAt: 1,
      }),
    );
  });

it.effect(
  "advertises upstream schemas and forwards raw results through the shared endpoint for all three providers",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const broker = yield* Broker.JiraAgentBroker;
        const server = yield* McpServer.McpServer;
        const ready = yield* Deferred.make<void>();
        const calls: unknown[] = [];
        const result = {
          content: [{ type: "text", text: "updated" }],
          structuredContent: { key: "TEAM-1" },
          isError: false,
        };
        yield* broker.connect("desktop", { tools: [tool] }).pipe(
          Stream.runForEach((event) => {
            if (event.type === "connected") return Deferred.succeed(ready, undefined);
            calls.push(event.request);
            return broker.respond("desktop", { requestId: event.request.requestId, result });
          }),
          Effect.forkScoped,
        );
        yield* Deferred.await(ready);
        expect(server.tools.find((entry) => entry.tool.name === tool.name)?.tool).toMatchObject(
          tool,
        );
        for (const provider of ["codex", "claude-code", "cursor"])
          expect(yield* call(provider)).toMatchObject(result);
        expect(yield* call("codex", false)).toMatchObject({ isError: true });
        expect(calls).toHaveLength(3);
        expect(calls[0]).toMatchObject({
          name: "editJiraIssue",
          arguments: { issueIdOrKey: "TEAM-1" },
        });
      }),
    ).pipe(Effect.provide(TestLayer)),
);

it.effect(
  "ignores foreign responses, preserves tool errors, and fails clearly after disconnect",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const broker = yield* Broker.JiraAgentBroker;
        const ready = yield* Deferred.make<void>();
        const host = yield* broker.connect("desktop", { tools: [tool] }).pipe(
          Stream.runForEach((event) => {
            if (event.type === "connected") return Deferred.succeed(ready, undefined);
            return Effect.gen(function* () {
              yield* broker.respond("other-session", {
                requestId: event.request.requestId,
                result: { content: [{ type: "text", text: "wrong" }] },
              });
              yield* broker.respond("desktop", {
                requestId: event.request.requestId,
                result: { content: [{ type: "text", text: "permission denied" }], isError: true },
              });
            });
          }),
          Effect.forkScoped,
        );
        yield* Deferred.await(ready);
        expect(yield* call("codex")).toMatchObject({
          isError: true,
          content: [{ type: "text", text: "permission denied" }],
        });
        yield* Fiber.interrupt(host);
        expect(yield* call("codex")).toMatchObject({ isError: true });
      }),
    ).pipe(Effect.provide(TestLayer)),
);

it.effect("does not replay an in-flight write when its host disconnects and reconnects", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const broker = yield* Broker.JiraAgentBroker;
      const ready = yield* Deferred.make<void>();
      const received = yield* Deferred.make<void>();
      let count = 0;
      const host = yield* broker.connect("desktop", { tools: [tool] }).pipe(
        Stream.runForEach((event) => {
          if (event.type === "connected") return Deferred.succeed(ready, undefined);
          count++;
          return Deferred.succeed(received, undefined);
        }),
        Effect.forkScoped,
      );
      yield* Deferred.await(ready);
      const inFlight = yield* call("codex").pipe(Effect.forkScoped);
      yield* Deferred.await(received);
      yield* Fiber.interrupt(host);
      expect(yield* Fiber.join(inFlight)).toMatchObject({ isError: true });
      const reconnected = yield* Deferred.make<void>();
      yield* broker.connect("desktop", { tools: [tool] }).pipe(
        Stream.runForEach((event) => {
          if (event.type === "connected") return Deferred.succeed(reconnected, undefined);
          count++;
          return broker.respond("desktop", {
            requestId: event.request.requestId,
            result: { content: [] },
          });
        }),
        Effect.forkScoped,
      );
      yield* Deferred.await(reconnected);
      yield* call("codex");
      expect(count).toBe(2);
    }),
  ).pipe(Effect.provide(TestLayer)),
);
