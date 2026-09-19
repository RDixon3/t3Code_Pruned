import type { ServiceNowSdkStatus } from "@t3tools/contracts";
import { create } from "zustand";

type SdkAction = "checking" | "checkingUpdates" | "installing" | "updating";
export const useServiceNowSdk = create<{
  status: ServiceNowSdkStatus | null;
  busy: SdkAction | null;
  error: string | null;
}>(() => ({ status: null, busy: null, error: null }));

export async function runServiceNowSdk(action: SdkAction): Promise<ServiceNowSdkStatus | null> {
  const bridge = window.desktopBridge;
  const { status, busy } = useServiceNowSdk.getState();
  if (busy || !bridge?.checkServiceNowSdk) return null;
  const update = bridge.updateServiceNowSdk;
  const version = status?.latestVersion;
  const command =
    action === "checking"
      ? bridge.checkServiceNowSdk
      : action === "checkingUpdates"
        ? bridge.checkServiceNowSdkUpdates
        : action === "installing"
          ? bridge.installServiceNowSdk
          : update && version && status
            ? () => update({ version, globalRoot: status.globalRoot })
            : undefined;
  if (!command) return null;
  useServiceNowSdk.setState({ busy: action, error: null });
  try {
    const next = await command();
    useServiceNowSdk.setState({ status: next });
    return next;
  } catch (cause) {
    useServiceNowSdk.setState({ error: cause instanceof Error ? cause.message : String(cause) });
    if (action === "updating" || action === "installing") {
      try {
        useServiceNowSdk.setState({ status: await bridge.checkServiceNowSdk() });
      } catch {
        useServiceNowSdk.setState({ status: null });
      }
    }
    return null;
  } finally {
    useServiceNowSdk.setState({ busy: null });
  }
}

// One attempt per desktop window launch, independent of tab/project navigation.
let startupCheck: Promise<void> | undefined;
export function checkServiceNowSdkOnLaunch() {
  if (!window.desktopBridge?.checkServiceNowSdkUpdates) return Promise.resolve();
  return (startupCheck ??= (async () => {
    await runServiceNowSdk("checkingUpdates");
  })());
}
