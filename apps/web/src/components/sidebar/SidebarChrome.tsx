import { ArrowLeftIcon, BookOpenIcon, ChartNoAxesColumnIcon, SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";
import { Link, useCanGoBack, useLocation, useNavigate } from "@tanstack/react-router";
import { useEnvironmentIdentificationMode } from "../../hooks/useSettings";
import { useOpenHelp } from "../../help/navigation";
import { cn } from "../../lib/utils";
import { WorkspaceModeSwitch } from "../workspace/WorkspaceModeSwitch";
import {
  resolveEnvironmentIdentificationPillLabel,
  useEnvironmentStageLabel,
} from "../SidebarStageBackdrop";
import { Badge } from "../ui/badge";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { SidebarUpdatePill } from "./SidebarUpdatePill";

export const SidebarChromeHeader = memo(function SidebarChromeHeader({
  isElectron,
}: {
  isElectron: boolean;
}) {
  const stageLabel = useEnvironmentStageLabel();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const pillLabel =
    environmentIdentificationMode === "pill"
      ? resolveEnvironmentIdentificationPillLabel(stageLabel)
      : null;

  return (
    <>
      <SidebarHeader
        className={cn(
          "@container/sidebar-header relative h-[var(--workspace-topbar-height)] shrink-0 flex-row items-center px-3 py-0 md:px-0",
          isElectron && "drag-region",
        )}
      >
        <SidebarTrigger className="relative z-10 md:hidden" />
        <SidebarBrand />
        {pillLabel ? (
          <Badge
            className="relative z-10 ml-1 hidden rounded-full px-1.5 text-muted-foreground @[15rem]/sidebar-header:inline-flex"
            data-environment-identification="pill"
            size="sm"
            variant="secondary"
          >
            {pillLabel}
          </Badge>
        ) : null}
      </SidebarHeader>
      <WorkspaceModeSwitch />
    </>
  );
});

function SidebarBrand() {
  return (
    <Link
      aria-label="CoCo — go to Build"
      className="relative z-10 ml-[var(--workspace-titlebar-content-left)] hidden h-7 w-fit min-w-0 shrink-0 items-center overflow-hidden rounded-md outline-hidden ring-ring focus-visible:ring-2 md:flex"
      to="/"
    >
      <span className="inline-flex min-w-0 items-baseline text-lg font-bold tracking-tight">
        <span className="text-[#d04a02] dark:text-[#eb8c00]">Co</span>
        <span className="text-[#e0301e] dark:text-[#ff6b55]">Co</span>
      </span>
    </Link>
  );
}

function SidebarUtilityItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton aria-label={label} onClick={onClick} size="icon">
              {icon}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}

export const SidebarUtilityMenu = memo(function SidebarUtilityMenu() {
  const navigate = useNavigate();
  const openHelp = useOpenHelp();
  const canGoBack = useCanGoBack();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentFooterPage = useLocation({
    select: (location) =>
      /^\/settings(?:\/|$)/.test(location.pathname)
        ? "settings"
        : /^\/projects\/[^/]+\/?$/.test(location.pathname)
          ? "project-settings"
          : location.pathname === "/usage"
            ? "usage"
            : location.pathname === "/pull-requests"
              ? "pull-requests"
              : null,
  });
  const closeMobileSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const handleSettingsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/settings" });
  }, [closeMobileSidebar, navigate]);
  const handleHelpClick = useCallback(() => {
    closeMobileSidebar();
    openHelp();
  }, [closeMobileSidebar, openHelp]);

  const handleUsageClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/usage" });
  }, [isMobile, navigate, setOpenMobile]);

  const handleBackClick = useCallback(() => {
    closeMobileSidebar();
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, closeMobileSidebar, navigate]);

  return (
    <SidebarMenu className="flex-row items-center">
      {currentFooterPage ? (
        <SidebarMenuItem className="min-w-0 flex-1">
          <SidebarMenuButton onClick={handleBackClick}>
            <ArrowLeftIcon />
            <span>Back</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : (
        <>
          <SidebarUtilityItem
            icon={<SettingsIcon />}
            label="Settings"
            onClick={handleSettingsClick}
          />
          <SidebarUtilityItem
            icon={<ChartNoAxesColumnIcon />}
            label="Usage"
            onClick={handleUsageClick}
          />
        </>
      )}
      <SidebarUtilityItem icon={<BookOpenIcon />} label="Help" onClick={handleHelpClick} />
      <SidebarUpdatePill />
    </SidebarMenu>
  );
});

export const SidebarChromeFooter = memo(function SidebarChromeFooter() {
  return (
    <SidebarFooter className="p-[var(--sidebar-content-inset)]">
      <SidebarProviderUpdatePill />
      <SidebarUtilityMenu />
    </SidebarFooter>
  );
});
