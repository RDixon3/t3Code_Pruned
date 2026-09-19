import type { ServiceNowSdkProfile, ServiceNowSdkAuthSession } from "@t3tools/contracts";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "../ui/select";

export function AddServiceNowSdkProfileDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (profile: ServiceNowSdkProfile) => void;
}) {
  const [alias, setAlias] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [authType, setAuthType] = useState("oauth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<ServiceNowSdkAuthSession | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = useRef(false);
  const close = async () => {
    closed.current = true;
    try {
      await window.desktopBridge?.cancelServiceNowSdkProfile?.();
    } finally {
      setCode("");
      setPassword("");
      onOpenChange(false);
    }
  };
  const start = async () => {
    const bridge = window.desktopBridge;
    if (!bridge?.addServiceNowSdkProfile) return;
    setBusy(true);
    setError(null);
    try {
      if (authType === "basic") {
        if (!bridge.addBasicServiceNowSdkProfile)
          throw new Error("Restart CoCo to enable basic sign-in.");
        const submittedPassword = password;
        setPassword("");
        const created = await bridge.addBasicServiceNowSdkProfile({
          alias,
          instanceUrl,
          username,
          password: submittedPassword,
        });
        if (!closed.current) {
          onCreated(created);
          onOpenChange(false);
        }
        return;
      }
      const session = await bridge.addServiceNowSdkProfile({ alias, instanceUrl });
      if (closed.current) {
        await bridge.cancelServiceNowSdkProfile?.();
        return;
      }
      setPending(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start sign-in.");
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    if (!pending || !window.desktopBridge?.completeServiceNowSdkProfile) return;
    setBusy(true);
    setError(null);
    const submittedCode = code;
    setCode("");
    try {
      const created = await window.desktopBridge.completeServiceNowSdkProfile({
        sessionId: pending.sessionId,
        code: submittedCode,
      });
      if (!closed.current) {
        onCreated(created);
        onOpenChange(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed. Please try again.");
      await window.desktopBridge.cancelServiceNowSdkProfile?.();
      setPending(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void close();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add SDK profile</DialogTitle>
          <DialogDescription>
            {pending
              ? "Paste the code shown after ServiceNow sign-in. CoCo will finish saving your SDK profile."
              : "Sign in using the installed ServiceNow SDK. Credentials stay with the SDK."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {pending ? (
            <label className="block space-y-1 text-sm">
              Sign-in code
              <Input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
                autoFocus
              />
            </label>
          ) : (
            <>
              <div className="space-y-1 text-sm">
                <span>Authentication</span>
                <Select
                  value={authType}
                  onValueChange={(value) => {
                    if (value) {
                      setAuthType(value);
                      setPassword("");
                    }
                  }}
                  disabled={busy}
                >
                  <SelectTrigger aria-label="Authentication type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="oauth">OAuth (browser sign-in)</SelectItem>
                    <SelectItem value="basic">Basic (username and password)</SelectItem>
                  </SelectPopup>
                </Select>
              </div>
              <label className="block space-y-1 text-sm">
                Profile name
                <Input
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="project-dev"
                  disabled={busy}
                />
              </label>
              <label className="block space-y-1 text-sm">
                Instance URL
                <Input
                  value={instanceUrl}
                  onChange={(event) => setInstanceUrl(event.target.value)}
                  placeholder="https://example.service-now.com"
                  disabled={busy}
                />
              </label>
              {authType === "basic" && (
                <>
                  <label className="block space-y-1 text-sm">
                    Username
                    <Input
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    Password
                    <Input
                      type="password"
                      autoComplete="off"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={busy}
                    />
                  </label>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {authType === "basic"
                  ? "Sign-in completes here; no browser opens. "
                  : "Your browser opens for SSO; paste the returned code here. "}
                The SDK makes the new profile its machine-wide default. CoCo project selections
                remain unchanged.
              </p>
            </>
          )}
          {busy && (
            <p role="status" className="text-sm text-muted-foreground">
              {pending ? "Saving profile…" : "Starting ServiceNow sign-in…"}
            </p>
          )}
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => void close()}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              (pending
                ? !code.trim()
                : !alias.trim() ||
                  !instanceUrl.trim() ||
                  (authType === "basic" && (!username.trim() || !password)))
            }
            onClick={() => void (pending ? finish() : start())}
          >
            {pending ? "Complete sign-in" : "Sign in"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
