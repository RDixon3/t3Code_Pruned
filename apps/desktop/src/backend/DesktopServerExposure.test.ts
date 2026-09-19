import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as DesktopServerExposure from "./DesktopServerExposure.ts";

it.effect(
  "binds each selected backend port to loopback without network discovery or saved sharing settings",
  () =>
    Effect.gen(function* () {
      const endpoint = yield* DesktopServerExposure.make;
      for (const port of [3773, 4888]) {
        yield* endpoint.configureFromSettings({ port });
        const config = yield* endpoint.backendConfig;
        assert.equal(config.port, port);
        assert.equal(config.bindHost, "127.0.0.1");
        assert.equal(config.httpBaseUrl.origin, `http://127.0.0.1:${port}`);
      }
    }),
);
