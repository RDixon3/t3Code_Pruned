import { DEFAULT_CLIENT_SETTINGS, type DesktopSnapShotState } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import {
  captureSetupAccessReady,
  captureSetupInitialStep,
  captureSetupMacPermissionsReady,
  captureSetupShortcutReady,
  captureSetupShouldDisableOnClose,
} from "./SnapShotSetupDialog.logic";

const native: DesktopSnapShotState = {
  mode: "direct",

  shortcut: DEFAULT_CLIENT_SETTINGS.snapShotShortcut,
  shortcutRegistered: true,
  shortcutMessage: "Requested",
  shortcutVerified: false,
  message: null,
};

it("finishes setup with a saved shortcut without requiring a separate delivery test", () => {
  expect(captureSetupInitialStep({ ...native, shortcutVerified: false })).toBe("shortcut");
  expect(captureSetupShortcutReady(native, false)).toBe(true);
});

it("still allows revisiting capture access and editing a saved shortcut", () => {
  expect(captureSetupInitialStep(native, "access")).toBe("access");
  expect(captureSetupInitialStep(native, "shortcut")).toBe("shortcut");
});

it("does not skip native permission setup when capture has not been enabled", () => {
  expect(
    captureSetupInitialStep({
      ...native,
      mode: "direct",

      shortcutRegistered: false,
    }),
  ).toBe("access");
});

it("requires saving a changed chord before finishing setup", () => {
  expect(captureSetupShortcutReady(native, true)).toBe(false);
  expect(captureSetupShortcutReady(native, false)).toBe(true);
  expect(captureSetupShortcutReady({ ...native, shortcutRegistered: false }, false)).toBe(false);
});

it.each([false, true])(
  "does not require a previously observed shortcut activation (%s)",
  (shortcutVerified) => {
    const state = { ...native, shortcutVerified };
    expect(captureSetupShortcutReady(state, false)).toBe(true);
    expect(captureSetupInitialStep(state)).toBe("shortcut");
  },
);

it("blocks finishing if desktop access is lost during the wizard", () => {
  expect(
    captureSetupShortcutReady(
      {
        ...native,
        shortcutVerified: true,
        message: "Desktop disconnected",
      },
      false,
    ),
  ).toBe(false);
  expect(captureSetupAccessReady({ ...native, mode: "unavailable" })).toBe(false);
});

it.each([
  [false, false, true],
  [false, true, false],
  [true, false, false],
  [true, true, false],
] as const)(
  "closing setup (previously enabled=%s, completed=%s) disables only an unfinished first opt-in",
  (wasEnabled, completed, disable) => {
    expect(captureSetupShouldDisableOnClose(wasEnabled, completed)).toBe(disable);
  },
);

it("gates Continue on macOS permissions, requiring accessibility only when app text is on", () => {
  const mac: DesktopSnapShotState = {
    ...native,
    mode: "direct",

    macPermissions: { screenRecording: true, accessibility: false },
  };
  expect(captureSetupMacPermissionsReady(mac, true)).toBe(false);
  expect(captureSetupMacPermissionsReady(mac, false)).toBe(true);
  expect(
    captureSetupMacPermissionsReady(
      { ...mac, macPermissions: { screenRecording: false, accessibility: true } },
      false,
    ),
  ).toBe(false);
  expect(captureSetupMacPermissionsReady({ ...mac, macPermissions: undefined }, true)).toBe(true);
});
