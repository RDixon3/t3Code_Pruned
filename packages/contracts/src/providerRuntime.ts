import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  EventId,
  IsoDateTime,
  NonNegativeInt,
  ProviderItemId,
  PositiveInt,
  RuntimeItemId,
  RuntimeRequestId,
  RuntimeTaskId,
  ThreadId,
  TrimmedNonEmptyString,
  TurnId,
} from "./baseSchemas.ts";
import { ProviderInstanceId, ProviderDriverKind } from "./providerInstance.ts";
import { ProviderUsageLimitsUpdate } from "./providerUsageLimits.ts";
import { ProviderApprovalOption } from "./orchestration.ts";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;
const UnknownRecordSchema = Schema.Record(Schema.String, Schema.Unknown);

const RuntimeEventRawSource = Schema.Union([
  Schema.Literal("codex.app-server.notification"),
  Schema.Literal("codex.app-server.request"),
  Schema.Literal("codex.eventmsg"),
  Schema.Literal("claude.sdk.message"),
  Schema.Literal("claude.sdk.permission"),
  Schema.Literal("codex.sdk.thread-event"),
  Schema.Literal("opencode.sdk.event"),
  Schema.Literal("acp.jsonrpc"),
  Schema.TemplateLiteral(["acp.", Schema.String, ".extension"]),
]);
export type RuntimeEventRawSource = typeof RuntimeEventRawSource.Type;

const RuntimeEventRaw = Schema.Struct({
  source: RuntimeEventRawSource,
  method: Schema.optional(TrimmedNonEmptyStringSchema),
  messageType: Schema.optional(TrimmedNonEmptyStringSchema),
  payload: Schema.Unknown,
});

const ProviderRequestId = TrimmedNonEmptyStringSchema;

const ProviderRefs = Schema.Struct({
  providerTurnId: Schema.optional(TrimmedNonEmptyStringSchema),
  providerItemId: Schema.optional(ProviderItemId),
  providerRequestId: Schema.optional(ProviderRequestId),
});

const RuntimeSessionState = Schema.Literals([
  "starting",
  "ready",
  "running",
  "waiting",
  "stopped",
  "error",
]);

const RuntimeThreadState = Schema.Literals([
  "active",
  "idle",
  "archived",
  "closed",
  "compacted",
  "error",
]);

const RuntimeTurnState = Schema.Literals(["completed", "failed", "interrupted", "cancelled"]);
export type RuntimeTurnState = typeof RuntimeTurnState.Type;

const RuntimePlanStepStatus = Schema.Literals(["pending", "inProgress", "completed"]);

const RuntimeItemStatus = Schema.Literals(["inProgress", "completed", "failed", "declined"]);
export type RuntimeItemStatus = typeof RuntimeItemStatus.Type;

const RuntimeContentStreamKind = Schema.Literals([
  "assistant_text",
  "reasoning_text",
  "reasoning_summary_text",
  "plan_text",
  "command_output",
  "file_change_output",
  "unknown",
]);
export type RuntimeContentStreamKind = typeof RuntimeContentStreamKind.Type;

const RuntimeSessionExitKind = Schema.Literals(["graceful", "error"]);

const RuntimeErrorClass = Schema.Literals([
  "provider_error",
  "transport_error",
  "permission_error",
  "validation_error",
  "unknown",
]);

const TOOL_LIFECYCLE_ITEM_TYPES = [
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "dynamic_tool_call",
  "collab_agent_tool_call",
  "web_search",
  "image_view",
] as const;

export const ToolLifecycleItemType = Schema.Literals(TOOL_LIFECYCLE_ITEM_TYPES);
export type ToolLifecycleItemType = typeof ToolLifecycleItemType.Type;

export function isToolLifecycleItemType(value: string): value is ToolLifecycleItemType {
  return TOOL_LIFECYCLE_ITEM_TYPES.includes(value as ToolLifecycleItemType);
}

export const CanonicalItemType = Schema.Literals([
  "user_message",
  "assistant_message",
  "reasoning",
  "plan",
  ...TOOL_LIFECYCLE_ITEM_TYPES,
  "review_entered",
  "review_exited",
  "context_compaction",
  "error",
  "unknown",
]);
export type CanonicalItemType = typeof CanonicalItemType.Type;

export const CanonicalRequestType = Schema.Literals([
  "command_execution_approval",
  "file_read_approval",
  "file_change_approval",
  "apply_patch_approval",
  "exec_command_approval",
  "mcp_elicitation_approval",
  "tool_user_input",
  "dynamic_tool_call",
  "auth_tokens_refresh",
  "unknown",
]);
export type CanonicalRequestType = typeof CanonicalRequestType.Type;

const ProviderRuntimeEventType = Schema.Literals([
  "session.started",
  "session.configured",
  "session.state.changed",
  "session.exited",
  "thread.started",
  "thread.state.changed",
  "thread.metadata.updated",
  "thread.token-usage.updated",
  "thread.realtime.started",
  "thread.realtime.item-added",
  "thread.realtime.audio.delta",
  "thread.realtime.error",
  "thread.realtime.closed",
  "turn.started",
  "turn.completed",
  "turn.aborted",
  "turn.plan.updated",
  "turn.proposed.delta",
  "turn.proposed.completed",
  "turn.diff.updated",
  "item.started",
  "item.updated",
  "item.completed",
  "content.delta",
  "request.opened",
  "request.resolved",
  "user-input.requested",
  "user-input.resolved",
  "task.started",
  "task.progress",
  "task.updated",
  "task.completed",
  "hook.started",
  "hook.progress",
  "hook.completed",
  "tool.progress",
  "tool.summary",
  "tool.denied",
  "auth.status",
  "account.updated",
  "account.rate-limits.updated",
  "mcp.status.updated",
  "mcp.oauth.completed",
  "model.rerouted",
  "config.warning",
  "deprecation.notice",
  "files.persisted",
  "runtime.warning",
  "runtime.error",
]);
export type ProviderRuntimeEventType = typeof ProviderRuntimeEventType.Type;

const SessionStartedType = Schema.Literal("session.started");
const SessionConfiguredType = Schema.Literal("session.configured");
const SessionStateChangedType = Schema.Literal("session.state.changed");
const SessionExitedType = Schema.Literal("session.exited");
const ThreadStartedType = Schema.Literal("thread.started");
const ThreadStateChangedType = Schema.Literal("thread.state.changed");
const ThreadMetadataUpdatedType = Schema.Literal("thread.metadata.updated");
const ThreadTokenUsageUpdatedType = Schema.Literal("thread.token-usage.updated");
const ThreadRealtimeStartedType = Schema.Literal("thread.realtime.started");
const ThreadRealtimeItemAddedType = Schema.Literal("thread.realtime.item-added");
const ThreadRealtimeAudioDeltaType = Schema.Literal("thread.realtime.audio.delta");
const ThreadRealtimeErrorType = Schema.Literal("thread.realtime.error");
const ThreadRealtimeClosedType = Schema.Literal("thread.realtime.closed");
const TurnStartedType = Schema.Literal("turn.started");
const TurnCompletedType = Schema.Literal("turn.completed");
const TurnAbortedType = Schema.Literal("turn.aborted");
const TurnPlanUpdatedType = Schema.Literal("turn.plan.updated");
const TurnProposedDeltaType = Schema.Literal("turn.proposed.delta");
const TurnProposedCompletedType = Schema.Literal("turn.proposed.completed");
const TurnDiffUpdatedType = Schema.Literal("turn.diff.updated");
const ItemStartedType = Schema.Literal("item.started");
const ItemUpdatedType = Schema.Literal("item.updated");
const ItemCompletedType = Schema.Literal("item.completed");
const ContentDeltaType = Schema.Literal("content.delta");
const RequestOpenedType = Schema.Literal("request.opened");
const RequestResolvedType = Schema.Literal("request.resolved");
const UserInputRequestedType = Schema.Literal("user-input.requested");
const UserInputResolvedType = Schema.Literal("user-input.resolved");
const TaskStartedType = Schema.Literal("task.started");
const TaskProgressType = Schema.Literal("task.progress");
const TaskUpdatedType = Schema.Literal("task.updated");
const TaskCompletedType = Schema.Literal("task.completed");
const HookStartedType = Schema.Literal("hook.started");
const HookProgressType = Schema.Literal("hook.progress");
const HookCompletedType = Schema.Literal("hook.completed");
const ToolProgressType = Schema.Literal("tool.progress");
const ToolSummaryType = Schema.Literal("tool.summary");
const AuthStatusType = Schema.Literal("auth.status");
const AccountUpdatedType = Schema.Literal("account.updated");
const AccountRateLimitsUpdatedType = Schema.Literal("account.rate-limits.updated");
const McpStatusUpdatedType = Schema.Literal("mcp.status.updated");
const McpOauthCompletedType = Schema.Literal("mcp.oauth.completed");
const ModelReroutedType = Schema.Literal("model.rerouted");
const ConfigWarningType = Schema.Literal("config.warning");
const DeprecationNoticeType = Schema.Literal("deprecation.notice");
const FilesPersistedType = Schema.Literal("files.persisted");
const ToolDeniedType = Schema.Literal("tool.denied");
const RuntimeWarningType = Schema.Literal("runtime.warning");
const RuntimeErrorType = Schema.Literal("runtime.error");

const ProviderRuntimeEventBase = Schema.Struct({
  eventId: EventId,
  provider: ProviderDriverKind,
  // Optional during the driver/instance migration. See providerInstance.ts
  // for the routing-key-vs-driver-id distinction. Once every emitter
  // populates it (post-slice-4), routing flips to instance-id-only.
  providerInstanceId: Schema.optional(ProviderInstanceId),
  threadId: ThreadId,
  createdAt: IsoDateTime,
  turnId: Schema.optional(TurnId),
  itemId: Schema.optional(RuntimeItemId),
  requestId: Schema.optional(RuntimeRequestId),
  providerRefs: Schema.optional(ProviderRefs),
  raw: Schema.optional(RuntimeEventRaw),
});

const SessionStartedPayload = Schema.Struct({
  message: Schema.optional(TrimmedNonEmptyStringSchema),
  resume: Schema.optional(Schema.Unknown),
});

const SessionConfiguredPayload = Schema.Struct({
  config: UnknownRecordSchema,
});

const SessionStateChangedPayload = Schema.Struct({
  state: RuntimeSessionState,
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  detail: Schema.optional(Schema.Unknown),
});

const SessionExitedPayload = Schema.Struct({
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  recoverable: Schema.optional(Schema.Boolean),
  exitKind: Schema.optional(RuntimeSessionExitKind),
});

const ThreadStartedPayload = Schema.Struct({
  providerThreadId: Schema.optional(TrimmedNonEmptyStringSchema),
});

const ThreadStateChangedPayload = Schema.Struct({
  state: RuntimeThreadState,
  beforeTokens: Schema.optional(NonNegativeInt),
  afterTokens: Schema.optional(NonNegativeInt),
  detail: Schema.optional(Schema.Unknown),
});

const ThreadMetadataUpdatedPayload = Schema.Struct({
  name: Schema.optional(TrimmedNonEmptyStringSchema),
  metadata: Schema.optional(UnknownRecordSchema),
});

export const ThreadTokenUsageSnapshot = Schema.Struct({
  usedTokens: NonNegativeInt,
  totalProcessedTokens: Schema.optional(NonNegativeInt),
  maxTokens: Schema.optional(PositiveInt),
  inputTokens: Schema.optional(NonNegativeInt),
  cachedInputTokens: Schema.optional(NonNegativeInt),
  outputTokens: Schema.optional(NonNegativeInt),
  reasoningOutputTokens: Schema.optional(NonNegativeInt),
  lastUsedTokens: Schema.optional(NonNegativeInt),
  lastInputTokens: Schema.optional(NonNegativeInt),
  lastCachedInputTokens: Schema.optional(NonNegativeInt),
  lastOutputTokens: Schema.optional(NonNegativeInt),
  lastReasoningOutputTokens: Schema.optional(NonNegativeInt),
  toolUses: Schema.optional(NonNegativeInt),
  durationMs: Schema.optional(NonNegativeInt),
  compactsAutomatically: Schema.optional(Schema.Boolean),
  autoCompactThreshold: Schema.optional(PositiveInt),
});
export type ThreadTokenUsageSnapshot = typeof ThreadTokenUsageSnapshot.Type;

const ThreadTokenUsageUpdatedPayload = Schema.Struct({
  usage: ThreadTokenUsageSnapshot,
});

const ThreadRealtimeStartedPayload = Schema.Struct({
  realtimeSessionId: Schema.optional(TrimmedNonEmptyStringSchema),
});

const ThreadRealtimeItemAddedPayload = Schema.Struct({
  item: Schema.Unknown,
});

const ThreadRealtimeAudioDeltaPayload = Schema.Struct({
  audio: Schema.Unknown,
});

const ThreadRealtimeErrorPayload = Schema.Struct({
  message: TrimmedNonEmptyStringSchema,
});

const ThreadRealtimeClosedPayload = Schema.Struct({
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
});

const TurnStartedPayload = Schema.Struct({
  model: Schema.optional(TrimmedNonEmptyStringSchema),
  effort: Schema.optional(TrimmedNonEmptyStringSchema),
});

/**
 * Normalized main-agent usage for one turn. Input includes cache reads and
 * writes. Output includes reasoning, and reasoningTokens is an optional subset.
 * Complete means the provider supplied full input and output totals. Partial
 * means every included count is valid, but the full turn total is not known.
 */
const TurnTokenUsageCommonFields = {
  usageScope: Schema.Literal("main_agent"),
  cachedInputTokens: Schema.optional(NonNegativeInt),
  cacheCreationTokens: Schema.optional(NonNegativeInt),
  reasoningTokens: Schema.optional(NonNegativeInt),
  hasSubagents: Schema.Boolean,
};
export const TurnTokenUsage = Schema.Union([
  Schema.Struct({
    ...TurnTokenUsageCommonFields,
    usageStatus: Schema.Literal("complete"),
    inputTokens: NonNegativeInt,
    outputTokens: NonNegativeInt,
  }),
  Schema.Struct({
    ...TurnTokenUsageCommonFields,
    usageStatus: Schema.Literals(["partial", "unavailable"]),
    inputTokens: Schema.optional(NonNegativeInt),
    outputTokens: Schema.optional(NonNegativeInt),
  }),
]);
export type TurnTokenUsage = typeof TurnTokenUsage.Type;

const TurnCompletedPayload = Schema.Struct({
  state: RuntimeTurnState,
  stopReason: Schema.optional(Schema.NullOr(TrimmedNonEmptyStringSchema)),
  usage: Schema.optional(Schema.Unknown),
  modelUsage: Schema.optional(UnknownRecordSchema),
  totalCostUsd: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(TrimmedNonEmptyStringSchema),
  tokenUsage: Schema.optional(TurnTokenUsage),
});

const TurnAbortedPayload = Schema.Struct({
  reason: TrimmedNonEmptyStringSchema,
  tokenUsage: Schema.optional(TurnTokenUsage),
});

const RuntimePlanStep = Schema.Struct({
  step: TrimmedNonEmptyStringSchema,
  status: RuntimePlanStepStatus,
});

const TurnPlanUpdatedPayload = Schema.Struct({
  explanation: Schema.optional(Schema.NullOr(TrimmedNonEmptyStringSchema)),
  plan: Schema.Array(RuntimePlanStep),
});

const TurnProposedDeltaPayload = Schema.Struct({
  delta: Schema.String,
});

const TurnProposedCompletedPayload = Schema.Struct({
  planMarkdown: TrimmedNonEmptyStringSchema,
});

const TurnDiffUpdatedPayload = Schema.Struct({
  unifiedDiff: Schema.String,
});

export const ToolActivitySurface = Schema.Literals(["browser", "computer"]);
export type ToolActivitySurface = typeof ToolActivitySurface.Type;

export const ToolActivityNativeAppReference = Schema.Union([
  Schema.TaggedStruct("app-id", {
    appId: TrimmedNonEmptyStringSchema.check(
      Schema.isMaxLength(512),
      Schema.isPattern(/^[A-Za-z0-9._-]+$/u),
    ),
  }),
  Schema.TaggedStruct("display-name", {
    displayName: TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(160)),
  }),
]);
export type ToolActivityNativeAppReference = typeof ToolActivityNativeAppReference.Type;

export const ToolActivityIcon = Schema.Union([
  Schema.TaggedStruct("website", {
    pageUrl: TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(4096)),
    faviconUrl: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(4096))),
    faviconUrlDark: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(4096))),
  }),
  Schema.TaggedStruct("native-app", {
    app: ToolActivityNativeAppReference,
  }),
  Schema.TaggedStruct("themed-logo", {
    logoUrl: TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(4096)),
    logoUrlDark: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(4096))),
  }),
]);
export type ToolActivityIcon = typeof ToolActivityIcon.Type;

export const ToolActivitySource = Schema.Struct({
  key: TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(512)),
  name: TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(160)),
  kind: Schema.Literals(["browser", "computer", "integration"]),
  icon: Schema.optional(ToolActivityIcon),
});
export type ToolActivitySource = typeof ToolActivitySource.Type;

const ItemLifecyclePayload = Schema.Struct({
  itemType: CanonicalItemType,
  status: Schema.optional(RuntimeItemStatus),
  title: Schema.optional(TrimmedNonEmptyStringSchema),
  detail: Schema.optional(TrimmedNonEmptyStringSchema),
  toolSurface: Schema.optional(ToolActivitySurface),
  toolIcon: Schema.optional(ToolActivityIcon),
  toolSource: Schema.optional(ToolActivitySource),
  data: Schema.optional(Schema.Unknown),
  /**
   * Owning agent when this item ran inside a subagent (resolved from the
   * SDK's parent_tool_use_id). Clients re-home attributed items out of the
   * main timeline and into the owning agent's Agents-surface row.
   */
  agentId: Schema.optional(TrimmedNonEmptyStringSchema),
  parentToolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
});

const ContentDeltaPayload = Schema.Struct({
  streamKind: RuntimeContentStreamKind,
  delta: Schema.String,
  contentIndex: Schema.optional(Schema.Int),
  summaryIndex: Schema.optional(Schema.Int),
});

const RequestOpenedPayload = Schema.Struct({
  requestType: CanonicalRequestType,
  detail: Schema.optional(TrimmedNonEmptyStringSchema),
  appName: Schema.optional(TrimmedNonEmptyStringSchema),
  options: Schema.optional(Schema.Array(ProviderApprovalOption)),
  args: Schema.optional(Schema.Unknown),
});

const RequestResolvedPayload = Schema.Struct({
  requestType: CanonicalRequestType,
  decision: Schema.optional(TrimmedNonEmptyStringSchema),
  resolution: Schema.optional(Schema.Unknown),
});

const UserInputQuestionOption = Schema.Struct({
  label: TrimmedNonEmptyStringSchema,
  description: Schema.String,
  value: Schema.optional(Schema.String),
});

export const UserInputQuestion = Schema.Struct({
  id: TrimmedNonEmptyStringSchema,
  header: TrimmedNonEmptyStringSchema,
  question: TrimmedNonEmptyStringSchema,
  options: Schema.Array(UserInputQuestionOption),
  allowCustomAnswer: Schema.optional(Schema.Boolean),
  multiSelect: Schema.optional(Schema.Boolean).pipe(
    Schema.withConstructorDefault(Effect.succeed(false)),
  ),
});
export type UserInputQuestion = typeof UserInputQuestion.Type;

export const UserInputRequestedPayload = Schema.Struct({
  questions: Schema.Array(UserInputQuestion),
  responseMode: Schema.optional(Schema.Literal("message")),
});
export type UserInputRequestedPayload = typeof UserInputRequestedPayload.Type;

const UserInputResolvedPayload = Schema.Struct({
  answers: UnknownRecordSchema,
});

/**
 * Typed per-task usage rollup. Field names match the orchestration-v2 subagent
 * usage vocabulary (#4779) so the eventual migration is a rename, not a remap.
 * Claude reports per-activation deltas; Codex reports cumulative totals — the
 * merge strategy is provider-specific and lives in client-runtime.
 */
export const RuntimeTaskUsage = Schema.Struct({
  totalTokens: NonNegativeInt,
  inputTokens: Schema.optional(NonNegativeInt),
  cachedInputTokens: Schema.optional(NonNegativeInt),
  outputTokens: Schema.optional(NonNegativeInt),
  reasoningOutputTokens: Schema.optional(NonNegativeInt),
  toolUses: Schema.optional(NonNegativeInt),
  durationMs: Schema.optional(NonNegativeInt),
});
export type RuntimeTaskUsage = typeof RuntimeTaskUsage.Type;

const TaskWorkflowPhase = Schema.Struct({
  index: NonNegativeInt,
  title: TrimmedNonEmptyStringSchema,
});

export const TaskRunHandles = Schema.Struct({
  runId: Schema.optional(TrimmedNonEmptyStringSchema),
  scriptPath: Schema.optional(TrimmedNonEmptyStringSchema),
  transcriptDir: Schema.optional(TrimmedNonEmptyStringSchema),
  /** Only http/https URLs may be stored here — sanitized at the adapter. */
  sessionUrl: Schema.optional(TrimmedNonEmptyStringSchema),
});
export type TaskRunHandles = typeof TaskRunHandles.Type;

/**
 * Watch-loop task types: Monitor-tool tasks plus background shells (a shell
 * that outlives its turn is in practice a watch loop). Canonical single copy —
 * the server liveness registry, ingestion's agentKind stamp, and the client
 * fold's legacy fallback all classify with these sets.
 */
export const MONITOR_TASK_TYPES: ReadonlySet<string> = new Set([
  "monitor",
  "monitor_mcp",
  "local_bash",
  "shell",
]);
/** Task types that are neither agents nor watch loops (plan-mode bookkeeping). */
export const INERT_TASK_TYPES: ReadonlySet<string> = new Set(["plan", "dream"]);

/**
 * Agent-vs-background classification, stamped by ingestion as `agentKind` so
 * persisted rows are self-describing. A deliberate denylist: the SDK's
 * agent-flavored type names drift (subagent, local_agent, local_workflow, …)
 * and an allowlist silently dropped real subagents when "local_agent"
 * appeared. A task launched from inside a subagent (agentId set) is
 * agent-internal background work UNLESS it is itself agent-flavored — a
 * nested agent can outlive its parent and stays in the roster.
 */
export function classifyTaskAgentKind(input: {
  readonly taskType?: string | undefined;
  readonly agentId?: string | undefined;
}): "agent" | "background" {
  const { taskType, agentId } = input;
  const nonAgentType =
    taskType !== undefined && (MONITOR_TASK_TYPES.has(taskType) || INERT_TASK_TYPES.has(taskType));
  if (agentId !== undefined && agentId.trim().length > 0) {
    return taskType === undefined || nonAgentType ? "background" : "agent";
  }
  return nonAgentType ? "background" : "agent";
}

/**
 * Optional agent-identity linkage carried on every task lifecycle payload.
 * Repeated on progress and terminal rows (not just start) so client folds can
 * reconstruct an agent even when its start row aged out of activity retention.
 * All fields optional: old emitters and old rows decode unchanged.
 */
const taskAgentLinkageFields = {
  /** SDK task_type (subagent/shell/monitor/local_workflow/…), repeated on
   * every row so folds can classify without the start row. */
  taskType: Schema.optional(TrimmedNonEmptyStringSchema),
  /**
   * Server-stamped classification (classifyTaskAgentKind at ingestion).
   * Clients trust this stamp outright; rows without it (legacy, pre-stamp)
   * fall back to client-side heuristics.
   */
  agentKind: Schema.optional(Schema.Literals(["agent", "background"])),
  /**
   * Owning agent when the task itself was launched from inside a subagent
   * (e.g. a subagent's background shell). Clients treat such tasks as
   * agent-internal and keep them out of the parent work log.
   */
  agentId: Schema.optional(TrimmedNonEmptyStringSchema),
  title: Schema.optional(TrimmedNonEmptyStringSchema),
  role: Schema.optional(TrimmedNonEmptyStringSchema),
  model: Schema.optional(TrimmedNonEmptyStringSchema),
  /** Reasoning effort when known (e.g. "high"). Open string: provider vocabularies differ. */
  effort: Schema.optional(TrimmedNonEmptyStringSchema),
  toolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
  parentAgentId: Schema.optional(TrimmedNonEmptyStringSchema),
  workflowName: Schema.optional(TrimmedNonEmptyStringSchema),
  agentIndex: Schema.optional(NonNegativeInt),
  phaseIndex: Schema.optional(NonNegativeInt),
  phaseTitle: Schema.optional(TrimmedNonEmptyStringSchema),
  phases: Schema.optional(Schema.Array(TaskWorkflowPhase)),
  attempt: Schema.optional(NonNegativeInt),
  runHandles: Schema.optional(TaskRunHandles),
  outputFile: Schema.optional(TrimmedNonEmptyStringSchema),
  /** Codex agent hierarchy path, e.g. "/root/marlow". */
  agentPath: Schema.optional(TrimmedNonEmptyStringSchema),
  /**
   * Set on provider-synthesized child-agent events (Codex) whose activity
   * belongs in the Agents surface, never the parent timeline.
   */
  timelineBypass: Schema.optional(Schema.Boolean),
} as const;

export const TaskAgentLinkage = Schema.Struct(taskAgentLinkageFields);
export type TaskAgentLinkage = typeof TaskAgentLinkage.Type;

const TaskStartedPayload = Schema.Struct({
  taskId: RuntimeTaskId,
  description: Schema.optional(TrimmedNonEmptyStringSchema),
  ...taskAgentLinkageFields,
});

export const RuntimeTaskStatus = Schema.Literals([
  "pending",
  "running",
  "waiting",
  "idle",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);
export type RuntimeTaskStatus = typeof RuntimeTaskStatus.Type;

const TaskProgressPayload = Schema.Struct({
  taskId: RuntimeTaskId,
  description: TrimmedNonEmptyStringSchema,
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  usage: Schema.optional(Schema.Unknown),
  typedUsage: Schema.optional(RuntimeTaskUsage),
  lastToolName: Schema.optional(TrimmedNonEmptyStringSchema),
  /** Present on synthesized member/child progress rows that carry state. */
  status: Schema.optional(RuntimeTaskStatus),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
  ...taskAgentLinkageFields,
});

/**
 * Non-terminal status patch (from the Claude SDK's task_updated, which main
 * previously dropped). killed→cancelled and paused→idle are mapped at the
 * adapter so the wire only carries the shared vocabulary.
 */
const TaskUpdatedPayload = Schema.Struct({
  taskId: RuntimeTaskId,
  status: Schema.optional(RuntimeTaskStatus),
  description: Schema.optional(TrimmedNonEmptyStringSchema),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
  endedAt: Schema.optional(IsoDateTime),
  isBackgrounded: Schema.optional(Schema.Boolean),
  ...taskAgentLinkageFields,
});

const TaskCompletedPayload = Schema.Struct({
  taskId: RuntimeTaskId,
  status: Schema.Literals(["completed", "failed", "stopped"]),
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  usage: Schema.optional(Schema.Unknown),
  typedUsage: Schema.optional(RuntimeTaskUsage),
  ...taskAgentLinkageFields,
});

const HookStartedPayload = Schema.Struct({
  hookId: TrimmedNonEmptyStringSchema,
  hookName: TrimmedNonEmptyStringSchema,
  hookEvent: TrimmedNonEmptyStringSchema,
});

const HookProgressPayload = Schema.Struct({
  hookId: TrimmedNonEmptyStringSchema,
  output: Schema.optional(Schema.String),
  stdout: Schema.optional(Schema.String),
  stderr: Schema.optional(Schema.String),
});

const HookCompletedPayload = Schema.Struct({
  hookId: TrimmedNonEmptyStringSchema,
  outcome: Schema.Literals(["success", "error", "cancelled"]),
  output: Schema.optional(Schema.String),
  stdout: Schema.optional(Schema.String),
  stderr: Schema.optional(Schema.String),
  exitCode: Schema.optional(Schema.Int),
});

const ToolProgressPayload = Schema.Struct({
  toolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
  toolName: Schema.optional(TrimmedNonEmptyStringSchema),
  summary: Schema.optional(TrimmedNonEmptyStringSchema),
  elapsedSeconds: Schema.optional(Schema.Number),
  /** Owning task/agent when the tool ran inside a subagent. */
  taskId: Schema.optional(RuntimeTaskId),
  parentToolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
});

const ToolSummaryPayload = Schema.Struct({
  summary: TrimmedNonEmptyStringSchema,
  precedingToolUseIds: Schema.optional(Schema.Array(TrimmedNonEmptyStringSchema)),
});

const AuthStatusPayload = Schema.Struct({
  isAuthenticating: Schema.optional(Schema.Boolean),
  output: Schema.optional(Schema.Array(Schema.String)),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
});

const AccountUpdatedPayload = Schema.Struct({
  account: Schema.Unknown,
});

/**
 * Adapters normalise their native rate-limit payload at the boundary so the
 * consumer that folds it into the provider snapshot never sees driver shapes.
 */
const AccountRateLimitsUpdatedPayload = Schema.Struct({
  limits: ProviderUsageLimitsUpdate,
});

const McpStatusUpdatedPayload = Schema.Struct({
  status: Schema.Unknown,
});

const McpOauthCompletedPayload = Schema.Struct({
  success: Schema.Boolean,
  name: Schema.optional(TrimmedNonEmptyStringSchema),
  error: Schema.optional(TrimmedNonEmptyStringSchema),
});

const ModelReroutedPayload = Schema.Struct({
  fromModel: TrimmedNonEmptyStringSchema,
  toModel: TrimmedNonEmptyStringSchema,
  reason: TrimmedNonEmptyStringSchema,
});

const ConfigWarningPayload = Schema.Struct({
  summary: TrimmedNonEmptyStringSchema,
  details: Schema.optional(TrimmedNonEmptyStringSchema),
  path: Schema.optional(TrimmedNonEmptyStringSchema),
  range: Schema.optional(Schema.Unknown),
});

const DeprecationNoticePayload = Schema.Struct({
  summary: TrimmedNonEmptyStringSchema,
  details: Schema.optional(TrimmedNonEmptyStringSchema),
});

const FilesPersistedPayload = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      filename: TrimmedNonEmptyStringSchema,
      fileId: TrimmedNonEmptyStringSchema,
    }),
  ),
  failed: Schema.optional(
    Schema.Array(
      Schema.Struct({
        filename: TrimmedNonEmptyStringSchema,
        error: TrimmedNonEmptyStringSchema,
      }),
    ),
  ),
});

const ToolDeniedPayload = Schema.Struct({
  toolName: TrimmedNonEmptyStringSchema,
  toolUseId: Schema.optional(TrimmedNonEmptyStringSchema),
  reason: Schema.optional(TrimmedNonEmptyStringSchema),
  agentId: Schema.optional(TrimmedNonEmptyStringSchema),
});

const RuntimeWarningPayload = Schema.Struct({
  message: TrimmedNonEmptyStringSchema,
  detail: Schema.optional(Schema.Unknown),
});

const RuntimeErrorPayload = Schema.Struct({
  message: TrimmedNonEmptyStringSchema,
  class: Schema.optional(RuntimeErrorClass),
  detail: Schema.optional(Schema.Unknown),
});

const ProviderRuntimeSessionStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: SessionStartedType,
  payload: SessionStartedPayload,
});

const ProviderRuntimeSessionConfiguredEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: SessionConfiguredType,
  payload: SessionConfiguredPayload,
});

const ProviderRuntimeSessionStateChangedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: SessionStateChangedType,
  payload: SessionStateChangedPayload,
});

const ProviderRuntimeSessionExitedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: SessionExitedType,
  payload: SessionExitedPayload,
});

const ProviderRuntimeThreadStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadStartedType,
  payload: ThreadStartedPayload,
});

const ProviderRuntimeThreadStateChangedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadStateChangedType,
  payload: ThreadStateChangedPayload,
});

const ProviderRuntimeThreadMetadataUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadMetadataUpdatedType,
  payload: ThreadMetadataUpdatedPayload,
});

const ProviderRuntimeThreadTokenUsageUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadTokenUsageUpdatedType,
  payload: ThreadTokenUsageUpdatedPayload,
});

const ProviderRuntimeThreadRealtimeStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeStartedType,
  payload: ThreadRealtimeStartedPayload,
});

const ProviderRuntimeThreadRealtimeItemAddedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeItemAddedType,
  payload: ThreadRealtimeItemAddedPayload,
});

const ProviderRuntimeThreadRealtimeAudioDeltaEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeAudioDeltaType,
  payload: ThreadRealtimeAudioDeltaPayload,
});

const ProviderRuntimeThreadRealtimeErrorEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeErrorType,
  payload: ThreadRealtimeErrorPayload,
});

const ProviderRuntimeThreadRealtimeClosedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ThreadRealtimeClosedType,
  payload: ThreadRealtimeClosedPayload,
});

const ProviderRuntimeTurnStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnStartedType,
  payload: TurnStartedPayload,
});

const ProviderRuntimeTurnCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnCompletedType,
  payload: TurnCompletedPayload,
});

const ProviderRuntimeTurnAbortedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnAbortedType,
  payload: TurnAbortedPayload,
});

const ProviderRuntimeTurnPlanUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnPlanUpdatedType,
  payload: TurnPlanUpdatedPayload,
});

const ProviderRuntimeTurnProposedDeltaEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnProposedDeltaType,
  payload: TurnProposedDeltaPayload,
});

const ProviderRuntimeTurnProposedCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnProposedCompletedType,
  payload: TurnProposedCompletedPayload,
});

const ProviderRuntimeTurnDiffUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TurnDiffUpdatedType,
  payload: TurnDiffUpdatedPayload,
});

const ProviderRuntimeItemStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ItemStartedType,
  payload: ItemLifecyclePayload,
});

const ProviderRuntimeItemUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ItemUpdatedType,
  payload: ItemLifecyclePayload,
});

const ProviderRuntimeItemCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ItemCompletedType,
  payload: ItemLifecyclePayload,
});

const ProviderRuntimeContentDeltaEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ContentDeltaType,
  payload: ContentDeltaPayload,
});

const ProviderRuntimeRequestOpenedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: RequestOpenedType,
  payload: RequestOpenedPayload,
});

const ProviderRuntimeRequestResolvedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: RequestResolvedType,
  payload: RequestResolvedPayload,
});

const ProviderRuntimeUserInputRequestedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: UserInputRequestedType,
  payload: UserInputRequestedPayload,
});

const ProviderRuntimeUserInputResolvedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: UserInputResolvedType,
  payload: UserInputResolvedPayload,
});

const ProviderRuntimeTaskStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TaskStartedType,
  payload: TaskStartedPayload,
});

const ProviderRuntimeTaskProgressEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TaskProgressType,
  payload: TaskProgressPayload,
});

const ProviderRuntimeTaskUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TaskUpdatedType,
  payload: TaskUpdatedPayload,
});

const ProviderRuntimeTaskCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: TaskCompletedType,
  payload: TaskCompletedPayload,
});

const ProviderRuntimeHookStartedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: HookStartedType,
  payload: HookStartedPayload,
});

const ProviderRuntimeHookProgressEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: HookProgressType,
  payload: HookProgressPayload,
});

const ProviderRuntimeHookCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: HookCompletedType,
  payload: HookCompletedPayload,
});

const ProviderRuntimeToolProgressEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ToolProgressType,
  payload: ToolProgressPayload,
});

const ProviderRuntimeToolSummaryEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ToolSummaryType,
  payload: ToolSummaryPayload,
});

const ProviderRuntimeAuthStatusEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: AuthStatusType,
  payload: AuthStatusPayload,
});

const ProviderRuntimeAccountUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: AccountUpdatedType,
  payload: AccountUpdatedPayload,
});

const ProviderRuntimeAccountRateLimitsUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: AccountRateLimitsUpdatedType,
  payload: AccountRateLimitsUpdatedPayload,
});

const ProviderRuntimeMcpStatusUpdatedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: McpStatusUpdatedType,
  payload: McpStatusUpdatedPayload,
});

const ProviderRuntimeMcpOauthCompletedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: McpOauthCompletedType,
  payload: McpOauthCompletedPayload,
});

const ProviderRuntimeModelReroutedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ModelReroutedType,
  payload: ModelReroutedPayload,
});

const ProviderRuntimeConfigWarningEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ConfigWarningType,
  payload: ConfigWarningPayload,
});

const ProviderRuntimeDeprecationNoticeEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: DeprecationNoticeType,
  payload: DeprecationNoticePayload,
});

const ProviderRuntimeFilesPersistedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: FilesPersistedType,
  payload: FilesPersistedPayload,
});

const ProviderRuntimeToolDeniedEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: ToolDeniedType,
  payload: ToolDeniedPayload,
});

const ProviderRuntimeWarningEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: RuntimeWarningType,
  payload: RuntimeWarningPayload,
});

const ProviderRuntimeErrorEvent = Schema.Struct({
  ...ProviderRuntimeEventBase.fields,
  type: RuntimeErrorType,
  payload: RuntimeErrorPayload,
});

export const ProviderRuntimeEventV2 = Schema.Union([
  ProviderRuntimeSessionStartedEvent,
  ProviderRuntimeSessionConfiguredEvent,
  ProviderRuntimeSessionStateChangedEvent,
  ProviderRuntimeSessionExitedEvent,
  ProviderRuntimeThreadStartedEvent,
  ProviderRuntimeThreadStateChangedEvent,
  ProviderRuntimeThreadMetadataUpdatedEvent,
  ProviderRuntimeThreadTokenUsageUpdatedEvent,
  ProviderRuntimeThreadRealtimeStartedEvent,
  ProviderRuntimeThreadRealtimeItemAddedEvent,
  ProviderRuntimeThreadRealtimeAudioDeltaEvent,
  ProviderRuntimeThreadRealtimeErrorEvent,
  ProviderRuntimeThreadRealtimeClosedEvent,
  ProviderRuntimeTurnStartedEvent,
  ProviderRuntimeTurnCompletedEvent,
  ProviderRuntimeTurnAbortedEvent,
  ProviderRuntimeTurnPlanUpdatedEvent,
  ProviderRuntimeTurnProposedDeltaEvent,
  ProviderRuntimeTurnProposedCompletedEvent,
  ProviderRuntimeTurnDiffUpdatedEvent,
  ProviderRuntimeItemStartedEvent,
  ProviderRuntimeItemUpdatedEvent,
  ProviderRuntimeItemCompletedEvent,
  ProviderRuntimeContentDeltaEvent,
  ProviderRuntimeRequestOpenedEvent,
  ProviderRuntimeRequestResolvedEvent,
  ProviderRuntimeUserInputRequestedEvent,
  ProviderRuntimeUserInputResolvedEvent,
  ProviderRuntimeTaskStartedEvent,
  ProviderRuntimeTaskProgressEvent,
  ProviderRuntimeTaskUpdatedEvent,
  ProviderRuntimeTaskCompletedEvent,
  ProviderRuntimeHookStartedEvent,
  ProviderRuntimeHookProgressEvent,
  ProviderRuntimeHookCompletedEvent,
  ProviderRuntimeToolProgressEvent,
  ProviderRuntimeToolSummaryEvent,
  ProviderRuntimeAuthStatusEvent,
  ProviderRuntimeAccountUpdatedEvent,
  ProviderRuntimeAccountRateLimitsUpdatedEvent,
  ProviderRuntimeMcpStatusUpdatedEvent,
  ProviderRuntimeMcpOauthCompletedEvent,
  ProviderRuntimeModelReroutedEvent,
  ProviderRuntimeConfigWarningEvent,
  ProviderRuntimeDeprecationNoticeEvent,
  ProviderRuntimeFilesPersistedEvent,
  ProviderRuntimeToolDeniedEvent,
  ProviderRuntimeWarningEvent,
  ProviderRuntimeErrorEvent,
]);
export type ProviderRuntimeEventV2 = typeof ProviderRuntimeEventV2.Type;

export const ProviderRuntimeEvent = ProviderRuntimeEventV2;
export type ProviderRuntimeEvent = ProviderRuntimeEventV2;

export const ProviderRuntimeTurnStatus = RuntimeTurnState;
export type ProviderRuntimeTurnStatus = RuntimeTurnState;
