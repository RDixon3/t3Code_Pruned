import { useAtomValue } from "@effect/atom-react";
import { v0AgentStatus } from "../../state/v0Agent";
import type { V0ConnectionStatus } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { HelpLink } from "../help/HelpLink";
import { Button } from "../ui/button";
import { SettingsSection } from "./settingsLayout";

type ConnectionAction = "connect" | "test" | "cancel" | "disconnect";

export function V0Settings() {
  const bridge = window.desktopBridge;
  const agentStatus = useAtomValue(v0AgentStatus);
  const available = Boolean(
    bridge?.connectV0 &&
    bridge?.getV0ConnectionStatus &&
    bridge?.testV0Connection &&
    bridge?.disconnectV0,
  );
  const [status, setStatus] = useState<V0ConnectionStatus | null>(null);
  const [busy, setBusy] = useState<ConnectionAction | "loading" | null>(
    available ? "loading" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const readRequest = useRef(0);
  const actionRequest = useRef(0);

  useEffect(() => {
    if (!available || !bridge?.getV0ConnectionStatus) return;
    let active = true;
    const refreshStatus = async () => {
      const id = ++readRequest.current;
      try {
        const result = await bridge.getV0ConnectionStatus!();
        if (active && id === readRequest.current) setStatus(result);
      } catch {
        if (active && id === readRequest.current)
          setError("Could not read the saved v0 connection. Reconnect or disconnect to reset it.");
      } finally {
        if (active && id === readRequest.current)
          setBusy((current) => (current === "loading" ? null : current));
      }
    };
    const unsubscribe = bridge.onV0ConnectionChanged?.(() => void refreshStatus());
    void refreshStatus();
    return () => {
      active = false;
      readRequest.current++;
      actionRequest.current++;
      unsubscribe?.();
    };
  }, [available, bridge]);

  async function run(action: ConnectionAction) {
    const command =
      action === "connect"
        ? bridge?.connectV0
        : action === "test"
          ? bridge?.testV0Connection
          : action === "cancel"
            ? bridge?.cancelV0Connection
            : bridge?.disconnectV0;
    if (!command) return;
    const id = ++actionRequest.current;
    readRequest.current++;
    setBusy(action);
    setError(null);
    try {
      const result = await command();
      if (id === actionRequest.current) {
        readRequest.current++;
        setStatus(result);
      }
    } catch (cause) {
      if (id === actionRequest.current) {
        setError(cause instanceof Error ? cause.message : "v0 connection failed. Try again.");
        const readId = ++readRequest.current;
        const latest = await bridge?.getV0ConnectionStatus?.().catch(() => null);
        if (id === actionRequest.current && readId === readRequest.current && latest)
          setStatus(latest);
      }
    } finally {
      if (id === actionRequest.current) setBusy(null);
    }
  }

  return (
    <SettingsSection id="v0" title="v0 (Beta)">
      <div className="space-y-3 border-b border-border/60 p-4 last:border-b-0">
        <p className="font-medium">v0 connection</p>
        <p className="text-sm text-muted-foreground">
          Sign in to v0 in your browser, using your organization’s SSO if required. This connection
          is saved on this desktop.
        </p>
        <HelpLink article="v0" label="v0 connection guide" />
        <p className="break-all text-xs text-muted-foreground">https://v0.app/api/mcp</p>
        {!available ? (
          <p className="text-sm text-muted-foreground">
            Connection setup is available in the desktop app.
          </p>
        ) : (
          <>
            <p role="status" className="text-sm">
              {busy === "connect"
                ? "Complete sign-in in your browser…"
                : busy === "test"
                  ? "Testing connection…"
                  : busy === "disconnect"
                    ? "Disconnecting…"
                    : busy === "cancel"
                      ? "Canceling sign-in…"
                      : busy === "loading"
                        ? "Reading saved connection…"
                        : status?.needsReauthentication
                          ? "Sign-in expired or additional authorization is required. Reconnect to continue."
                          : status?.connected
                            ? status.checkedAt
                              ? "Signed in · tool discovery passed"
                              : "Signed in · connection not yet verified"
                            : "Not connected"}
            </p>
            {status?.connected && status.checkedAt && !status.needsReauthentication && (
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(status.checkedAt).toLocaleString()}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy !== null} onClick={() => void run("connect")}>
                {status?.connected || status?.needsReauthentication ? "Reconnect" : "Connect"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !status?.connected || status.needsReauthentication}
                onClick={() => void run("test")}
              >
                Test connection
              </Button>
              {(status?.connected ||
                status?.needsReauthentication ||
                error ||
                busy === "connect") && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    (busy !== null && busy !== "connect") ||
                    (busy === "connect" && !bridge?.cancelV0Connection)
                  }
                  onClick={() => void run(busy === "connect" ? "cancel" : "disconnect")}
                >
                  {busy === "connect" ? "Cancel sign-in" : "Disconnect"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Credentials are encrypted on this device. Disconnect removes this saved connection.
            </p>
            {status?.diagnostics && (
              <details className="space-y-2 text-xs">
                <summary className="cursor-pointer">Connection diagnostics</summary>
                <p>
                  Latest connection check. Discovery does not verify every tool. Credentials and
                  prototype content are omitted.
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
                {status.diagnosticsPath && (
                  <p className="break-all text-muted-foreground">Log: {status.diagnosticsPath}</p>
                )}
              </details>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {available
            ? agentStatus
            : "Use a connected CoCo desktop to make v0 tools available to chats on its local environment."}
        </p>
      </div>
    </SettingsSection>
  );
}
