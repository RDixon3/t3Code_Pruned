import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { shouldOfferModelPickerSetup } from "./ModelPickerContent";

function entry(status: ServerProvider["status"], driver = "codex") {
  return deriveProviderInstanceEntries([
    {
      instanceId: ProviderInstanceId.make(`${driver}_work`),
      driver: ProviderDriverKind.make(driver),
      enabled: true,
      installed: true,
      version: null,
      status,
      auth: { status: "authenticated" },
      checkedAt: "2026-08-28T00:00:00.000Z",
      setup: { canAuthenticate: driver === "codex", canInstall: driver === "codex" },
      models: [],
      slashCommands: [],
      skills: [],
    },
  ])[0]!;
}

describe("shouldOfferModelPickerSetup", () => {
  const availableModel = { slug: "gemini-3.1-pro", name: "Gemini 3.1 Pro" };

  it("offers setup before an Codex account has models", () => {
    expect(shouldOfferModelPickerSetup(entry("error", "codex"), [])).toBe(true);
  });

  it("offers setup after sign-out even if a model remains cached", () => {
    const providerEntry = entry("ready", "codex");
    expect(
      shouldOfferModelPickerSetup(
        {
          ...providerEntry,
          snapshot: { ...providerEntry.snapshot, auth: { status: "unauthenticated" } },
        },
        [availableModel],
      ),
    ).toBe(true);
  });

  it("offers setup when the only model is an unavailable saved selection", () => {
    expect(
      shouldOfferModelPickerSetup(entry("ready", "codex"), [
        { ...availableModel, isUnavailable: true },
      ]),
    ).toBe(true);
  });

  it("does not offer setup for a ready account with available models", () => {
    expect(shouldOfferModelPickerSetup(entry("ready", "codex"), [availableModel])).toBe(false);
  });

  it("does not restore a disabled provider while its status snapshot is stale", () => {
    expect(shouldOfferModelPickerSetup({ ...entry("error", "codex"), enabled: false }, [])).toBe(
      false,
    );
  });

  it("keeps providers without integrated setup on their existing path", () => {
    expect(shouldOfferModelPickerSetup(entry("error", "cursor"), [])).toBe(false);
  });

  it("uses the environment's setup capability for other drivers", () => {
    const providerEntry = entry("error", "cursor");
    expect(
      shouldOfferModelPickerSetup(
        {
          ...providerEntry,
          snapshot: {
            ...providerEntry.snapshot,
            setup: { canAuthenticate: true, canInstall: false },
          },
        },
        [],
      ),
    ).toBe(true);
  });
});
