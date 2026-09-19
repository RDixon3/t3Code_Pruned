import { v0AgentStatus } from "../../state/v0Agent";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS, type EnvironmentId } from "@t3tools/contracts";
import { createV0AgentConsumer } from "./v0AgentConsumer";
import { useEffect, useMemo, useState } from "react";
import { connectionAtomRuntime } from "../../connection/runtime";
import { usePrimaryEnvironment } from "../../state/environments";
import { useAtomCommand } from "../../state/use-atom-command";
import { isHostLocalSdkEnvironment } from "../chat/serviceNowSdkHost";

const requests = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "v0-agent:requests",
  tag: WS_METHODS.v0AgentConnect,
  idleTtlMs: 0,
});
const respond = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "v0-agent:respond",
  tag: WS_METHODS.v0AgentRespond,
});

function ConnectedHost({
  environmentId,
  tools,
}: {
  environmentId: EnvironmentId;
  tools: ReadonlyArray<Record<string, unknown>>;
}) {
  const send = useAtomCommand(respond);
  const consumer = useMemo(
    () =>
      createV0AgentConsumer(
        requests({ environmentId, input: { tools } }),
        tools.length,
        (request) => window.desktopBridge!.callV0AgentTool!(request),
        (response) => send({ environmentId, input: response }),
      ),
    [environmentId, tools, send],
  );
  useAtomValue(consumer);
  return null;
}

export function V0AgentHost() {
  const setStatus = useAtomSet(v0AgentStatus);
  const environment = usePrimaryEnvironment();
  const bridge = window.desktopBridge;
  const local = isHostLocalSdkEnvironment(
    environment?.entry.target,
    environment?.serverConfig?.environment.platform.os,
    bridge?.getClientPlatform?.(),
    window.location.href,
  );
  const [tools, setTools] = useState<ReadonlyArray<Record<string, unknown>> | null>(null);
  const environmentId = environment?.environmentId;
  useEffect(() => {
    if (!environmentId || !local || !bridge?.listV0AgentTools || !bridge.callV0AgentTool) return;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      setTools(null);
      setStatus("Loading v0 chat tools…");
      try {
        if (!(await bridge.getV0ConnectionStatus?.())?.connected) {
          if (current === generation) setStatus("Connect v0 to use it in chat.");
          return;
        }
        const discovered = await bridge.listV0AgentTools!();
        if (current === generation) setTools(discovered);
      } catch {
        // Connection testing exposes redacted diagnostics; ordinary chat remains available.
        if (current === generation) {
          setTools(null);
          setStatus("Could not load v0 chat tools. Test the connection to retry.");
        }
      }
    };
    void refresh();
    const unsubscribe = bridge.onV0ConnectionChanged?.(() => {
      void refresh();
    });
    return () => {
      generation++;
      unsubscribe?.();
    };
  }, [local, bridge, environmentId, setStatus]);
  return local && tools && environment ? (
    <ConnectedHost environmentId={environment.environmentId} tools={tools} />
  ) : null;
}
