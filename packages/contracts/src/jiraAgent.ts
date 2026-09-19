import * as Schema from "effect/Schema";

export class JiraAgentError extends Schema.TaggedError<JiraAgentError>()("JiraAgentError", {
  message: Schema.String,
}) {}
export const JiraAgentHost = Schema.Struct({
  tools: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});
export const JiraAgentRequest = Schema.Struct({
  requestId: Schema.String,
  name: Schema.String,
  expiresAt: Schema.Finite,
  arguments: Schema.Record(Schema.String, Schema.Unknown),
});
export const JiraAgentEvent = Schema.Union([
  Schema.Struct({ type: Schema.Literal("connected") }),
  Schema.Struct({ type: Schema.Literal("request"), request: JiraAgentRequest }),
]);
export const JiraAgentResponse = Schema.Struct({
  requestId: Schema.String,
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.String),
});

export const isJiraAgentToolName = (name: unknown): name is string =>
  typeof name === "string" &&
  /^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(name) &&
  (/jira/i.test(name) ||
    [
      "getAccessibleAtlassianResources",
      "atlassianUserInfo",
      "getContentFormatGuide",
      "getIssueLinkTypes",
      "createIssueLink",
    ].includes(name));
