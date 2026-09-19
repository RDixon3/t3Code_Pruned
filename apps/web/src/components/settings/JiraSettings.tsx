import { useAtomValue } from "@effect/atom-react";
import { jiraAgentStatus } from "../../state/jiraAgent";
import type { JiraConnectionStatus } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { HelpLink } from "../help/HelpLink";
import { SettingsSection } from "./settingsLayout";

export function JiraSettings() {
  return (
    <SettingsSection id="jira" title="Jira">
      <JiraConnectionSettings />
    </SettingsSection>
  );
}

function JiraConnectionSettings() {
  const agentStatus = useAtomValue(jiraAgentStatus);
  const bridge = window.desktopBridge;
  const available = Boolean(
    bridge?.connectJira &&
    bridge?.getJiraConnectionStatus &&
    bridge?.testJiraConnection &&
    bridge?.disconnectJira,
  );
  const [status, setStatus] = useState<JiraConnectionStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(available ? "loading" : null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!bridge?.getJiraConnectionStatus) return;
    const id = ++request.current;
    void bridge
      .getJiraConnectionStatus()
      .then((result) => {
        if (id === request.current) setStatus(result);
      })
      .catch(() => {
        if (id === request.current)
          setError("Could not read the saved Jira connection. Disconnect to reset it.");
      })
      .finally(() => {
        if (id === request.current) setBusy(null);
      });
    return () => {
      request.current++;
    };
  }, [bridge]);

  async function run(action: "connect" | "test" | "disconnect") {
    const command =
      action === "connect"
        ? bridge?.connectJira
        : action === "test"
          ? bridge?.testJiraConnection
          : bridge?.disconnectJira;
    if (!command) return;
    const id = ++request.current;
    setBusy(action);
    setError(null);
    setStatus((current) => (current ? { ...current, checkedAt: null } : null));
    try {
      const result = await command();
      if (id === request.current) setStatus(result);
    } catch (cause) {
      if (id === request.current) {
        setError(cause instanceof Error ? cause.message : "Jira connection failed. Try again.");
        const latest = await bridge?.getJiraConnectionStatus?.().catch(() => null);
        if (id === request.current && latest) setStatus(latest);
      }
    } finally {
      if (id === request.current) setBusy(null);
    }
  }

  return (
    <div className="space-y-3 border-b border-border/60 p-4 last:border-b-0">
      <p className="font-medium">Atlassian Rovo MCP</p>
      <p className="text-sm text-muted-foreground">
        Sign in through Atlassian using your organization’s SSO. This connection applies to all
        projects on this desktop.
      </p>
      <HelpLink article="jira" label="Jira connection guide" />
      <p className="break-all text-xs text-muted-foreground">https://mcp.atlassian.com/v1/mcp</p>
      {!available ? (
        <p className="text-sm text-muted-foreground">Available in the desktop app.</p>
      ) : (
        <>
          <p role="status" className="text-sm">
            {busy === "connect"
              ? "Complete sign-in in your browser…"
              : busy === "test"
                ? "Testing connection…"
                : busy === "disconnect"
                  ? "Disconnecting…"
                  : busy === "loading"
                    ? "Checking saved connection…"
                    : status?.checkedAt
                      ? "Connected · MCP checks passed"
                      : status?.connected
                        ? "Signed in · connection not yet verified"
                        : "Not connected"}
          </p>
          <p role="status" className="text-xs text-muted-foreground">
            {agentStatus}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy !== null} onClick={() => void run("connect")}>
              {status?.connected ? "Reconnect with SSO" : "Connect with SSO"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null || !status?.connected}
              onClick={() => void run("test")}
            >
              Test connection
            </Button>
            {(status?.connected || error || busy === "connect") && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null && busy !== "connect"}
                onClick={() => void run("disconnect")}
              >
                {busy === "connect" ? "Cancel sign-in" : "Disconnect"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Credentials are encrypted on this device. Disconnect removes the saved connection; you
            can revoke access in your Atlassian account.
          </p>
          {status?.diagnostics && (
            <details className="space-y-2 text-xs">
              <summary className="cursor-pointer">Connection diagnostics</summary>
              <p>
                Latest Connect/Test run. Tool discovery does not verify every tool. Tokens and raw
                issue content are omitted.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(status.diagnostics ?? "")
                    .catch(() =>
                      setError("Could not copy diagnostics. Select and copy the report below."),
                    );
                }}
              >
                Copy diagnostics
              </Button>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 select-text">
                {status.diagnostics}
              </pre>
              <p className="break-all text-muted-foreground">Log: {status.diagnosticsPath}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
