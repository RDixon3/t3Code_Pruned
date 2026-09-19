import { SERVICENOW_OAUTH_CALLBACK, type ServiceNowConnectionStatus } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ServiceNowConnectionSettings() {
  const bridge = window.desktopBridge;
  const available = Boolean(
    bridge?.getServiceNowConnectionStatus &&
    bridge.connectServiceNow &&
    bridge.testServiceNowConnection &&
    bridge.disconnectServiceNow,
  );
  const [status, setStatus] = useState<ServiceNowConnectionStatus | null>(null);
  const [instanceUrl, setInstanceUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState<string | null>(available ? "loading" : null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(() => {
    if (!bridge?.getServiceNowConnectionStatus) return;
    const id = ++request.current;
    void bridge
      .getServiceNowConnectionStatus()
      .then((result) => {
        if (id !== request.current) return;
        setStatus(result);
        setInstanceUrl(result.config?.instanceUrl ?? "");
        setClientId(result.config?.clientId ?? "");
      })
      .catch(() => {
        if (id === request.current)
          setError("Could not read the saved connection. Disconnect to reset it.");
      })
      .finally(() => {
        if (id === request.current) setBusy(null);
      });
    return () => {
      request.current++;
    };
  }, [bridge]);
  async function run(action: "connect" | "test" | "disconnect") {
    const id = ++request.current;
    setBusy(action);
    setError(null);
    setStatus((current) => (current ? { ...current, checkedAt: null } : current));
    try {
      const result =
        action === "connect"
          ? await bridge?.connectServiceNow?.({ instanceUrl, clientId })
          : action === "test"
            ? await bridge?.testServiceNowConnection?.()
            : await bridge?.disconnectServiceNow?.();
      if (id === request.current && result) setStatus(result);
    } catch (cause) {
      if (id === request.current)
        setError(cause instanceof Error ? cause.message : "ServiceNow connection failed.");
    } finally {
      if (id === request.current) setBusy(null);
    }
  }
  return (
    <div id="servicenow-connection" className="space-y-3 border-b border-border/60 p-4">
      <p className="font-medium">Instance connection</p>
      <p className="text-sm text-muted-foreground">
        Connect the ServiceNow instance that holds your pursuit data. Sign in through your
        organization’s SSO when enabled.
      </p>
      {!available ? (
        <p className="text-sm text-muted-foreground">Available in the desktop app.</p>
      ) : (
        <>
          <label className="block space-y-1 text-sm">
            Instance URL
            <Input
              aria-label="ServiceNow instance URL"
              value={instanceUrl}
              onChange={(event) => setInstanceUrl(event.target.value)}
              placeholder="https://your-instance.service-now.com"
              disabled={busy !== null || Boolean(status?.connected)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            OAuth client ID
            <Input
              aria-label="ServiceNow OAuth client ID"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy !== null || Boolean(status?.connected)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Register a public OAuth client with PKCE (S256) and this exact redirect URI:
          </p>
          <code className="block break-all text-xs">{SERVICENOW_OAUTH_CALLBACK}</code>
          <p role="status" className="text-sm">
            {busy === "connect"
              ? "Complete sign-in in your browser…"
              : busy === "test"
                ? "Testing authentication…"
                : busy === "disconnect"
                  ? "Disconnecting…"
                  : busy === "loading"
                    ? "Checking saved connection…"
                    : status?.checkedAt
                      ? "Connected · authentication verified"
                      : status?.connected
                        ? "Signed in · not yet verified this session"
                        : "Not connected"}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy !== null || !instanceUrl.trim() || !clientId.trim()}
              onClick={() => void run("connect")}
            >
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
            Test connection renews your sign-in. Pursuit table access is not configured yet.
            Credentials are encrypted on this desktop; Disconnect removes them locally.
          </p>
        </>
      )}
    </div>
  );
}
