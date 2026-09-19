import type { EnvironmentId, ProjectId, ServiceNowSdkProfile } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { useEnvironmentPresentation } from "../../state/presentation";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuItem,
  MenuSeparator,
} from "../ui/menu";
import { composerFloatingLayerProps } from "./composerEventScope";
import { AddServiceNowSdkProfileDialog } from "./AddServiceNowSdkProfileDialog";
import { DeleteServiceNowSdkProfileDialog } from "./DeleteServiceNowSdkProfileDialog";
import { isHostLocalSdkEnvironment } from "./serviceNowSdkHost";
import {
  ComposerControl,
  ComposerControlChevron,
  type ComposerControlSize,
} from "./ComposerControl";

export function ServiceNowSdkProfilePicker({
  environmentId,
  projectId,
  size = "sm",
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId | null;
  size?: ComposerControlSize;
}) {
  const bridge = window.desktopBridge;
  const { presentation } = useEnvironmentPresentation(environmentId);
  const selection = useEnvironmentSettings(environmentId, (settings) =>
    projectId ? (settings.cocoProjectContexts[projectId]?.sdk ?? null) : null,
  );
  const update = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const [profiles, setProfiles] = useState<ReadonlyArray<ServiceNowSdkProfile> | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ServiceNowSdkProfile | null>(null);
  const [created, setCreated] = useState<ServiceNowSdkProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discoveryId = useRef(0);
  const local = isHostLocalSdkEnvironment(
    presentation?.entry.target,
    presentation?.serverConfig?.environment.platform.os,
    bridge?.getClientPlatform?.(),
    window.location.href,
  );
  const listProfiles = bridge?.listServiceNowSdkProfiles;
  const refresh = useCallback(async () => {
    if (!local || !listProfiles) return;
    const id = ++discoveryId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listProfiles();
      if (id === discoveryId.current) setProfiles(result);
    } catch (cause) {
      if (id === discoveryId.current)
        setError(cause instanceof Error ? cause.message : "Could not list SDK profiles.");
    } finally {
      if (id === discoveryId.current) setLoading(false);
    }
  }, [local, listProfiles]);
  useEffect(() => {
    void refresh();
    return () => {
      discoveryId.current++;
    };
  }, [refresh]);

  if (!local || !listProfiles) return null;
  const select = async (sdk: ServiceNowSdkProfile | null) => {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await update({
        environmentId,
        input: { patch: { cocoProjectContexts: { [projectId]: { sdk } } } },
      });
      if (result._tag === "Failure")
        setError("Profile not saved. Check the environment connection and try again.");
      else setOpen(false);
    } catch {
      setError("Profile not saved. Check the environment connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  const missing =
    selection &&
    profiles &&
    !profiles.some(
      (profile) =>
        profile.alias === selection.alias && profile.instanceUrl === selection.instanceUrl,
    );
  return (
    <>
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger
          render={<ComposerControl size={size} className="max-w-40 shrink-0" />}
          aria-label={`ServiceNow SDK profile: ${selection?.alias ?? "None"}`}
          title={`ServiceNow SDK: ${selection?.alias ?? "None"}. Applies to this project.${selection ? ` ${selection.instanceUrl}` : ""}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={size === "xs" ? "size-3 shrink-0" : "size-4 shrink-0"}
            fill="currentColor"
          >
            <path d="M12 2a10 10 0 0 0-7.5 16.6c.5.6 1.4.6 1.9 0a7 7 0 0 1 11.2 0c.5.6 1.4.6 1.9 0A10 10 0 0 0 12 2Zm0 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
          </svg>
          <span className="truncate">SDK: {selection?.alias ?? "None"}</span>
          <ComposerControlChevron size={size} />
        </MenuTrigger>
        <MenuPopup {...composerFloatingLayerProps} className="w-56" align="start" side="top">
          <MenuGroup>
            <MenuGroupLabel>ServiceNow SDK</MenuGroupLabel>
            <MenuRadioGroup
              value={selection ? JSON.stringify([selection.alias, selection.instanceUrl]) : "none"}
            >
              <MenuRadioItem
                value="none"
                disabled={saving || !projectId}
                closeOnClick={false}
                onClick={() => void select(null)}
              >
                None
              </MenuRadioItem>
              {profiles?.map((profile) => (
                <div key={profile.alias} className="flex items-center gap-1">
                  <MenuRadioItem
                    className="min-w-0 flex-1"
                    value={JSON.stringify([profile.alias, profile.instanceUrl])}
                    disabled={saving || !projectId}
                    closeOnClick={false}
                    onClick={() => void select(profile)}
                    title={profile.instanceUrl}
                  >
                    <span className="block truncate">{profile.alias}</span>
                    <span className="block truncate text-xs text-muted-foreground/80">
                      {profile.instanceUrl}
                    </span>
                  </MenuRadioItem>
                  {bridge?.deleteServiceNowSdkProfile && (
                    <MenuItem
                      className="shrink-0 px-1.5 text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
                      aria-label={`Delete SDK profile ${profile.alias}`}
                      title={`Delete ${profile.alias}`}
                      disabled={saving}
                      onClick={() => {
                        setOpen(false);
                        setDeleting(profile);
                      }}
                    >
                      <Trash2Icon className="size-3.5" aria-hidden="true" />
                    </MenuItem>
                  )}
                </div>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          {profiles?.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No profiles found. Add a profile to sign in.
            </p>
          )}
          {missing && (
            <p role="status" className="px-2 py-1.5 text-xs text-amber-600">
              The saved profile is missing or its instance changed. Select a profile to update it.
            </p>
          )}
          {error && (
            <p role="alert" className="px-2 py-1.5 break-words text-xs text-destructive">
              {error}
            </p>
          )}
          <MenuSeparator />
          <MenuItem
            disabled={loading || saving}
            closeOnClick={false}
            onClick={() => void refresh()}
          >
            {loading ? "Loading…" : "Refresh"}
          </MenuItem>
          {bridge?.addServiceNowSdkProfile && (
            <MenuItem
              disabled={saving}
              onClick={() => {
                setOpen(false);
                setAdding(true);
              }}
            >
              Add profile…
            </MenuItem>
          )}
          {created && projectId && (
            <MenuItem disabled={saving} closeOnClick={false} onClick={() => void select(created)}>
              Use {created.alias} for this project
            </MenuItem>
          )}
          <p className="px-2 py-1.5 text-xs text-muted-foreground/80">
            {projectId ? "Applies to this project" : "Select a project to choose a profile"}
          </p>
        </MenuPopup>
      </Menu>
      {adding && (
        <AddServiceNowSdkProfileDialog
          open={adding}
          onOpenChange={setAdding}
          onCreated={(profile) => {
            setCreated(profile);
            void refresh();
            setOpen(true);
          }}
        />
      )}
      {deleting && (
        <DeleteServiceNowSdkProfileDialog
          profile={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async (remaining) => {
            discoveryId.current++;
            setProfiles(remaining);
            setCreated(null);
            setError(null);
            if (
              selection?.alias === deleting.alias &&
              selection.instanceUrl === deleting.instanceUrl
            ) {
              await select(null);
            }
            setOpen(true);
          }}
        />
      )}
    </>
  );
}
