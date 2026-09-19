import { HostProcessEnvironment, HostProcessPlatform } from "@t3tools/shared/hostProcess";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HostInterfaceAddresses, resolveLocalServerHost, resolveServerHost } from "./config.ts";

it.effect.each([undefined, "localhost", "127.0.0.1", "127.0.0.2", "::1", "[::1]"])(
  "accepts the loopback host %s",
  (host) =>
    Effect.gen(function* () {
      const resolved = yield* resolveLocalServerHost(host);
      expect(resolved).toBe(
        host === undefined || host === "localhost" ? "127.0.0.1" : host === "[::1]" ? "::1" : host,
      );
    }),
);

it.effect.each([
  "0.0.0.0",
  "::",
  "192.168.1.10",
  "100.64.0.2",
  "example.com",
  "127.example.com",
  "127.0.0.999",
])("rejects the non-loopback host %s", (host) =>
  Effect.gen(function* () {
    const error = yield* resolveLocalServerHost(host).pipe(Effect.flip);
    expect(error._tag).toBe("LocalServerHostError");
  }),
);

it.effect.each([
  {
    platform: "linux",
    distro: "Ubuntu",
    host: "172.24.1.2",
    bootstrapHost: "172.24.1.2",
    allowed: true,
  },
  {
    platform: "linux",
    distro: "Ubuntu",
    host: "172.24.1.3",
    bootstrapHost: "172.24.1.3",
    allowed: false,
  },
  {
    platform: "linux",
    distro: "Ubuntu",
    host: "172.24.1.2",
    bootstrapHost: undefined,
    allowed: false,
  },
  {
    platform: "linux",
    distro: undefined,
    host: "172.24.1.2",
    bootstrapHost: "172.24.1.2",
    allowed: false,
  },
  {
    platform: "win32",
    distro: "Ubuntu",
    host: "172.24.1.2",
    bootstrapHost: "172.24.1.2",
    allowed: false,
  },
  {
    platform: "linux",
    distro: "Ubuntu",
    host: "0.0.0.0",
    bootstrapHost: "0.0.0.0",
    allowed: false,
  },
] as const)("limits WSL bootstrap binding to the distro interface: %j", (input) =>
  Effect.gen(function* () {
    const result = yield* resolveServerHost(input.host, input.bootstrapHost).pipe(Effect.result);
    expect(result._tag === "Success").toBe(input.allowed);
  }).pipe(
    Effect.provideService(HostProcessPlatform, input.platform),
    Effect.provideService(
      HostProcessEnvironment,
      input.distro ? { WSL_DISTRO_NAME: input.distro } : {},
    ),
    Effect.provideService(HostInterfaceAddresses, new Set(["172.24.1.2", "0.0.0.0"])),
  ),
);
