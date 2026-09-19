// CoCo's Codex adapter uses these outbound operations. Incoming requests and
// notifications stay complete so provider events and approval handling survive upgrades.
export const clientRequestMethods = new Set([
  "initialize",
  "model/list",
  "account/read",
  "skills/list",
  "account/rateLimits/read",
  "account/rateLimitResetCredit/consume",
  "thread/start",
  "thread/resume",
  "thread/compact/start",
  "config/mcpServer/reload",
  "turn/start",
  "turn/interrupt",
  "thread/read",
  "thread/rollback",
  "feedback/upload",
]);

// The adapter decodes these older approval payloads alongside current MCP/CLI events.
export const compatibilitySchemas = [
  // The turn builder adds this optional field for older CLI compatibility.
  "V2TurnStartParams__CollaborationMode",
  "ServerRequest__ApplyPatchApprovalParams",
  "ServerRequest__CommandExecutionRequestApprovalParams",
  "ServerRequest__DynamicToolCallParams",
  "ServerRequest__ExecCommandApprovalParams",
  "ServerRequest__FileChangeRequestApprovalParams",
  "ServerRequest__ToolRequestUserInputParams",
];

// Generated identifiers are unique. A conservative token closure can retain an
// extra declaration mentioned in a comment, but cannot omit a referenced declaration.
export function retainSchemas(entries: ReadonlyMap<string, string>, roots: Iterable<string>) {
  const retained = new Set<string>();
  const pending = [...roots];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (retained.has(name)) continue;
    const code = entries.get(name);
    if (code === undefined) throw new Error(`Unknown retained protocol schema: ${name}`);
    retained.add(name);
    for (const token of code.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
      if (entries.has(token[0]) && !retained.has(token[0])) pending.push(token[0]);
    }
  }
  return new Map([...entries].filter(([name]) => retained.has(name)));
}
