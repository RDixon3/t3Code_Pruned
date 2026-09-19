import * as Schema from "effect/Schema";

export class V0AgentError extends Schema.TaggedError<V0AgentError>()("V0AgentError", {
  message: Schema.String,
}) {}
export const V0AgentHost = Schema.Struct({
  tools: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});
export const V0AgentRequest = Schema.Struct({
  requestId: Schema.String,
  name: Schema.String,
  expiresAt: Schema.Finite,
  arguments: Schema.Record(Schema.String, Schema.Unknown),
});
export const V0AgentEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("connected") }),
  Schema.Struct({ type: Schema.Literal("request"), request: V0AgentRequest }),
]);
export const V0AgentResponse = Schema.Struct({
  requestId: Schema.String,
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.String),
});

// Names are forwarded from the authenticated v0 catalog and prefixed at the local MCP boundary.
export const isV0AgentToolName = (name: unknown): name is string =>
  typeof name === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(name);
export const V0_AGENT_TIMEOUT_MS = 600_000;
