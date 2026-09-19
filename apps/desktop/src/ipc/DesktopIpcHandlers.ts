import * as Effect from "effect/Effect";

import * as DesktopIpc from "./DesktopIpc.ts";
import { installJiraIpc } from "./methods/jira.ts";
import { installV0Ipc } from "./methods/v0.ts";
import { installServiceNowIpc } from "./methods/serviceNowConnection.ts";
import {
  checkServiceNowSdk,
  installServiceNowSdk,
  checkServiceNowSdkUpdates,
  updateServiceNowSdk,
  listServiceNowSdkProfiles,
  deleteServiceNowSdkProfile,
  addServiceNowSdkProfile,
  completeServiceNowSdkProfile,
  cancelServiceNowSdkProfile,
  addBasicServiceNowSdkProfile,
} from "./methods/serviceNowSdk.ts";
import { getClientSettings, setClientSettings } from "./methods/clientSettings.ts";
import {
  clearConnectionCatalog,
  getConnectionCatalog,
  setConnectionCatalog,
} from "./methods/connectionCatalog.ts";
import {
  checkForUpdate,
  downloadUpdate,
  getUpdateState,
  installUpdate,
  setUpdateChannel,
} from "./methods/updates.ts";
import {
  getAppBranding,
  getLocalEnvironmentBootstraps,
  getLocalEnvironmentBearerToken,
  getSystemLocale,
  getWindowFullscreenState,
  openExternal,
  openSystemSettings,
  probeRemoteEditors,
  pickFolder,
  pickProjectFavicon,
  pickThemeFiles,
  setTheme,
  showContextMenu,
} from "./methods/window.ts";
import {
  acknowledgeSnapShot,
  checkSnapShotShortcut,
  dismissSnapShotAnimation,
  getSnapShotState,
  setupSnapShot,
  listPendingSnapShots,
  readSnapShot,
  requestSnapShotPermissions,
  setSnapShotAnimationDestination,
  setSnapShotShortcutSuppressed,
} from "./methods/snapShot.ts";
import * as PreviewIpc from "./methods/preview.ts";
import * as AppActivationIpc from "./methods/appActivation.ts";
import { getWslState, setWslBackendEnabled, setWslDistro, setWslOnly } from "./methods/wsl.ts";
import { sdkAuth } from "../integrations/serviceNowSdkAuth.ts";

export const installDesktopIpcHandlers = Effect.fn("desktop.ipc.installHandlers")(function* () {
  const ipc = yield* DesktopIpc.DesktopIpc;
  yield* installJiraIpc();
  yield* installV0Ipc();
  yield* installServiceNowIpc();
  yield* ipc.handle(checkServiceNowSdk);
  yield* ipc.handle(listServiceNowSdkProfiles);
  yield* ipc.handle(deleteServiceNowSdkProfile);
  yield* ipc.handle(addServiceNowSdkProfile);
  yield* ipc.handle(completeServiceNowSdkProfile);
  yield* ipc.handle(cancelServiceNowSdkProfile);
  yield* ipc.handle(addBasicServiceNowSdkProfile);
  yield* Effect.addFinalizer(() => Effect.sync(() => sdkAuth.cancelAll()));
  yield* ipc.handle(installServiceNowSdk);
  yield* ipc.handle(checkServiceNowSdkUpdates);
  yield* ipc.handle(updateServiceNowSdk);
  yield* PreviewIpc.installPreviewEventForwarding();

  yield* ipc.handle(AppActivationIpc.setReady);
  yield* ipc.handle(AppActivationIpc.complete);

  yield* ipc.handleSync(getAppBranding);
  yield* ipc.handleSync(getSystemLocale);
  yield* ipc.handleSync(getWindowFullscreenState);
  yield* ipc.handleSync(getLocalEnvironmentBootstraps);
  yield* ipc.handle(getLocalEnvironmentBearerToken);

  yield* ipc.handle(getClientSettings);
  yield* ipc.handle(setClientSettings);
  yield* ipc.handle(getConnectionCatalog);
  yield* ipc.handle(getSnapShotState);
  yield* ipc.handle(setupSnapShot);
  yield* ipc.handle(requestSnapShotPermissions);
  yield* ipc.handle(checkSnapShotShortcut);
  yield* ipc.handle(setSnapShotShortcutSuppressed);
  yield* ipc.handle(listPendingSnapShots);
  yield* ipc.handle(readSnapShot);
  yield* ipc.handle(setSnapShotAnimationDestination);
  yield* ipc.handle(dismissSnapShotAnimation);
  yield* ipc.handle(acknowledgeSnapShot);
  yield* ipc.handle(setConnectionCatalog);
  yield* ipc.handle(clearConnectionCatalog);



  yield* ipc.handle(getWslState);
  yield* ipc.handle(setWslBackendEnabled);
  yield* ipc.handle(setWslDistro);
  yield* ipc.handle(setWslOnly);

  yield* ipc.handle(pickFolder);
  yield* ipc.handle(pickProjectFavicon);
  yield* ipc.handle(pickThemeFiles);
  yield* ipc.handle(setTheme);
  yield* ipc.handle(showContextMenu);
  yield* ipc.handle(openExternal);
  yield* ipc.handle(openSystemSettings);
  yield* ipc.handle(probeRemoteEditors);
  yield* ipc.handle(getUpdateState);
  yield* ipc.handle(setUpdateChannel);
  yield* ipc.handle(downloadUpdate);
  yield* ipc.handle(installUpdate);
  yield* ipc.handle(checkForUpdate);
  for (const previewMethod of PreviewIpc.methods) {
    yield* ipc.handle(previewMethod);
  }
});
