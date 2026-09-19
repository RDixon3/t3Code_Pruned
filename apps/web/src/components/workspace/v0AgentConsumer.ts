import type { V0AgentEvent, V0AgentRequest, V0AgentResponse } from "@t3tools/contracts";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { v0AgentStatus } from "../../state/v0Agent";

export function createV0AgentConsumer<E>(
  stream: Atom.Atom<AsyncResult.AsyncResult<typeof V0AgentEvent.Type, E>>,
  toolCount: number,
  call: (request: typeof V0AgentRequest.Type) => Promise<unknown>,
  send: (response: typeof V0AgentResponse.Type) => Promise<unknown>,
) {
  return Atom.make((get) => {
    const seen = new Set<string>();
    let disposed = false;
    const setStatus = (text: string) =>
      queueMicrotask(() => {
        if (!disposed) get.set(v0AgentStatus, text);
      });
    setStatus("Connecting v0 chat tools…");
    get.addFinalizer(() => {
      disposed = true;
      queueMicrotask(() => get.set(v0AgentStatus, "v0 chat tools are not connected."));
    });
    const consume = (result: AsyncResult.AsyncResult<typeof V0AgentEvent.Type, E>) => {
      if (AsyncResult.isFailure(result)) {
        setStatus(
          "v0 chat tools unavailable. Test the connection to retry; close any other CoCo windows if needed.",
        );
        return;
      }
      if (!AsyncResult.isSuccess(result)) return;
      if (result.value.type === "connected") {
        setStatus(
          `v0 chat tools ready (${toolCount}). If an existing chat does not show them, start a new chat.`,
        );
        return;
      }
      const request = result.value.request;
      if (seen.has(request.requestId)) return;
      seen.add(request.requestId);
      if (seen.size > 256) seen.delete(seen.values().next().value!);
      // A request is executed once. Reconnection or response failure must never replay a write.
      void call(request)
        .then(
          (value) => send({ requestId: request.requestId, result: value }),
          () =>
            send({
              requestId: request.requestId,
              error:
                "v0 request failed. A dispatched write may have completed; check v0 before retrying. Test the connection in Settings.",
            }),
        )
        .catch(() => {
          setStatus(
            "v0 response could not be delivered. Inspect the existing v0 chat before retrying; generation may have completed.",
          );
        });
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
