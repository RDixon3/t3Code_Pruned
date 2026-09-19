/**
 * Every preview keeps Electron's preload isolated from page JavaScript.
 * React inspection runs separately in the page world and returns plain data;
 * annotation UI and IPC stay in the isolated preload.
 */
export const PREVIEW_WEBVIEW_PREFERENCES =
  "contextIsolation=true,sandbox=true,nodeIntegration=false";
