import { isJiraAgentToolName, JiraAgentError } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { McpSchema, McpServer } from "effect/unstable/ai";
import { JiraAgentBroker } from "./JiraAgentBroker.ts";
import { McpInvocationContext } from "./McpInvocationContext.ts";

const decodeTools = Schema.decodeUnknownEffect(Schema.Array(McpSchema.Tool));
const decodeResult = Schema.decodeUnknownEffect(McpSchema.CallToolResult);
const isAgentError = Schema.is(JiraAgentError);

export const registration = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const broker = yield* JiraAgentBroker;
    yield* broker.install((raw) =>
      Effect.gen(function* () {
        // Decode the entire list before registering anything, and never replace T3 tools.
        const tools = yield* decodeTools(raw).pipe(
          Effect.mapError(
            () =>
              new JiraAgentError({ message: "Atlassian returned an unsupported tool definition." }),
          ),
        );
        if (tools.some((tool) => !isJiraAgentToolName(tool.name)))
          return yield* new JiraAgentError({ message: "Unexpected Jira tool name." });
        for (const tool of tools)
          yield* server.addTool({
            tool,
            annotations: Context.empty(),
            handle: (payload) =>
              Effect.withFiber((fiber) => {
                // The existing MCP middleware authenticates and scopes every provider call.
                const invocation = Context.getUnsafe(fiber.context, McpInvocationContext);
                if (!invocation.capabilities.has("jira"))
                  return Effect.succeed(
                    new McpSchema.CallToolResult({
                      isError: true,
                      content: [
                        {
                          type: "text",
                          text: "Jira is not enabled for this provider session. Start a new chat to enable it.",
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
                              : "Atlassian returned an unsupported tool result. A write may have completed; check Jira before retrying.",
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
