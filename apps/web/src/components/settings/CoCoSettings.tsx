import { CoCoContentRepository, type EnvironmentId } from "@t3tools/contracts";
import { useAtomValue, useAtomRefresh } from "@effect/atom-react";
import * as Schema from "effect/Schema";
import { Input } from "../ui/input";
import { serverEnvironment } from "../../state/server";
import { useState } from "react";
import { cocoLibrary, cocoSkillsAction } from "../../state/coco";
import { useAtomCommand } from "../../state/use-atom-command";
import { usePrimaryEnvironment } from "../../state/environments";
import { Button } from "../ui/button";
import { HelpLink } from "../help/HelpLink";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
const isContentRepository = Schema.is(CoCoContentRepository);

function Repository({ environmentId }: { environmentId: EnvironmentId }) {
  const settings = useAtomValue(serverEnvironment.settingsValueAtom(environmentId));
  if (!settings)
    return <p className="text-sm text-muted-foreground">Loading repository settings…</p>;
  const saved = settings.cocoContentRepository ?? null;
  return (
    <RepositoryEditor
      key={JSON.stringify([environmentId, saved])}
      environmentId={environmentId}
      saved={saved}
    />
  );
}

function RepositoryEditor({
  environmentId,
  saved,
}: {
  environmentId: EnvironmentId;
  saved: CoCoContentRepository | null;
}) {
  const update = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const [url, setUrl] = useState(saved?.url ?? "");
  const [branch, setBranch] = useState(saved?.branch ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (clear = false) => {
    if (busy) return;
    const repository = clear ? null : { url: url.trim(), branch: branch.trim() };
    if (repository && !isContentRepository(repository)) {
      setError(
        "Enter an HTTPS Azure DevOps repository URL without credentials or query parameters, and a valid branch name.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await update({
        environmentId,
        input: { patch: { cocoContentRepository: repository } },
      });
      if (result._tag === "Failure")
        setError("Repository settings were not saved. Check the connection and try again.");
    } catch {
      setError("Repository settings were not saved. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Content repository</h3>
      <p className="text-sm text-muted-foreground">
        Define the Azure DevOps source for agents and skills on this environment.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="block space-y-1 text-sm">
          <span>Repository URL</span>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={busy}
            placeholder="https://dev.azure.com/organization/project/_git/repository"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Approved branch</span>
          <Input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            disabled={busy}
            placeholder="Branch name"
            autoComplete="off"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={
              busy ||
              !url.trim() ||
              !branch.trim() ||
              (url.trim() === saved?.url && branch.trim() === saved.branch)
            }
          >
            {busy ? "Saving…" : "Save repository"}
          </Button>
          {saved && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Clear repository
            </Button>
          )}
        </div>
      </form>
      <p role="status" className="text-xs text-muted-foreground">
        {saved ? "Repository saved. " : ""}Repository authentication and downloading updates are not
        available yet. CoCo is using bundled agents and skills.
      </p>
    </div>
  );
}

function Library({ environmentId }: { environmentId: EnvironmentId }) {
  const atom = cocoLibrary({ environmentId, input: {} });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const action = useAtomCommand(cocoSkillsAction);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const act = async (choice: "enable" | "disable" | "retry" | "remove") => {
    setBusy(true);
    try {
      await action({ environmentId, input: { action: choice } });
    } finally {
      setBusy(false);
      setConfirmRemove(false);
      refresh();
    }
  };
  if (result._tag !== "Success")
    return (
      <div className="text-sm text-muted-foreground">
        {result._tag === "Failure" ? "Could not load agents and skills." : "Loading…"}
        <Button variant="ghost" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  const library = result.value;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {library.agents.map((agent) => (
          <div key={agent.id} className="rounded-lg border p-4">
            <div className="text-sm font-medium">{agent.name}</div>
            <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">View instructions</summary>
              <p className="mt-2 whitespace-pre-wrap">{agent.prompt}</p>
              {agent.skills.length > 0 && <p className="mt-2">Skills: {agent.skills.join(", ")}</p>}
            </details>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Native skills</h3>
        <p className="text-sm text-muted-foreground">
          Install CoCo skills into Codex, Claude and Cursor on this environment. They are also
          available outside CoCo. Enabled installations synchronize bundled skills when CoCo starts;
          existing chats follow each harness’s normal skill-loading behavior.
        </p>
        <p className="text-sm">
          {library.enabled
            ? "Bundled skill synchronization enabled"
            : "Bundled skill synchronization disabled"}{" "}
          · {library.installed} installed copies
        </p>
        {library.installed === 0 && (
          <p className="text-xs text-muted-foreground">
            No CoCo skills are installed on this environment.
          </p>
        )}
        {library.error && (
          <p role="alert" className="text-sm text-destructive">
            {library.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void act(library.enabled ? "disable" : "enable")}
          >
            {library.enabled ? "Disable synchronization" : "Enable installation"}
          </Button>
          {library.enabled && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("retry")}>
              Resync bundled skills
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove CoCo skills…
          </Button>
        </div>
        {confirmRemove && (
          <div className="rounded-lg border p-3 text-sm">
            <p>
              Remove installed CoCo skills and disable synchronization? Other skills will remain.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void act("remove")}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmRemove(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Installation locations</summary>
          {library.destinations.map((path) => (
            <p key={path} className="mt-2 break-all">
              {path}
            </p>
          ))}
        </details>
      </div>
    </div>
  );
}
export function CoCoSettings() {
  const environment = usePrimaryEnvironment();
  return (
    <SettingsPageContainer>
      <SettingsSection title="Agents & Skills" id="agents">
        <HelpLink article="agents" label="Agent and skill guide" />
        {environment ? (
          <div className="space-y-6">
            <Repository environmentId={environment.environmentId} />
            <Library environmentId={environment.environmentId} />
          </div>
        ) : (
          <p>Connect an environment to manage its agents and skills.</p>
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}
