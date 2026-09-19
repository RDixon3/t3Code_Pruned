import { Link, useLocation, useParams } from "@tanstack/react-router";
import { cn } from "../../lib/utils";
import { useSidebar } from "../ui/sidebar";
import { useUiStateStore } from "../../uiStateStore";

export function WorkspaceModeSwitch() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const params = useParams({ strict: false });
  const manageLayout = useUiStateStore((state) => state.manageLayout);
  const setManageLayout = useUiStateStore((state) => state.setManageLayout);

  const { isMobile, setOpenMobile } = useSidebar();
  const mode =
    pathname === "/pursue" ? "Pursue" : pathname === "/manage" || manageLayout ? "Manage" : "Build";

  return (
    <>
      <nav
        aria-label="Workspace mode"
        className="no-drag flex shrink-0 gap-1 border-b border-sidebar-border p-2"
      >
        {(["Pursue", "Manage", "Build"] as const).map((label) => (
          <Link
            key={label}
            to={label === "Build" ? "/" : label === "Pursue" ? "/pursue" : "/manage"}
            aria-current={mode === label ? "page" : undefined}
            onClick={(event) => {
              setManageLayout(label === "Manage");
              if (label !== "Pursue" && (params.threadId || params.draftId)) event.preventDefault();
              if (isMobile) setOpenMobile(false);
            }}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === label
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
