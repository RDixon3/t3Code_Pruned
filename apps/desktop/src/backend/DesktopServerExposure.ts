import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

export interface DesktopServerExposureBackendConfig {
  readonly port: number;
  readonly bindHost: string;
  readonly httpBaseUrl: URL;
}

// Retain the existing backend lifecycle service; persisted sharing preferences
// cannot affect this desktop-only build's loopback binding.
export class DesktopServerExposure extends Context.Service<
  DesktopServerExposure,
  {
    readonly backendConfig: Effect.Effect<DesktopServerExposureBackendConfig>;
    readonly configureFromSettings: (input: { readonly port: number }) => Effect.Effect<void>;
  }
>()("@t3tools/desktop/backend/DesktopServerExposure") {}

export const make = Effect.gen(function* () {
  const port = yield* Ref.make(0);
  return DesktopServerExposure.of({
    backendConfig: Ref.get(port).pipe(
      Effect.map((port) => ({
        port,
        bindHost: "127.0.0.1",
        httpBaseUrl: new URL(`http://127.0.0.1:${port}`),
      })),
    ),
    configureFromSettings: (input) => Ref.set(port, input.port),
  });
});

export const layer = Layer.effect(DesktopServerExposure, make);
