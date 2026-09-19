// Outgoing operations used by CoCo; incoming client requests and session updates
// retain their complete schema variants, including optional provider capabilities.
export const agentMethods = new Set([
  "initialize",
  "authenticate",
  "session_new",
  "session_load",
  "session_resume",
  "session_prompt",
  "session_cancel",
  "session_set_model",
  "session_set_config_option",
]);

export const schemaRoots = [
  "AuthenticateRequest",
  "AuthenticateResponse",
  "AvailableCommand",
  "CancelNotification",
  "ContentBlock",
  "CreateTerminalRequest",
  "CreateTerminalResponse",
  "ElicitationCompleteNotification",
  "ElicitationRequest",
  "ElicitationResponse",
  "Error",
  "ErrorCode",
  "InitializeRequest",
  "InitializeResponse",
  "KillTerminalRequest",
  "KillTerminalResponse",
  "LoadSessionRequest",
  "LoadSessionResponse",
  "McpServer",
  "ModelInfo",
  "NewSessionRequest",
  "NewSessionResponse",
  "PermissionOption",
  "PromptRequest",
  "PromptResponse",
  "ReadTextFileRequest",
  "ReadTextFileResponse",
  "ReleaseTerminalRequest",
  "ReleaseTerminalResponse",
  "RequestPermissionRequest",
  "RequestPermissionResponse",
  "ResumeSessionRequest",
  "ResumeSessionResponse",
  "SessionConfigOption",
  "SessionMode",
  "SessionModeState",
  "SessionModelState",
  "SessionNotification",
  "SetSessionConfigOptionRequest",
  "SetSessionConfigOptionResponse",
  "SetSessionModeResponse",
  "SetSessionModelRequest",
  "SetSessionModelResponse",
  "TerminalOutputRequest",
  "TerminalOutputResponse",
  "ToolCallContent",
  "ToolCallLocation",
  "ToolCallStatus",
  "ToolKind",
  "WaitForTerminalExitRequest",
  "WaitForTerminalExitResponse",
  "WriteTextFileRequest",
  "WriteTextFileResponse",
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
