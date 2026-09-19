import { jiraAgentStatus } from "../../state/jiraAgent";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS, type EnvironmentId } from "@t3tools/contracts";
import { createJiraAgentConsumer } from "./jiraAgentConsumer";
import { useEffect, useMemo, useState } from "react";
import { connectionAtomRuntime } from "../../connection/runtime";
import { usePrimaryEnvironment } from "../../state/environments";
import { useAtomCommand } from "../../state/use-atom-command";
import { isHostLocalSdkEnvironment } from "../chat/serviceNowSdkHost";

const requests = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "jira-agent:requests",
  tag: WS_METHODS.jiraAgentConnect,
  idleTtlMs: 0,
});
const respond = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "jira-agent:respond",
  tag: WS_METHODS.jiraAgentRespond,
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
      createJiraAgentConsumer(
        requests({ environmentId, input: { tools } }),
        tools.length,
        (request) => window.desktopBridge!.callJiraAgentTool!(request),
        (response) => send({ environmentId, input: response }),
      ),
    [environmentId, tools, send],
  );
  useAtomValue(consumer);
  return null;
}

export function JiraAgentHost() {
  const setStatus = useAtomSet(jiraAgentStatus);
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
    if (!environmentId || !local || !bridge?.listJiraAgentTools || !bridge.callJiraAgentTool)
      return;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      setTools(null);
      setStatus("Loading Jira chat tools…");
      try {
        if (!(await bridge.getJiraConnectionStatus?.())?.connected) {
          setStatus("Connect Jira to use it in chat.");
          return;
        }
        const discovered = await bridge.listJiraAgentTools!();
        if (current === generation) setTools(discovered);
      } catch {
        // Connection testing exposes redacted diagnostics; ordinary chat remains available.
        if (current === generation) {
          setTools(null);
          setStatus("Could not load Jira chat tools. Test the connection to retry.");
        }
      }
    };
    void refresh();
    const unsubscribe = bridge.onJiraConnectionChanged?.(() => {
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
