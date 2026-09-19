import { createFileRoute } from "@tanstack/react-router";
import { CoCoSettings } from "../components/settings/CoCoSettings";
export const Route = createFileRoute("/settings/agents")({ component: CoCoSettings });
