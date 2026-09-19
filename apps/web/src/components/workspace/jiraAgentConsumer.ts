import type { JiraAgentEvent, JiraAgentRequest, JiraAgentResponse } from "@t3tools/contracts";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { jiraAgentStatus } from "../../state/jiraAgent";

export function createJiraAgentConsumer<E>(
  stream: Atom.Atom<AsyncResult.AsyncResult<typeof JiraAgentEvent.Type, E>>,
  toolCount: number,
  call: (request: typeof JiraAgentRequest.Type) => Promise<unknown>,
  send: (response: typeof JiraAgentResponse.Type) => Promise<unknown>,
) {
  return Atom.make((get) => {
    const seen = new Set<string>();
    let disposed = false;
    const setStatus = (text: string) =>
      queueMicrotask(() => {
        if (!disposed) get.set(jiraAgentStatus, text);
      });
    setStatus("Connecting Jira chat tools…");
    get.addFinalizer(() => {
      disposed = true;
      queueMicrotask(() => get.set(jiraAgentStatus, "Jira chat tools are not connected."));
    });
    const consume = (result: AsyncResult.AsyncResult<typeof JiraAgentEvent.Type, E>) => {
      if (AsyncResult.isFailure(result)) {
        setStatus(
          "Jira chat tools unavailable. Test the connection to retry; close any other CoCo windows if needed.",
        );
        return;
      }
      if (!AsyncResult.isSuccess(result)) return;
      if (result.value.type === "connected") {
        setStatus(
          `Jira chat tools ready (${toolCount}). If an existing chat does not show them, start a new chat.`,
        );
        return;
      }
      const request = result.value.request;
      if (seen.has(request.requestId)) return;
      seen.add(request.requestId);
      if (seen.size > 256) seen.delete(seen.values().next().value!);
      // A request is executed once. Reconnection or response failure must never replay a write.
      void call(request).then(
        (value) => send({ requestId: request.requestId, result: value }),
        () =>
          send({
            requestId: request.requestId,
            error:
              "Jira request failed. A dispatched write may have completed; check Jira before retrying. Test the connection in Settings.",
          }),
      );
    };
    // Subscribing alone does not evaluate a lazy atom. Start the stream, but
    // never execute its cached request when this consumer remounts.
    const initial = get.once(stream);
    get.subscribe(stream, consume);
    if (
      AsyncResult.isFailure(initial) ||
      (AsyncResult.isSuccess(initial) && initial.value.type === "connected")
    )
      consume(initial);
  }).pipe(Atom.setIdleTTL(0));
}
