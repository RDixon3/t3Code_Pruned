import type { EnvironmentId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { BotIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { cocoLibrary } from "../../state/coco";
import { Button } from "../ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from "../ui/menu";
export function CoCoAgentPicker({
  environmentId,
  agentId,
  lockedName,
  locked,
  onChange,
  onNewChat,
  size,
}: {
  environmentId: EnvironmentId;
  agentId: string | null;
  lockedName?: string | undefined;
  locked: boolean;
  onChange: (id: string | null) => void;
  onNewChat: () => void;
  size: "sm" | "xs";
}) {
  const result = useAtomValue(cocoLibrary({ environmentId, input: {} }));
  const agents = result._tag === "Success" ? result.value.agents : [];
  const label = locked
    ? (lockedName ?? "Default")
    : (agents.find((agent) => agent.id === agentId)?.name ??
      (agentId ? agentId[0]!.toUpperCase() + agentId.slice(1) : "Default"));
  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size={size} className="gap-1 text-muted-foreground" />}
      >
        <BotIcon className="size-3.5" />
        {label}
        <ChevronDownIcon className="size-3" />
      </MenuTrigger>
      <MenuPopup side="top" align="start" className="min-w-48">
        {locked ? (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Agent is fixed for this chat.
            </div>
            <MenuItem onClick={onNewChat}>Start a new chat</MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={() => onChange(null)}>
              Default{agentId === null && <CheckIcon className="ml-auto size-3.5" />}
            </MenuItem>
            {agents.map((agent) => (
              <MenuItem key={agent.id} onClick={() => onChange(agent.id)} title={agent.description}>
                {agent.name}
                {agentId === agent.id && <CheckIcon className="ml-auto size-3.5" />}
              </MenuItem>
            ))}
            {result._tag !== "Success" && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {result._tag === "Failure"
                  ? "Agents unavailable. Check the connection."
                  : "Loading agents…"}
              </div>
            )}
            <MenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Applies to this new chat.
            </div>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
