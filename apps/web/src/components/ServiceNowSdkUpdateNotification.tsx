import { useNavigate } from "@tanstack/react-router";
import { DownloadIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDismissedProviderUpdateNotificationKeys } from "../providerUpdateDismissal";
import {
  checkServiceNowSdkOnLaunch,
  runServiceNowSdk,
  useServiceNowSdk,
} from "../state/serviceNowSdk";
import { hiddenToastActionProps, stackedThreadToast, toastManager } from "./ui/toast";

export function ServiceNowSdkUpdateNotification() {
  const navigate = useNavigate();
  const { status, busy } = useServiceNowSdk();
  const { dismissedNotificationKeys, dismissNotificationKey } =
    useDismissedProviderUpdateNotificationKeys();
  const active = useRef<{ id: ReturnType<typeof toastManager.add>; key: string } | null>(null);
  useEffect(() => {
    void checkServiceNowSdkOnLaunch();
  }, []);
  useEffect(
    () => () => {
      if (active.current) toastManager.close(active.current.id);
      active.current = null;
    },
    [],
  );
  useEffect(() => {
    const key =
      status?.updateAvailable && status.latestVersion
        ? JSON.stringify([
            "servicenow-sdk",
            status.globalRoot,
            status.version,
            status.latestVersion,
          ])
        : null;
    if (active.current && (active.current.key !== key || busy === "updating")) {
      toastManager.close(active.current.id);
      active.current = null;
    }
    if (!status || !key || busy || active.current || dismissedNotificationKeys.has(key)) return;
    const openSettings = () => {
      if (active.current) toastManager.close(active.current.id);
      active.current = null;
      dismissNotificationKey(key);
      void navigate({ to: "/settings/integrations", hash: "servicenow-sdk" });
    };
    const runUpdate = async () => {
      if (useServiceNowSdk.getState().busy) return;
      if (active.current) toastManager.close(active.current.id);
      active.current = null;
      dismissNotificationKey(key);
      const progress = toastManager.add({
        type: "loading",
        title: "Updating ServiceNow SDK",
        timeout: 0,
        actionProps: hiddenToastActionProps,
        data: { hideCopyButton: true },
      });
      const result = await runServiceNowSdk("updating");
      toastManager.close(progress);
      if (result) {
        toastManager.add({
          type: "success",
          title: `ServiceNow SDK updated: v${result.version}`,
          description: "New SDK commands will use the installed version.",
          timeout: 0,
          actionProps: hiddenToastActionProps,
          data: { hideCopyButton: true, dismissAfterVisibleMs: 3000 },
        });
      } else {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "ServiceNow SDK update failed",
            description: useServiceNowSdk.getState().error ?? "Check SDK settings and try again.",
            actionProps: { children: "Settings", onClick: openSettings },
            timeout: 0,
            data: { hideCopyButton: true },
          }),
        );
      }
    };
    const id = toastManager.add(
      stackedThreadToast({
        type: "warning",
        title: "ServiceNow SDK update available",
        description: `v${status.version} → v${status.latestVersion} on this desktop.`,
        timeout: 0,
        actionProps: { children: "Update", onClick: () => void runUpdate() },
        actionVariant: "outline",
        data: {
          leadingIcon: <DownloadIcon aria-hidden="true" className="size-4 text-success" />,
          hideCopyButton: true,
          onClose: () => dismissNotificationKey(key),
          secondaryActionProps: { children: "Settings", onClick: openSettings },
          secondaryActionVariant: "outline",
        },
      }),
    );
    active.current = { id, key };
  }, [status, busy, dismissedNotificationKeys, dismissNotificationKey, navigate]);
  return null;
}
