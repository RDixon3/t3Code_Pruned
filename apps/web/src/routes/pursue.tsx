import { createFileRoute } from "@tanstack/react-router";
import { isElectron } from "../env";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";

export const Route = createFileRoute("/pursue")({
  component: PursueLanding,
});

function PursueLanding() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <WorkspacePageHeader electron={isElectron}>
        <h1 className="text-sm font-medium">Pursue</h1>
      </WorkspacePageHeader>
      <main className="flex flex-1 items-center justify-center p-8">
        <h2 className="text-2xl font-semibold">Coming Soon</h2>
      </main>
    </SidebarInset>
  );
}
