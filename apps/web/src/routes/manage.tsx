import { createFileRoute, redirect } from "@tanstack/react-router";
import { useUiStateStore } from "../uiStateStore";

export const Route = createFileRoute("/manage")({
  beforeLoad: () => {
    useUiStateStore.getState().setManageLayout(true);
    throw redirect({ to: "/", replace: true });
  },
});
