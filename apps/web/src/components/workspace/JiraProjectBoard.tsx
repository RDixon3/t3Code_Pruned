import { SuggestedFocus } from "./SuggestedFocus";
import type {
  EnvironmentId,
  ProjectId,
  JiraIssue,
  JiraIssuePage,
  JiraTransition,
} from "@t3tools/contracts";
import type { ReactNode } from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { isElectron } from "../../env";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { jiraColumnTransitions } from "./jiraBoardMove";
import { JiraIssueCard } from "./JiraIssueCard";
import type { ContextItem } from "../../lib/contextItem";

const columns = [
  { category: "new", label: "To Do" },
  { category: "indeterminate", label: "In Progress" },
  { category: "done", label: "Done" },
] as const;
type BoardData = JiraIssuePage & { cloudId: string };

export function JiraProjectBoard({
  jira,
  hasProject,
  environmentId,
  projectId,
  heading,
  onAddToChat,
  onAddContextItem,
}: {
  jira: { siteUrl: string; projectKey: string } | null;
  hasProject: boolean;
  environmentId?: EnvironmentId;
  projectId?: ProjectId;
  heading?: ReactNode;
  onAddToChat?: ((text: string) => void) | undefined;
  onAddContextItem?: ((item: ContextItem) => void) | undefined;
}) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(Boolean(jira && window.desktopBridge?.listJiraIssues));
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const dragged = useRef<JiraIssue | null>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [move, setMove] = useState<{
    issue: JiraIssue;
    choices: readonly JiraTransition[];
    label: string;
  } | null>(null);
  const [checkingMove, setCheckingMove] = useState(false);
  const clearDrag = () => {
    dragged.current = null;
    setDragging(false);
    setOver(null);
  };
  const [error, setError] = useState<string | null>(null);
  const initial = useRef<Promise<BoardData> | null>(null);
  const mounted = useRef(true);
  const bridge = window.desktopBridge;
  const siteUrl = jira?.siteUrl;
  const projectKey = jira?.projectKey;
  const fetchFirst = useCallback(async (): Promise<BoardData> => {
    if (!siteUrl || !projectKey || !bridge?.listJiraSites || !bridge.listJiraIssues)
      throw new Error("Open CoCo desktop to load Jira issues.");
    const sites = await bridge.listJiraSites();
    const site = sites.find((item) => item.url.replace(/\/$/, "") === siteUrl.replace(/\/$/, ""));
    if (!site)
      throw new Error(
        "The linked Jira site is not accessible with this connection. Relink the project or reconnect in Settings.",
      );
    return { ...(await bridge.listJiraIssues({ cloudId: site.id, projectKey })), cloudId: site.id };
  }, [siteUrl, projectKey, bridge]);
  // The parent keys this board by environment, project, and Jira link. Share the initial
  // request across Strict Mode effect replay without starting duplicate MCP sessions.
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (siteUrl && bridge?.listJiraIssues) {
      if (!initial.current) initial.current = fetchFirst();
      void initial.current
        .then(
          (result) => {
            if (active) setData(result);
          },
          (cause: unknown) => {
            if (active)
              setError(cause instanceof Error ? cause.message : "Could not load Jira issues.");
          },
        )
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [siteUrl, bridge?.listJiraIssues, fetchFirst]);
  const refresh = async (more = false) => {
    setLoading(true);
    setError(null);
    try {
      const result =
        more && data?.nextPageToken && jira && bridge?.listJiraIssues
          ? {
              ...(await bridge.listJiraIssues({
                cloudId: data.cloudId,
                projectKey: jira.projectKey,
                nextPageToken: data.nextPageToken,
              })),
              cloudId: data.cloudId,
            }
          : await fetchFirst();
      if (mounted.current)
        setData(
          more && data
            ? {
                ...result,
                issues: [
                  ...data.issues,
                  ...result.issues.filter(
                    (issue) => !data.issues.some((previous) => previous.id === issue.id),
                  ),
                ],
              }
            : result,
        );
      return true;
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "Could not load Jira issues.");
      return false;
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  const transition = async (issue: JiraIssue, target: JiraTransition) => {
    if (!data || !bridge?.transitionJiraIssue || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      await bridge.transitionJiraIssue({
        cloudId: data.cloudId,
        issueKey: issue.key,
        transitionId: target.id,
      });
      if (mounted.current && !(await refresh()))
        setError(
          "Status changed in Jira, but the board could not refresh. Refresh before making another change.",
        );
    } catch {
      if (mounted.current)
        setError(
          `Could not confirm the status change for ${issue.key}. Refresh to check its status, or open it in Jira if the transition requires additional fields.`,
        );
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const drop = async (category: JiraIssue["category"], label: string) => {
    const issue = dragged.current;
    clearDrag();
    if (
      !issue ||
      issue.category === category ||
      operation.current ||
      loading ||
      move ||
      !data ||
      !bridge?.getJiraTransitions
    )
      return;
    operation.current = true;
    setCheckingMove(true);
    setError(null);
    try {
      const available = await bridge.getJiraTransitions({
        cloudId: data.cloudId,
        issueKey: issue.key,
      });
      if (!mounted.current) return;
      const choices = jiraColumnTransitions(available, category);
      operation.current = false;
      if (choices.length === 1) await transition(issue, choices[0]!);
      else if (choices.length > 1) setMove({ issue, choices, label });
      else
        setError(
          `Jira did not provide an available transition to ${label} for ${issue.key}. Use the card's Change status menu or open the issue in Jira.`,
        );
    } catch {
      if (mounted.current)
        setError("Could not check available Jira statuses. No move was sent. Try again.");
    } finally {
      operation.current = false;
      if (mounted.current) setCheckingMove(false);
    }
  };
  const blocked = busy || loading || checkingMove || move !== null;
  const risks = data?.issues.filter((issue) => issue.issueType.toLowerCase() === "risk") ?? [];
  const work = data?.issues.filter((issue) => issue.issueType.toLowerCase() !== "risk") ?? [];
  const guidance = !hasProject
    ? "Select a project in the sidebar to view its work and risks."
    : !jira
      ? "Link a Jira project to view its work and risks."
      : !bridge?.listJiraIssues
        ? "Open CoCo desktop to load Jira issues from your connected account."
        : null;
  const card = (issue: JiraIssue, compact = false) => (
    <JiraIssueCard
      key={issue.id}
      issue={issue}
      siteUrl={jira!.siteUrl}
      cloudId={data!.cloudId}
      busy={blocked}
      onTransition={transition}
      compact={compact}
      onAddContextItem={onAddContextItem}
    />
  );
  return (
    <div className="@container">
      <WorkspacePageHeader
        electron={isElectron}
        reserveNativeControls={false}
        className="h-auto min-h-24 flex-wrap items-start justify-between gap-3 px-0 pt-7 pb-6 sm:px-0"
      >
        {heading}
        <div className="no-drag flex shrink-0 items-center gap-3 pt-1 text-xs text-muted-foreground">
          {jira && bridge?.listJiraIssues && (
            <Button variant="ghost" size="sm" disabled={blocked} onClick={() => void refresh()}>
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
          )}
          {!guidance && (
            <p role="status" className="border-l border-border pl-3">
              {loading
                ? "Loading…"
                : data
                  ? `${data.issues.length} issues${data.nextPageToken ? " · More available" : ""}`
                  : "Jira issues"}
            </p>
          )}
        </div>
      </WorkspacePageHeader>
      {guidance && (
        <p role="status" className="mb-6 text-sm text-muted-foreground">
          {guidance}
        </p>
      )}
      {checkingMove && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Checking Jira status…
        </p>
      )}
      {busy && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Updating Jira…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-md border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
          {data && " Previously loaded issues remain visible."}
        </p>
      )}
      {jira && environmentId && projectId && (
        <SuggestedFocus
          environmentId={environmentId}
          projectId={projectId}
          jira={jira}
          disabled={!bridge?.listJiraIssues}
          onAddToChat={onAddToChat}
        />
      )}
      <div className="space-y-7">
        <section aria-labelledby="risks-heading">
          <h2 id="risks-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
            <TriangleAlertIcon className="size-4 text-orange-500" />
            Risks{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{risks.length}</span>
          </h2>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {risks.map((issue) => card(issue, true))}
            {data && !loading && risks.length === 0 && (
              <p className="rounded-lg bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                {data.nextPageToken
                  ? "No Risk issues in the loaded results."
                  : "No issues of type Risk in this project."}
              </p>
            )}
          </div>
        </section>
        <section aria-labelledby="project-work-heading">
          <h2
            id="project-work-heading"
            className="mb-3 flex items-center gap-3 text-base font-semibold"
          >
            Project work{" "}
            <span className="text-xs font-normal text-muted-foreground">{work.length}</span>
          </h2>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[34rem] grid-cols-3 gap-3">
              {columns.map(({ category, label }) => (
                <section
                  key={category}
                  aria-label={label}
                  className={`min-h-72 space-y-3 rounded-lg bg-muted/25 p-3 ${over === category ? "ring-2 ring-primary bg-primary/5" : ""}`}
                  onDragOver={(event) => {
                    if (!dragging || blocked || dragged.current?.category === category) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOver(category);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !(event.relatedTarget instanceof Node) ||
                      !event.currentTarget.contains(event.relatedTarget)
                    )
                      setOver(null);
                  }}
                  onDrop={(event) => {
                    if (!dragged.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                    void drop(category, label);
                  }}
                >
                  <h3 className="flex items-center gap-2 border-b border-border/70 pb-3 text-sm font-medium">
                    {label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {work.filter((issue) => issue.category === category).length}
                    </span>
                  </h3>
                  {work
                    .filter((issue) => issue.category === category)
                    .map((issue) => (
                      <div
                        key={issue.id}
                        draggable={
                          !blocked &&
                          Boolean(bridge?.getJiraTransitions && bridge?.transitionJiraIssue)
                        }
                        className={blocked ? "" : "cursor-grab active:cursor-grabbing"}
                        onDragStart={(event) => {
                          if (
                            blocked ||
                            (event.target instanceof Element &&
                              event.target.closest("a,button,[role=menuitem]"))
                          ) {
                            event.preventDefault();
                            return;
                          }
                          dragged.current = issue;
                          setDragging(true);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("application/x-coco-jira-issue", issue.id);
                        }}
                        onDragEnd={clearDrag}
                      >
                        {card(issue)}
                      </div>
                    ))}
                  {data && !loading && !work.some((issue) => issue.category === category) && (
                    <p className="py-12 text-center text-xs text-muted-foreground">
                      {data.nextPageToken
                        ? "No loaded issues"
                        : category === "indeterminate"
                          ? "No work in progress"
                          : "No issues"}
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
      <Dialog
        open={move !== null}
        onOpenChange={(open) => {
          if (!open) setMove(null);
        }}
      >
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose a status</DialogTitle>
            <DialogDescription>
              {move?.issue.key} has multiple transitions into {move?.label}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 p-4">
            {move?.choices.map((choice) => (
              <Button
                key={choice.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  const issue = move.issue;
                  setMove(null);
                  void transition(issue, choice);
                }}
              >
                {choice.to?.name ?? choice.name}
                {choice.to?.name && choice.to.name !== choice.name ? ` (${choice.name})` : ""}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMove(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      {data?.nextPageToken && (
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" disabled={blocked} onClick={() => void refresh(true)}>
            Load more
          </Button>
          <span>Work and risks show loaded issues only, most recently updated first.</span>
        </div>
      )}
    </div>
  );
}
