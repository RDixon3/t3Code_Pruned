import type {
  CoCoProjectContext,
  EnvironmentId,
  ProjectId,
  JiraSite,
  JiraProject,
} from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, CheckIcon } from "lucide-react";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from "../ui/menu";

export function ProjectJiraLink({
  environmentId,
  projectId,
  appearance = "button",
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  appearance?: "button" | "subtitle";
}) {
  const saved = useEnvironmentSettings(
    environmentId,
    (settings) => settings.cocoProjectContexts[projectId]?.jira ?? null,
  );
  const update = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const bridge = window.desktopBridge;
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<ReadonlyArray<JiraSite> | null>(null);
  const [site, setSite] = useState<JiraSite | null>(null);
  const [projects, setProjects] = useState<ReadonlyArray<JiraProject>>([]);
  const [nextStartAt, setNextStartAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  const loadProjects = async (selected: JiraSite, startAt = 0) => {
    if (!bridge?.listJiraProjects) return;
    const id = ++request.current;
    setSite(selected);
    if (startAt === 0) {
      setProjects([]);
      setNextStartAt(null);
    }
    setLoading(true);
    setError(null);
    try {
      const page = await bridge.listJiraProjects({ cloudId: selected.id, startAt });
      if (id !== request.current) return;
      setProjects((previous) =>
        startAt === 0
          ? page.projects
          : [
              ...previous,
              ...page.projects.filter(
                (project) => !previous.some((item) => item.id === project.id),
              ),
            ],
      );
      setNextStartAt(page.nextStartAt);
    } catch (cause) {
      if (id === request.current)
        setError(cause instanceof Error ? cause.message : "Could not load Jira projects.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  };
  const loadSites = async () => {
    if (!bridge?.listJiraSites) return;
    const id = ++request.current;
    setSite(null);
    setLoading(true);
    setError(null);
    try {
      const result = await bridge.listJiraSites();
      if (id !== request.current) return;
      setSites(result);
      if (result.length === 1) await loadProjects(result[0]!);
    } catch (cause) {
      if (id === request.current)
        setError(cause instanceof Error ? cause.message : "Could not load Jira sites.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  };
  const save = async (jira: Exclude<CoCoProjectContext["jira"], undefined>) => {
    setError(null);
    setSaving(true);
    try {
      const result = await update({
        environmentId,
        input: { patch: { cocoProjectContexts: { [projectId]: { jira } } } },
      });
      if (result._tag === "Failure") {
        setError("Could not save the Jira link. Check the environment connection and try again.");
        return;
      }
      setOpen(false);
    } catch {
      setError("Could not save the Jira link.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Menu
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (next && sites === null && !loading) void loadSites();
      }}
    >
      <MenuTrigger
        render={
          <Button
            variant={appearance === "subtitle" ? "ghost" : "outline"}
            size="sm"
            title={saved?.siteUrl}
            className={
              appearance === "subtitle"
                ? "h-auto max-w-full justify-start px-0 py-1 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                : undefined
            }
          />
        }
      >
        <span className="truncate">
          {saved
            ? appearance === "subtitle"
              ? `${saved.projectKey} · ${saved.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
              : `Jira: ${saved.projectKey}`
            : "Link Jira project"}
        </span>
        <ChevronDownIcon className="size-3" />
      </MenuTrigger>
      <MenuPopup align={appearance === "subtitle" ? "start" : "end"} className="w-72">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {site ? site.name : "Jira project"}
        </div>
        <MenuItem disabled={saving} closeOnClick={false} onClick={() => void save(null)}>
          None{!saved && <CheckIcon className="ml-auto size-3" />}
        </MenuItem>
        <MenuSeparator />
        {!bridge?.listJiraSites ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Open CoCo desktop to choose from your connected Jira account.
          </p>
        ) : (
          <>
            {site && (
              <MenuItem
                disabled={loading || saving}
                closeOnClick={false}
                onClick={() => {
                  setSite(null);
                  setError(null);
                }}
              >
                Back to Jira sites
              </MenuItem>
            )}
            {!site &&
              sites?.map((item) => (
                <MenuItem
                  key={item.id}
                  disabled={loading || saving}
                  closeOnClick={false}
                  onClick={() => void loadProjects(item)}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.url}</span>
                  </span>
                  <ChevronRightIcon className="ml-auto" />
                </MenuItem>
              ))}
            {site &&
              projects.map((project) => (
                <MenuItem
                  key={project.id}
                  disabled={saving || loading}
                  closeOnClick={false}
                  onClick={() =>
                    void save({
                      siteUrl: site.url,
                      projectKey: project.key,
                      ...(saved?.siteUrl === site.url &&
                      saved.projectKey === project.key &&
                      saved.boardId
                        ? { boardId: saved.boardId }
                        : {}),
                    })
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate">{project.name}</span>
                    <span className="block text-xs text-muted-foreground">{project.key}</span>
                  </span>
                  {saved?.siteUrl === site.url && saved.projectKey === project.key && (
                    <CheckIcon className="ml-auto size-3" />
                  )}
                </MenuItem>
              ))}
            {loading && (
              <p role="status" className="px-2 py-2 text-xs text-muted-foreground">
                Loading {site ? "projects" : "sites"}…
              </p>
            )}
            {saving && (
              <p role="status" className="px-2 py-2 text-xs text-muted-foreground">
                Saving…
              </p>
            )}
            {!loading && !error && (site ? projects.length === 0 : sites?.length === 0) && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No accessible {site ? "projects in this site" : "sites"}.
              </p>
            )}
            {site && nextStartAt !== null && (
              <MenuItem
                disabled={loading || saving}
                closeOnClick={false}
                onClick={() => void loadProjects(site, nextStartAt)}
              >
                Load more
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem
              disabled={loading || saving}
              closeOnClick={false}
              onClick={() => void (site ? loadProjects(site) : loadSites())}
            >
              Refresh
            </MenuItem>
          </>
        )}
        {error && (
          <p role="alert" className="px-2 py-2 text-xs text-destructive wrap-break-word">
            {error}
          </p>
        )}
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Applies to this project across CoCo
        </p>
      </MenuPopup>
    </Menu>
  );
}
