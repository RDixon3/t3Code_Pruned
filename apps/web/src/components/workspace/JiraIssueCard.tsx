import type { JiraIssue, JiraTransition } from "@t3tools/contracts";
import { useState } from "react";
import {
  BugIcon,
  CheckSquareIcon,
  BookmarkIcon,
  TriangleAlertIcon,
  ChevronDownIcon,
  MessageSquarePlusIcon,
  EllipsisIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
import type { ContextItem } from "../../lib/contextItem";
import { jiraContextItem } from "./jiraContextItem";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuSubPopup,
} from "../ui/menu";

export function JiraIssueCard({
  issue,
  siteUrl,
  cloudId,
  busy,
  onTransition,
  compact = false,
  onAddContextItem,
}: {
  issue: JiraIssue;
  siteUrl: string;
  cloudId: string;
  busy: boolean;
  compact?: boolean;
  onAddContextItem?: ((item: ContextItem) => void) | undefined;
  onTransition: (issue: JiraIssue, transition: JiraTransition) => Promise<void>;
}) {
  const [transitions, setTransitions] = useState<ReadonlyArray<JiraTransition>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = issue.issueType.toLowerCase();
  const Icon =
    type === "risk"
      ? TriangleAlertIcon
      : type === "bug"
        ? BugIcon
        : type === "story"
          ? BookmarkIcon
          : CheckSquareIcon;
  const color =
    type === "risk"
      ? "text-orange-500"
      : type === "bug"
        ? "text-red-500"
        : type === "story"
          ? "text-green-500"
          : "text-blue-500";
  const url = `${siteUrl}/browse/${encodeURIComponent(issue.key)}`;
  const addToChat = () => onAddContextItem?.(jiraContextItem(issue, cloudId, siteUrl));
  const load = async () => {
    if (!window.desktopBridge?.getJiraTransitions) return;
    setLoading(true);
    setTransitions([]);
    setError(null);
    try {
      setTransitions(
        await window.desktopBridge.getJiraTransitions({ cloudId, issueKey: issue.key }),
      );
    } catch {
      setError("Could not load available statuses. Reopen to retry.");
    } finally {
      setLoading(false);
    }
  };
  const transitionItems = (
    <>
      {loading && (
        <p className="p-2 text-xs text-muted-foreground" role="status">
          Loading statuses…
        </p>
      )}
      {error && (
        <p className="p-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && transitions.length === 0 && (
        <p className="p-2 text-xs text-muted-foreground">No available transitions.</p>
      )}
      {transitions.map((transition) => (
        <MenuItem
          key={transition.id}
          disabled={busy}
          onClick={() => void onTransition(issue, transition)}
        >
          {transition.name}
        </MenuItem>
      ))}
    </>
  );
  const assignee = (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
      >
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground"
        >
          {issue.assignee?.slice(0, 1).toUpperCase() ?? "?"}
        </span>
        <span className="truncate">{issue.assignee ?? "Unassigned"}</span>
      </TooltipTrigger>
      <TooltipPopup>{issue.assignee ?? "Unassigned"}</TooltipPopup>
    </Tooltip>
  );
  const title = (
    <Tooltip>
      <TooltipTrigger
        render={<a href={url} target="_blank" rel="noreferrer" />}
        className="line-clamp-2 text-sm font-medium leading-snug hover:underline focus-visible:rounded-sm focus-visible:outline-ring"
        onClick={(event) => {
          if (window.desktopBridge) {
            event.preventDefault();
            void window.desktopBridge.openExternal(url);
          }
        }}
      >
        {issue.summary}
      </TooltipTrigger>
      <TooltipPopup className="max-w-sm">{issue.summary}</TooltipPopup>
    </Tooltip>
  );
  const key = (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={`size-3.5 shrink-0 ${color}`} aria-label={issue.issueType} />
      {issue.key}
    </span>
  );
  const actions = (
    <Menu>
      <MenuTrigger
        render={<Button size="icon-xs" variant="ghost" aria-label={`Actions for ${issue.key}`} />}
      >
        <EllipsisIcon className="size-4" />
      </MenuTrigger>
      <MenuPopup align="end" className="w-56">
        {onAddContextItem && (
          <MenuItem onClick={addToChat}>
            <MessageSquarePlusIcon />
            Add to chat draft
          </MenuItem>
        )}
        <MenuItem
          render={<a href={url} target="_blank" rel="noreferrer" />}
          onClick={(event) => {
            if (window.desktopBridge) {
              event.preventDefault();
              void window.desktopBridge.openExternal(url);
            }
          }}
        >
          <ExternalLinkIcon />
          Open in Jira
        </MenuItem>
        <MenuSeparator />
        <p className="px-2 py-1 text-xs text-muted-foreground">Current status: {issue.status}</p>
        <MenuSub
          onOpenChange={(open) => {
            if (open) void load();
          }}
        >
          <MenuSubTrigger disabled={busy}>Change status</MenuSubTrigger>
          <MenuSubPopup className="w-56">{transitionItems}</MenuSubPopup>
        </MenuSub>
      </MenuPopup>
    </Menu>
  );
  return compact ? (
    <article className="grid items-center gap-3 rounded-lg border border-border/70 border-l-2 border-l-orange-500 bg-muted/15 px-4 py-3 @min-[44rem]:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1.5">
        {key}
        {title}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3 @min-[44rem]:gap-4">
        {issue.priority && (
          <span
            className="text-xs text-muted-foreground"
            aria-label={`Priority: ${issue.priority}`}
          >
            {issue.priority}
          </span>
        )}
        <Menu
          onOpenChange={(open) => {
            if (open) void load();
          }}
        >
          <MenuTrigger
            disabled={busy}
            aria-label={`Change status of ${issue.key}`}
            className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            {issue.status}
            <ChevronDownIcon className="size-3" />
          </MenuTrigger>
          <MenuPopup align="start" className="w-56">
            {transitionItems}
          </MenuPopup>
        </Menu>
        <div className="max-w-36">{assignee}</div>
        {onAddContextItem && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            aria-label={`Add ${issue.key} to chat`}
            onClick={addToChat}
          >
            <MessageSquarePlusIcon className="size-3.5" />
            Add to chat
          </Button>
        )}
      </div>
    </article>
  ) : (
    <article className="space-y-2.5 rounded-lg border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">{key}</div>
          {assignee}
          {issue.storyPoints != null && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                aria-label={`${issue.storyPoints} story points`}
              >
                {issue.storyPoints}
              </TooltipTrigger>
              <TooltipPopup>Story points</TooltipPopup>
            </Tooltip>
          )}
        </div>
        {actions}
      </div>
      {title}
      {issue.priority && (
        <div className="pt-1">
          <span
            className="shrink-0 text-[11px] text-muted-foreground"
            aria-label={`Priority: ${issue.priority}`}
          >
            {issue.priority}
          </span>
        </div>
      )}
    </article>
  );
}
