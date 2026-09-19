import type { ServiceNowSdkProfile } from "@t3tools/contracts";
import { useState } from "react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

export function DeleteServiceNowSdkProfileDialog({
  profile,
  onClose,
  onDeleted,
}: {
  profile: ServiceNowSdkProfile;
  onClose: () => void;
  onDeleted: (remaining: ReadonlyArray<ServiceNowSdkProfile>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (!profile || !window.desktopBridge?.deleteServiceNowSdkProfile) return;
    setBusy(true);
    setError(null);
    try {
      const remaining = await window.desktopBridge.deleteServiceNowSdkProfile(profile);
      await onDeleted(remaining);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the profile.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete SDK profile?</DialogTitle>
          <DialogDescription>
            This removes the saved SDK credentials from this machine. If selected for this project,
            its SDK selection will return to None. Other projects may need another selection.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {profile && (
            <p className="break-words text-sm">
              Delete <strong>{profile.alias}</strong> for <strong>{profile.instanceUrl}</strong>?
              You will need to sign in again to recreate it.
            </p>
          )}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy || !profile} onClick={() => void remove()}>
            {busy ? "Deleting…" : "Delete profile"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
