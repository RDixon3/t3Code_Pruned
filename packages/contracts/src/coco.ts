import * as Schema from "effect/Schema";

export const CoCoAgent = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  prompt: Schema.String,
  skills: Schema.Array(Schema.String),
});
export type CoCoAgent = typeof CoCoAgent.Type;
export const CoCoAgentSummary = Schema.Struct({ id: Schema.String, name: Schema.String });
export const CoCoLibrary = Schema.Struct({
  agents: Schema.Array(CoCoAgent),
  enabled: Schema.Boolean,
  installed: Schema.Int,
  destinations: Schema.Array(Schema.String),
  error: Schema.NullOr(Schema.String),
});
export class CoCoError extends Schema.TaggedError<CoCoError>()("CoCoError", {
  message: Schema.String,
}) {}

export const CoCoFocusResult = Schema.Struct({
  suggestions: Schema.Array(
    Schema.Struct({
      action: Schema.String,
      reason: Schema.String,
      issueKeys: Schema.Array(Schema.String),
    }),
  ),
});
export type CoCoFocusResult = typeof CoCoFocusResult.Type;
