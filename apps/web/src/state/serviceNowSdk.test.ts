import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
const installed = { installed: true, version: "4.11.0", globalRoot: "/global" };
const available = { ...installed, latestVersion: "4.12.1", updateAvailable: true };

function bridge() {
  const value = {
    checkServiceNowSdk: vi.fn().mockResolvedValue(installed),
    checkServiceNowSdkUpdates: vi.fn().mockResolvedValue(available),
    updateServiceNowSdk: vi
      .fn()
      .mockResolvedValue({ ...available, version: "4.12.1", updateAvailable: false }),
  };
  vi.stubGlobal("window", { desktopBridge: value });
  return value;
}
describe("SDK update status", () => {
  it("checks once on launch even with multiple consumers and preserves results across remounts", async () => {
    const api = bridge();
    const state = await import("./serviceNowSdk");
    await Promise.all([state.checkServiceNowSdkOnLaunch(), state.checkServiceNowSdkOnLaunch()]);
    await state.checkServiceNowSdkOnLaunch();
    expect(api.checkServiceNowSdkUpdates).toHaveBeenCalledTimes(1);
    expect(state.useServiceNowSdk.getState()).toMatchObject({ status: available, busy: null });
    await state.runServiceNowSdk("checkingUpdates");
    expect(api.checkServiceNowSdkUpdates).toHaveBeenCalledTimes(2);
  });
  it("shares verified results and prevents duplicate updates from Settings and the popup", async () => {
    const api = bridge();
    const state = await import("./serviceNowSdk");
    await state.checkServiceNowSdkOnLaunch();
    await Promise.all([state.runServiceNowSdk("updating"), state.runServiceNowSdk("updating")]);
    expect(api.updateServiceNowSdk).toHaveBeenCalledTimes(1);
    expect(api.updateServiceNowSdk).toHaveBeenCalledWith({
      version: "4.12.1",
      globalRoot: "/global",
    });
    expect(state.useServiceNowSdk.getState().status).toMatchObject({
      version: "4.12.1",
      updateAvailable: false,
    });
  });
  it("retains errors and rechecks the installation after a failed update", async () => {
    const api = bridge();
    api.updateServiceNowSdk.mockRejectedValue(new Error("npm failed"));
    const state = await import("./serviceNowSdk");
    await state.checkServiceNowSdkOnLaunch();
    expect(await state.runServiceNowSdk("updating")).toBeNull();
    expect(state.useServiceNowSdk.getState()).toEqual({
      status: installed,
      error: "npm failed",
      busy: null,
    });
  });
  it("does not retry a failed launch check on navigation, but allows a manual retry", async () => {
    const api = bridge();
    api.checkServiceNowSdkUpdates.mockRejectedValueOnce(new Error("offline"));
    const state = await import("./serviceNowSdk");
    await state.checkServiceNowSdkOnLaunch();
    await state.checkServiceNowSdkOnLaunch();
    expect(api.checkServiceNowSdkUpdates).toHaveBeenCalledTimes(1);
    await state.runServiceNowSdk("checkingUpdates");
    expect(state.useServiceNowSdk.getState()).toMatchObject({ status: available, error: null });
  });
  it("does nothing in the web client without the desktop bridge", async () => {
    vi.stubGlobal("window", {});
    const state = await import("./serviceNowSdk");
    await state.checkServiceNowSdkOnLaunch();
    expect(await state.runServiceNowSdk("checkingUpdates")).toBeNull();
    expect(state.useServiceNowSdk.getState()).toEqual({ status: null, busy: null, error: null });
  });
});
