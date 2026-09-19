import {
  BearerConnectionTarget,
  PrimaryConnectionTarget,
  RelayConnectionTarget,
} from "@t3tools/client-runtime/connection";
import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resolveRemoteOpenState } from "./remoteOpen";
const environmentId = EnvironmentId.make("test");
describe("local editor targets", () => {
  it("opens local browser and desktop WSL environments", () => {
    expect(
      resolveRemoteOpenState({
        target: new PrimaryConnectionTarget({
          environmentId,
          label: "Local",
          httpBaseUrl: "http://localhost:3201",
          wsBaseUrl: "ws://localhost:3201",
        }),
        isDesktopRenderer: false,
      }),
    ).toEqual({ mode: "local-exec" });
    expect(
      resolveRemoteOpenState({
        target: new BearerConnectionTarget({
          environmentId,
          label: "WSL",
          connectionId: "local:wsl:Ubuntu",
        }),
        isDesktopRenderer: true,
      }),
    ).toEqual({ mode: "local-exec" });
  });
  it("does not open unresolved or legacy remote environments", () => {
    expect(resolveRemoteOpenState({ target: null, isDesktopRenderer: true })).toEqual({
      mode: "remote-unavailable",
    });
    expect(
      resolveRemoteOpenState({
        target: new RelayConnectionTarget({ environmentId, label: "Legacy" }),
        isDesktopRenderer: true,
      }),
    ).toEqual({ mode: "remote-unavailable" });
  });
});
