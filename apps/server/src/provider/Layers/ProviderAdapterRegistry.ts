import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ProviderUnsupportedError } from "../Errors.ts";
import { ProviderInstanceRegistry } from "../Services/ProviderInstanceRegistry.ts";
import {
  ProviderAdapterRegistry,
  type ProviderAdapterRegistryShape,
} from "../Services/ProviderAdapterRegistry.ts";

const makeProviderAdapterRegistry = Effect.fn("makeProviderAdapterRegistry")(function* () {
  const registry = yield* ProviderInstanceRegistry;

  const getByInstance: ProviderAdapterRegistryShape["getByInstance"] = (instanceId) =>
    registry.getInstance(instanceId).pipe(
      Effect.flatMap((instance) =>
        instance === undefined
          ? Effect.fail(
              new ProviderUnsupportedError({
                provider: instanceId,
              }),
            )
          : Effect.succeed(instance.adapter),
      ),
    );

  const getInstanceInfo: ProviderAdapterRegistryShape["getInstanceInfo"] = (instanceId) =>
    registry.getInstance(instanceId).pipe(
      Effect.flatMap((instance) =>
        instance === undefined
          ? Effect.fail(
              new ProviderUnsupportedError({
                provider: instanceId,
              }),
            )
          : Effect.succeed({
              instanceId: instance.instanceId,
              driverKind: instance.driverKind,
              displayName: instance.displayName,
              accentColor: instance.accentColor,
              enabled: instance.enabled,
              continuationIdentity: instance.continuationIdentity,
            }),
      ),
    );

  const listInstances: ProviderAdapterRegistryShape["listInstances"] = () =>
    registry.listInstances.pipe(
      Effect.map((instances) => instances.map((instance) => instance.instanceId)),
    );

  return {
    getByInstance,
    getInstanceInfo,
    listInstances,
    subscribeChanges: registry.subscribeChanges,
  } satisfies ProviderAdapterRegistryShape;
});

export const ProviderAdapterRegistryLive = Layer.effect(
  ProviderAdapterRegistry,
  makeProviderAdapterRegistry(),
);

// Re-export for consumers (including tests) that construct a
// `ProviderInstanceId` before calling `getByInstance`.
