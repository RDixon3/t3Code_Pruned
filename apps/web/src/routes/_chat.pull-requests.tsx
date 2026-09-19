import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve old links while the standalone pull-request listing is disabled in CoCo.
export const Route = createFileRoute("/_chat/pull-requests")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
