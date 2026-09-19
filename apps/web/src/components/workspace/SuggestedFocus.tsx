import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { SparklesIcon } from "lucide-react";
import { Button } from "../ui/button";
import { focusScope, useFocusStore } from "./suggestedFocusState";
import { useFocusRefresh } from "./useFocusRefresh";

export function SuggestedFocus({
  environmentId,
  projectId,
  jira,
  disabled,
  onAddToChat,
}: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  jira: { siteUrl: string; projectKey: string };
  disabled: boolean;
  onAddToChat?: ((text: string) => void) | undefined;
}) {
  const target = { environmentId, projectId, ...jira };
  const scope = focusScope(target);
  const entry = useFocusStore((state) => state.entries[scope]);
  const stale = Boolean(
    entry?.result && entry.checkedSnapshotKey && entry.snapshotKey !== entry.checkedSnapshotKey,
  );
  const refresh = useFocusRefresh();
  return (
    <section
      aria-label="Suggested focus"
      className="mb-7 rounded-lg border border-border/70 bg-muted/15 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon className="size-4 text-foreground" />
          Suggested focus
        </h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || entry?.busy}
          onClick={() => void refresh(target)}
        >
          {entry?.busy ? "Refreshing…" : "Refresh briefing"}
        </Button>
      </div>
      {entry?.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {entry.error}
        </p>
      )}
      {entry?.busy && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Checking Jira and updating the briefing if needed…
        </p>
      )}
      {entry?.result && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Briefing generated {new Date(entry.generatedAt!).toLocaleString()}
            {stale ? " · Updates available" : ""}
            {entry.incomplete ? " · Based on a partial issue list" : ""}
          </p>
          {entry.result.suggestions.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No project briefing is available yet.
            </p>
          )}
          <ul className="mt-3 space-y-4">
            {entry.result.suggestions.map((item) => (
              <li key={`${item.action}:${item.issueKeys.join(",")}`} className="text-sm">
                <p className="font-medium">{item.action}</p>
                <p className="mt-1 text-muted-foreground">{item.reason}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {item.issueKeys.map((key) => (
                    <a
                      key={key}
                      href={`${jira.siteUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-sm text-xs font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                    >
                      {key}
                    </a>
                  ))}
                  {onAddToChat && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={stale || disabled}
                      onClick={() =>
                        onAddToChat(
                          `Discuss this project briefing (generated ${new Date(entry.generatedAt!).toLocaleString()} from loaded Jira fields):\n${item.action}\n${item.reason}\n${item.issueKeys.map((key) => `${key}: ${jira.siteUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`).join("\n")}\nVerify the current issue details before acting.`,
                        )
                      }
                    >
                      Discuss in chat
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {entry?.checkedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          Jira checked {new Date(entry.checkedAt).toLocaleString()} · {entry.issueCount} issues
          checked
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Automatically checks Jira when the last refresh is over 24 hours old while CoCo is open.
      </p>
    </section>
  );
}
