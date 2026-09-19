import { isV0AgentToolName, V0AgentError } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { McpSchema, McpServer } from "effect/unstable/ai";
import { V0AgentBroker } from "./V0AgentBroker.ts";
import { McpInvocationContext } from "./McpInvocationContext.ts";

const decodeTools = Schema.decodeUnknownEffect(Schema.Array(McpSchema.Tool));
const decodeResult = Schema.decodeUnknownEffect(McpSchema.CallToolResult);
const isAgentError = Schema.is(V0AgentError);

export const registration = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const broker = yield* V0AgentBroker;
    yield* broker.install((raw) =>
      Effect.gen(function* () {
        // Decode the entire list before registering anything, and never replace T3 tools.
        const tools = yield* decodeTools(raw).pipe(
          Effect.mapError(
            () => new V0AgentError({ message: "v0 returned an unsupported tool definition." }),
          ),
        );
        if (tools.some((tool) => !isV0AgentToolName(tool.name)))
          return yield* new V0AgentError({ message: "Unexpected v0 tool name." });
        for (const tool of tools)
          yield* server.addTool({
            tool: {
              ...tool,
              name: `v0_${tool.name}`,
              description: `${tool.description ?? ""}
Use v0 for visual prototypes. Reuse the same chatId for revisions and preserve returned chat/preview URLs. Prefer responseMode async when the tool supports it; use read tools to check progress. If a pending task needs a decision, ask the user and resolve that task instead of creating another chat. Return SSO authorization links to the user when needed. Never automatically retry generation after a timeout or lost connection; inspect the existing chat first. Use these MCP tools rather than browser automation to operate v0.`,
            },
            annotations: Context.empty(),
            handle: (payload) =>
              Effect.withFiber((fiber) => {
                // The existing MCP middleware authenticates and scopes every provider call.
                const invocation = Context.getUnsafe(fiber.context, McpInvocationContext);
                if (!invocation.capabilities.has("v0"))
                  return Effect.succeed(
                    new McpSchema.CallToolResult({
                      isError: true,
                      content: [
                        {
                          type: "text",
                          text: "v0 is not enabled for this provider session. Start a new chat to enable it.",
                        },
                      ],
                    }),
                  );
                return broker.invoke(tool.name, payload ?? {}).pipe(
                  Effect.flatMap(decodeResult),
                  Effect.catch((error) =>
                    Effect.succeed(
                      new McpSchema.CallToolResult({
                        isError: true,
                        content: [
                          {
                            type: "text",
                            text: isAgentError(error)
                              ? error.message
                              : "v0 returned an unsupported tool result. A write may have completed; check v0 before retrying.",
                          },
                        ],
                      }),
                    ),
                  ),
                );
              }),
          });
      }),
    );
  }),
);
