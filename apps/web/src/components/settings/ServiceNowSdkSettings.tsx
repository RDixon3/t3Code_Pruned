import { useEffect } from "react";
import {
  useServiceNowSdk,
  runServiceNowSdk,
  checkServiceNowSdkOnLaunch,
} from "../../state/serviceNowSdk";
import { Button } from "../ui/button";
import { HelpLink } from "../help/HelpLink";
import { SettingsSection } from "./settingsLayout";
import { ServiceNowConnectionSettings } from "./ServiceNowConnectionSettings";

export function ServiceNowSdkSettings() {
  const bridge = window.desktopBridge;
  const available = Boolean(bridge?.checkServiceNowSdk && bridge?.installServiceNowSdk);
  const { status, busy, error } = useServiceNowSdk();
  const run = runServiceNowSdk;
  useEffect(() => {
    if (window.desktopBridge?.checkServiceNowSdkUpdates) void checkServiceNowSdkOnLaunch();
    else if (!useServiceNowSdk.getState().status) void runServiceNowSdk("checking");
  }, []);
  return (
    <SettingsSection id="servicenow-sdk" title="ServiceNow">
      <ServiceNowConnectionSettings />
      <div className="space-y-3 p-4">
        <p className="font-medium">ServiceNow SDK</p>
        <p className="text-sm text-muted-foreground">
          Global installation on this desktop machine, using your current npm environment. Applies
          to every project.
        </p>
        <HelpLink article="servicenow" label="SDK and profile guide" />
        {!available ? (
          <p className="text-sm text-muted-foreground">Available in the desktop app.</p>
        ) : (
          <>
            <p role="status" className="text-sm">
              {busy === "updating"
                ? "Updating ServiceNow SDK…"
                : busy === "checkingUpdates"
                  ? "Checking for SDK updates…"
                  : busy === "installing"
                    ? "Installing ServiceNow SDK…"
                    : busy === "checking"
                      ? "Checking global installation…"
                      : status?.installed
                        ? `Installed globally · v${status.version}`
                        : status
                          ? "Not installed globally"
                          : "Installation status unavailable"}
            </p>
            {status?.latestVersion && (
              <p className="text-sm text-muted-foreground">
                {status.updateAvailable
                  ? `Update available · v${status.latestVersion}`
                  : `Latest published · v${status.latestVersion}${status.installed ? " · No update needed" : ""}`}
              </p>
            )}
            {status && (
              <p className="break-all text-xs text-muted-foreground">
                Global packages: {status.globalRoot}
              </p>
            )}
            <code className="block break-all text-xs text-muted-foreground">
              npm install --global @servicenow/sdk
            </code>
            {error && (
              <pre
                role="alert"
                className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive"
              >
                {error}
              </pre>
            )}
            <div className="flex gap-2">
              {status && !status.installed && (
                <Button size="sm" disabled={busy !== null} onClick={() => void run("installing")}>
                  {busy === "installing" ? "Installing…" : "Install SDK"}
                </Button>
              )}
              {status?.updateAvailable && bridge?.updateServiceNowSdk && (
                <Button size="sm" disabled={busy !== null} onClick={() => void run("updating")}>
                  {busy === "updating" ? "Updating…" : `Update to v${status.latestVersion}`}
                </Button>
              )}
              {status?.installed && bridge?.checkServiceNowSdkUpdates && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void run("checkingUpdates")}
                >
                  Check for updates
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void run("checking")}
              >
                Check again
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
