import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { isElectron } from "../env";
import { findHelpTopic } from "../help/catalog";
import { useHelpReturn } from "../help/navigation";

function HelpLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const topic = findHelpTopic(pathname.split("/").at(-1) ?? "");
  const { goBack, label } = useHelpReturn();
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground isolate">
      <WorkspacePageHeader electron={isElectron}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">Help</span>
            {topic ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="truncate">{topic.category}</span>
              </>
            ) : null}
          </div>
          <Button size="xs" variant="ghost" className="no-drag shrink-0" onClick={goBack}>
            <ArrowLeftIcon className="size-3.5" />
            {label}
          </Button>
        </div>
      </WorkspacePageHeader>
      <Outlet />
    </SidebarInset>
  );
}

export const Route = createFileRoute("/help")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/help" || location.pathname === "/help/") {
      throw redirect({
        to: "/help/$articleId",
        params: { articleId: "getting-started" },
        replace: true,
      });
    }
  },
  component: HelpLayout,
});
