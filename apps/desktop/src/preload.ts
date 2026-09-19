import type {
  DesktopBridge,
  DesktopPreviewPointerEvent,
  DesktopPreviewRecordingFrame,
  DesktopPreviewTabState,
  DesktopSnapShotEvent,
} from "@t3tools/contracts";
import { contextBridge, ipcRenderer } from "electron";

import * as IpcChannels from "./ipc/channels.ts";

const SNAP_SHOT_EVENT_TYPES = new Set([
  "requested",
  "started",
  "ready",
  "failed",
  "shortcut-changed",
]);
function isSnapShotEvent(value: unknown): value is DesktopSnapShotEvent {
  if (typeof value !== "object" || value === null) return false;
  const { type, id } = value as { type?: unknown; id?: unknown };
  return (
    typeof type === "string" &&
    SNAP_SHOT_EVENT_TYPES.has(type) &&
    (id === undefined || typeof id === "string")
  );
}


// oxlint-disable-next-line t3code/no-global-process-runtime -- Electron exposes the client platform in its sandboxed preload process.
const clientPlatform = process.platform;

contextBridge.exposeInMainWorld("desktopBridge", {
  listV0AgentTools: () => ipcRenderer.invoke(IpcChannels.V0_AGENT_TOOLS_CHANNEL),
  callV0AgentTool: (input) => ipcRenderer.invoke(IpcChannels.V0_AGENT_CALL_CHANNEL, input),
  getV0ConnectionStatus: () => ipcRenderer.invoke(IpcChannels.V0_STATUS_CHANNEL),
  connectV0: () => ipcRenderer.invoke(IpcChannels.V0_CONNECT_CHANNEL),
  testV0Connection: () => ipcRenderer.invoke(IpcChannels.V0_TEST_CHANNEL),
  cancelV0Connection: () => ipcRenderer.invoke(IpcChannels.V0_CANCEL_CHANNEL),
  disconnectV0: () => ipcRenderer.invoke(IpcChannels.V0_DISCONNECT_CHANNEL),
  onV0ConnectionChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.V0_CHANGED_CHANNEL, handler);
    return () => ipcRenderer.removeListener(IpcChannels.V0_CHANGED_CHANNEL, handler);
  },
  deleteServiceNowSdkProfile: (profile) =>
    ipcRenderer.invoke(IpcChannels.DELETE_SERVICENOW_SDK_PROFILE_CHANNEL, profile),
  addBasicServiceNowSdkProfile: (input) =>
    ipcRenderer.invoke(IpcChannels.ADD_BASIC_SERVICENOW_SDK_PROFILE_CHANNEL, input),
  completeServiceNowSdkProfile: (input) =>
    ipcRenderer.invoke(IpcChannels.COMPLETE_SERVICENOW_SDK_PROFILE_CHANNEL, input),
  cancelServiceNowSdkProfile: () =>
    ipcRenderer.invoke(IpcChannels.CANCEL_SERVICENOW_SDK_PROFILE_CHANNEL),
  addServiceNowSdkProfile: (profile) =>
    ipcRenderer.invoke(IpcChannels.ADD_SERVICENOW_SDK_PROFILE_CHANNEL, profile),
  checkServiceNowSdk: () => ipcRenderer.invoke(IpcChannels.CHECK_SERVICENOW_SDK_CHANNEL),
  listServiceNowSdkProfiles: () =>
    ipcRenderer.invoke(IpcChannels.LIST_SERVICENOW_SDK_PROFILES_CHANNEL),
  getJiraConnectionStatus: () => ipcRenderer.invoke(IpcChannels.JIRA_STATUS_CHANNEL),
  getServiceNowConnectionStatus: () => ipcRenderer.invoke(IpcChannels.SERVICENOW_STATUS_CHANNEL),
  connectServiceNow: (config) => ipcRenderer.invoke(IpcChannels.SERVICENOW_CONNECT_CHANNEL, config),
  testServiceNowConnection: () => ipcRenderer.invoke(IpcChannels.SERVICENOW_TEST_CHANNEL),
  disconnectServiceNow: () => ipcRenderer.invoke(IpcChannels.SERVICENOW_DISCONNECT_CHANNEL),
  connectJira: () => ipcRenderer.invoke(IpcChannels.JIRA_CONNECT_CHANNEL),
  testJiraConnection: () => ipcRenderer.invoke(IpcChannels.JIRA_TEST_CHANNEL),
  listJiraAgentTools: () => ipcRenderer.invoke(IpcChannels.JIRA_AGENT_TOOLS_CHANNEL),
  callJiraAgentTool: (input) => ipcRenderer.invoke(IpcChannels.JIRA_AGENT_CALL_CHANNEL, input),
  onJiraConnectionChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(IpcChannels.JIRA_CHANGED_CHANNEL, handler);
    return () => ipcRenderer.removeListener(IpcChannels.JIRA_CHANGED_CHANNEL, handler);
  },
  listJiraSites: () => ipcRenderer.invoke(IpcChannels.JIRA_SITES_CHANNEL),
  listJiraProjects: (input) => ipcRenderer.invoke(IpcChannels.JIRA_PROJECTS_CHANNEL, input),
  listJiraIssues: (input) => ipcRenderer.invoke(IpcChannels.JIRA_ISSUES_CHANNEL, input),
  getJiraTransitions: (input) => ipcRenderer.invoke(IpcChannels.JIRA_TRANSITIONS_CHANNEL, input),
  transitionJiraIssue: (input) => ipcRenderer.invoke(IpcChannels.JIRA_TRANSITION_CHANNEL, input),
  disconnectJira: () => ipcRenderer.invoke(IpcChannels.JIRA_DISCONNECT_CHANNEL),
  checkServiceNowSdkUpdates: () =>
    ipcRenderer.invoke(IpcChannels.CHECK_SERVICENOW_SDK_UPDATES_CHANNEL),
  updateServiceNowSdk: (input) =>
    ipcRenderer.invoke(IpcChannels.UPDATE_SERVICENOW_SDK_CHANNEL, input),
  installServiceNowSdk: () => ipcRenderer.invoke(IpcChannels.INSTALL_SERVICENOW_SDK_CHANNEL),
  getAppBranding: () => {
    const result = ipcRenderer.sendSync(IpcChannels.GET_APP_BRANDING_CHANNEL);
    if (typeof result !== "object" || result === null) {
      return null;
    }
    return result as ReturnType<DesktopBridge["getAppBranding"]>;
  },
  getClientPlatform: () => clientPlatform,
  getSystemLocale: () => {
    const result = ipcRenderer.sendSync(IpcChannels.GET_SYSTEM_LOCALE_CHANNEL);
    return typeof result === "string" ? result : null;
  },
  getLocalEnvironmentBootstraps: () => {
    const result = ipcRenderer.sendSync(IpcChannels.GET_LOCAL_ENVIRONMENT_BOOTSTRAPS_CHANNEL);
    if (!Array.isArray(result)) {
      return [];
    }
    return result as ReturnType<DesktopBridge["getLocalEnvironmentBootstraps"]>;
  },
  getLocalEnvironmentBearerToken: () =>
    ipcRenderer.invoke(IpcChannels.GET_LOCAL_ENVIRONMENT_BEARER_TOKEN_CHANNEL),
  getClientSettings: () => ipcRenderer.invoke(IpcChannels.GET_CLIENT_SETTINGS_CHANNEL),
  setClientSettings: (settings) =>
    ipcRenderer.invoke(IpcChannels.SET_CLIENT_SETTINGS_CHANNEL, settings),
  requestSnapShotPermissions: (includeAccessibility) =>
    ipcRenderer.invoke(IpcChannels.REQUEST_SNAP_SHOT_PERMISSIONS_CHANNEL, includeAccessibility),
  getSnapShotState: () => ipcRenderer.invoke(IpcChannels.GET_SNAP_SHOT_STATE_CHANNEL),
  setupSnapShot: (action) => ipcRenderer.invoke(IpcChannels.SETUP_SNAP_SHOT_CHANNEL, action),
  checkSnapShotShortcut: (shortcut) =>
    ipcRenderer.invoke(IpcChannels.CHECK_SNAP_SHOT_SHORTCUT_CHANNEL, shortcut),
  setSnapShotShortcutSuppressed: (suppressed) =>
    ipcRenderer.invoke(IpcChannels.SET_SNAP_SHOT_SHORTCUT_SUPPRESSED_CHANNEL, suppressed),
  listPendingSnapShots: () => ipcRenderer.invoke(IpcChannels.LIST_PENDING_SNAP_SHOTS_CHANNEL),
  readSnapShot: (id) => ipcRenderer.invoke(IpcChannels.READ_SNAP_SHOT_CHANNEL, id),
  setSnapShotAnimationDestination: (destination) =>
    ipcRenderer.invoke(IpcChannels.SET_SNAP_SHOT_ANIMATION_DESTINATION_CHANNEL, destination),
  dismissSnapShotAnimation: (id) =>
    ipcRenderer.invoke(IpcChannels.DISMISS_SNAP_SHOT_ANIMATION_CHANNEL, id),
  acknowledgeSnapShot: (id) => ipcRenderer.invoke(IpcChannels.ACKNOWLEDGE_SNAP_SHOT_CHANNEL, id),
  getConnectionCatalog: () => ipcRenderer.invoke(IpcChannels.GET_CONNECTION_CATALOG_CHANNEL),
  setConnectionCatalog: (catalog) =>
    ipcRenderer.invoke(IpcChannels.SET_CONNECTION_CATALOG_CHANNEL, catalog),
  clearConnectionCatalog: () => ipcRenderer.invoke(IpcChannels.CLEAR_CONNECTION_CATALOG_CHANNEL),
  getWslState: () => ipcRenderer.invoke(IpcChannels.GET_WSL_STATE_CHANNEL),
  setWslBackendEnabled: (enabled) =>
    ipcRenderer.invoke(IpcChannels.SET_WSL_BACKEND_ENABLED_CHANNEL, enabled),
  setWslDistro: (distro) => ipcRenderer.invoke(IpcChannels.SET_WSL_DISTRO_CHANNEL, distro),
  setWslOnly: (enabled) => ipcRenderer.invoke(IpcChannels.SET_WSL_ONLY_CHANNEL, enabled),
  pickFolder: (options) => ipcRenderer.invoke(IpcChannels.PICK_FOLDER_CHANNEL, options),
  pickProjectFavicon: (initialPath) =>
    ipcRenderer.invoke(IpcChannels.PICK_PROJECT_FAVICON_CHANNEL, initialPath),
  pickThemeFiles: () => ipcRenderer.invoke(IpcChannels.PICK_THEME_FILES_CHANNEL, undefined),
  setTheme: (theme) => ipcRenderer.invoke(IpcChannels.SET_THEME_CHANNEL, theme),
  showContextMenu: (items, position) =>
    ipcRenderer.invoke(IpcChannels.CONTEXT_MENU_CHANNEL, {
      items,
      ...(position === undefined ? {} : { position }),
    }),
  openExternal: (url: string) => ipcRenderer.invoke(IpcChannels.OPEN_EXTERNAL_CHANNEL, url),
  openSystemSettings: (pane: string) =>
    ipcRenderer.invoke(IpcChannels.OPEN_SYSTEM_SETTINGS_CHANNEL, pane),
  probeRemoteEditors: () => ipcRenderer.invoke(IpcChannels.PROBE_REMOTE_EDITORS_CHANNEL, undefined),
  onMenuAction: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, action: unknown) => {
      if (typeof action !== "string") return;
      listener(action);
    };

    ipcRenderer.on(IpcChannels.MENU_ACTION_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.MENU_ACTION_CHANNEL, wrappedListener);
    };
  },
  onSnapShotEvent: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, event: unknown) => {
      if (!isSnapShotEvent(event)) return;
      listener(event);
    };

    ipcRenderer.on(IpcChannels.SNAP_SHOT_EVENT_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.SNAP_SHOT_EVENT_CHANNEL, wrappedListener);
    };
  },
  onQuitShortcut: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, hint: unknown) => {
      if (typeof hint !== "object" || hint === null || !("state" in hint)) return;
      if (hint.state === "up") {
        listener({ state: "up" });
        return;
      }
      if (
        hint.state === "down" &&
        "mode" in hint &&
        (hint.mode === "hold" || hint.mode === "double-click")
      ) {
        listener({ state: "down", mode: hint.mode });
      }
    };

    ipcRenderer.on(IpcChannels.QUIT_SHORTCUT_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.QUIT_SHORTCUT_CHANNEL, wrappedListener);
    };
  },
  getWindowFullscreenState: () =>
    ipcRenderer.sendSync(IpcChannels.GET_WINDOW_FULLSCREEN_STATE_CHANNEL) === true,
  onWindowFullscreenStateChange: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, fullscreen: unknown) => {
      if (typeof fullscreen !== "boolean") return;
      listener(fullscreen);
    };

    ipcRenderer.on(IpcChannels.WINDOW_FULLSCREEN_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.WINDOW_FULLSCREEN_STATE_CHANNEL, wrappedListener);
    };
  },
  getUpdateState: () => ipcRenderer.invoke(IpcChannels.UPDATE_GET_STATE_CHANNEL),
  setUpdateChannel: (channel) =>
    ipcRenderer.invoke(IpcChannels.UPDATE_SET_CHANNEL_CHANNEL, channel),
  checkForUpdate: () => ipcRenderer.invoke(IpcChannels.UPDATE_CHECK_CHANNEL),
  downloadUpdate: () => ipcRenderer.invoke(IpcChannels.UPDATE_DOWNLOAD_CHANNEL),
  installUpdate: () => ipcRenderer.invoke(IpcChannels.UPDATE_INSTALL_CHANNEL),
  onUpdateState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(IpcChannels.UPDATE_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.UPDATE_STATE_CHANNEL, wrappedListener);
    };
  },
  appActivation: {
    setReady: (ready) =>
      ipcRenderer.invoke(IpcChannels.DESKTOP_APP_ACTIVATION_READY_CHANNEL, ready),
    complete: (response) =>
      ipcRenderer.invoke(IpcChannels.DESKTOP_APP_ACTIVATION_COMPLETE_CHANNEL, response),
    onRequest: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, request: unknown) => {
        if (typeof request !== "object" || request === null) return;
        listener(request as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(IpcChannels.DESKTOP_APP_ACTIVATION_REQUEST_CHANNEL, wrappedListener);
      return () => {
        ipcRenderer.removeListener(
          IpcChannels.DESKTOP_APP_ACTIVATION_REQUEST_CHANNEL,
          wrappedListener,
        );
      };
    },
  },
  preview: {
    createTab: (tabId, defaults) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_CREATE_TAB_CHANNEL, {
        tabId,
        zoomFactor: defaults?.zoomFactor,
        colorScheme: defaults?.colorScheme,
      }),
    closeTab: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_CLOSE_TAB_CHANNEL, { tabId }),
    registerWebview: (tabId, webContentsId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_REGISTER_WEBVIEW_CHANNEL, { tabId, webContentsId }),
    navigate: (tabId, url) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_NAVIGATE_CHANNEL, { tabId, url }),
    goBack: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_GO_BACK_CHANNEL, { tabId }),
    goForward: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_GO_FORWARD_CHANNEL, { tabId }),
    refresh: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_REFRESH_CHANNEL, { tabId }),
    zoomIn: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_ZOOM_IN_CHANNEL, { tabId }),
    zoomOut: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_ZOOM_OUT_CHANNEL, { tabId }),
    resetZoom: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_RESET_ZOOM_CHANNEL, { tabId }),
    hardReload: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_HARD_RELOAD_CHANNEL, { tabId }),
    setColorScheme: (tabId, colorScheme) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_SET_COLOR_SCHEME_CHANNEL, { tabId, colorScheme }),
    setAudioMuted: (tabId, audioMuted) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_SET_AUDIO_MUTED_CHANNEL, { tabId, audioMuted }),
    openDevTools: (tabId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_OPEN_DEVTOOLS_CHANNEL, { tabId }),
    clearCookies: (environmentId, profileId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_CLEAR_COOKIES_CHANNEL, { environmentId, profileId }),
    clearCache: (environmentId, profileId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_CLEAR_CACHE_CHANNEL, { environmentId, profileId }),
    getPreviewConfig: (environmentId, profileId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_GET_CONFIG_CHANNEL, { environmentId, profileId }),
    setAnnotationTheme: (theme) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_SET_ANNOTATION_THEME_CHANNEL, { theme }),
    pickElement: (tabId) => ipcRenderer.invoke(IpcChannels.PREVIEW_PICK_ELEMENT_CHANNEL, { tabId }),
    cancelPickElement: (tabId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_CANCEL_PICK_ELEMENT_CHANNEL, { tabId }),
    captureScreenshot: (tabId) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_CAPTURE_SCREENSHOT_CHANNEL, { tabId }),
    revealArtifact: (path) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_REVEAL_ARTIFACT_CHANNEL, { path }),
    copyArtifactToClipboard: (path) =>
      ipcRenderer.invoke(IpcChannels.PREVIEW_COPY_ARTIFACT_CHANNEL, { path }),
    pictureInPicture: {
      open: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_PICTURE_IN_PICTURE_OPEN_CHANNEL, { tabId }),
      close: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_PICTURE_IN_PICTURE_CLOSE_CHANNEL, { tabId }),
    },
    recording: {
      startScreencast: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_RECORDING_START_CHANNEL, { tabId }),
      stopScreencast: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_RECORDING_STOP_CHANNEL, { tabId }),
      save: (tabId, mimeType, data) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_RECORDING_SAVE_CHANNEL, {
          tabId,
          mimeType,
          data,
        }),
      onFrame: (listener) => {
        const wrappedListener = (_event: Electron.IpcRendererEvent, frame: unknown) => {
          if (typeof frame !== "object" || frame === null) return;
          listener(frame as DesktopPreviewRecordingFrame);
        };
        ipcRenderer.on(IpcChannels.PREVIEW_RECORDING_FRAME_CHANNEL, wrappedListener);
        return () =>
          ipcRenderer.removeListener(IpcChannels.PREVIEW_RECORDING_FRAME_CHANNEL, wrappedListener);
      },
    },
    automation: {
      status: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_STATUS_CHANNEL, { tabId }),
      snapshot: (tabId) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_SNAPSHOT_CHANNEL, { tabId }),
      click: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_CLICK_CHANNEL, { tabId, input }),
      type: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_TYPE_CHANNEL, { tabId, input }),
      press: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_PRESS_CHANNEL, { tabId, input }),
      scroll: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_SCROLL_CHANNEL, { tabId, input }),
      evaluate: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_EVALUATE_CHANNEL, { tabId, input }),
      waitFor: (tabId, input) =>
        ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_WAIT_FOR_CHANNEL, { tabId, input }),
    },
    onStateChange: (listener) => {
      const wrappedListener = (
        _event: Electron.IpcRendererEvent,
        tabId: unknown,
        state: unknown,
      ) => {
        if (typeof tabId !== "string" || typeof state !== "object" || state === null) return;
        listener(tabId, state as DesktopPreviewTabState);
      };
      ipcRenderer.on(IpcChannels.PREVIEW_STATE_CHANGE_CHANNEL, wrappedListener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.PREVIEW_STATE_CHANGE_CHANNEL, wrappedListener);
    },
    onPointerEvent: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, pointerEvent: unknown) => {
        if (typeof pointerEvent !== "object" || pointerEvent === null) return;
        listener(pointerEvent as DesktopPreviewPointerEvent);
      };
      ipcRenderer.on(IpcChannels.PREVIEW_POINTER_EVENT_CHANNEL, wrappedListener);
      return () =>
        ipcRenderer.removeListener(IpcChannels.PREVIEW_POINTER_EVENT_CHANNEL, wrappedListener);
    },
  },
} satisfies DesktopBridge);
