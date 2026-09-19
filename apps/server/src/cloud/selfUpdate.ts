import {
  ServerSelfUpdateError,
  type ServerSelfUpdateCapability,
  type ServerSelfUpdateInput,
  type ServerSelfUpdateProgressStage,
  type ServerSelfUpdateResult,
  type ThreadId,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Ref from "effect/Ref";
import * as Layer from "effect/Layer";

import * as ServerConfig from "../config.ts";
import * as DesktopAppUpdate from "../desktopUpdate/DesktopAppUpdate.ts";
export function resolveServerSelfUpdateCapability(input: {
  readonly desktopManaged: boolean;
}): ServerSelfUpdateCapability | null {
  if (input.desktopManaged) return "desktop-managed" as const;
  return null;
}

export class ServerSelfUpdate extends Context.Service<
  ServerSelfUpdate,
  {
    readonly update: (
      input: ServerSelfUpdateInput,
      reportProgress?: (
        stage: ServerSelfUpdateProgressStage,
      ) => Effect.Effect<void, ServerSelfUpdateError>,
    ) => Effect.Effect<ServerSelfUpdateResult, ServerSelfUpdateError>;
    readonly commitDesktopUpdate: (
      requestId: string,
      onHandoffAccepted?: () => Effect.Effect<void>,
    ) => Effect.Effect<never, ServerSelfUpdateError>;
  }
>()("t3/cloud/selfUpdate/ServerSelfUpdate") {}

export const withRunningThreadContinuation = Effect.fn(
  "cloud.server_self_update.withRunningThreadContinuation",
)(function* (input: {
  readonly selfUpdate: ServerSelfUpdate["Service"];
  readonly prepare: Effect.Effect<ReadonlyArray<ThreadId>, ServerSelfUpdateError>;
  readonly clear: (
    threadIds: ReadonlyArray<ThreadId>,
  ) => Effect.Effect<void, ServerSelfUpdateError>;
}) {
  const desktopContinuationTokens = yield* Ref.make(HashSet.empty<string>());
  const clearOnError = <A>(
    effect: Effect.Effect<A, ServerSelfUpdateError>,
    threadIds: () => ReadonlyArray<ThreadId>,
    handoffAccepted: () => boolean,
  ): Effect.Effect<A, ServerSelfUpdateError> =>
    effect.pipe(
      Effect.catchCause((cause) =>
        (handoffAccepted() && Cause.hasInterruptsOnly(cause)
          ? Effect.void
          : input.clear(threadIds())
        ).pipe(Effect.andThen(Effect.failCause(cause))),
      ),
    );

  const update: ServerSelfUpdate["Service"]["update"] = (
    request,
    reportProgress = () => Effect.void,
  ) =>
    input.selfUpdate
      .update(request, reportProgress)
      .pipe(
        Effect.tap((result) =>
          result.desktopUpdateToken !== undefined && request.continueRunningThreads === true
            ? Ref.update(desktopContinuationTokens, HashSet.add(result.desktopUpdateToken))
            : Effect.void,
        ),
      );

  return ServerSelfUpdate.of({
    update,
    commitDesktopUpdate: (requestId) =>
      Effect.gen(function* () {
        const shouldContinue = yield* Ref.modify(desktopContinuationTokens, (tokens) => [
          HashSet.has(tokens, requestId),
          HashSet.remove(tokens, requestId),
        ]);
        let handoffAccepted = false;
        let continuationThreadIds: ReadonlyArray<ThreadId> = [];
        return yield* clearOnError(
          Effect.gen(function* () {
            continuationThreadIds = shouldContinue ? yield* input.prepare : [];
            return yield* input.selfUpdate.commitDesktopUpdate(requestId, () =>
              Effect.sync(() => {
                handoffAccepted = true;
              }),
            );
          }),
          () => continuationThreadIds,
          () => handoffAccepted,
        ).pipe(
          Effect.catchCause((cause) =>
            (shouldContinue && !handoffAccepted
              ? Ref.update(desktopContinuationTokens, HashSet.add(requestId))
              : Effect.void
            ).pipe(Effect.andThen(Effect.failCause(cause))),
          ),
        );
      }),
  });
});

export const make = Effect.fn("desktop.server_self_update.make")(function* () {
  const serverConfig = yield* ServerConfig.ServerConfig;
  const desktopAppUpdate = yield* DesktopAppUpdate.DesktopAppUpdate;
  const update: ServerSelfUpdate["Service"]["update"] = (
    _input,
    reportProgress = () => Effect.void,
  ) => {
    if (serverConfig.mode === "desktop" && desktopAppUpdate.available) {
      return desktopAppUpdate.run(reportProgress);
    }
    return Effect.fail(
      new ServerSelfUpdateError({
        reason:
          "Update the CoCo desktop app to update its bundled server. Standalone server updates are not supported.",
      }),
    );
  };
  return ServerSelfUpdate.of({
    update,
    commitDesktopUpdate: (requestId, onHandoffAccepted) =>
      desktopAppUpdate.commit(requestId, onHandoffAccepted),
  });
});

export const layer = Layer.effect(ServerSelfUpdate, make());
