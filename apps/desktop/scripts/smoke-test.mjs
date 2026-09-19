import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { _electron } from "playwright-core";

const desktopDir = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const mainJs = NodePath.join(desktopDir, "dist-electron/main.cjs");
const FATAL_OUTPUT =
  /Cannot find module|MODULE_NOT_FOUND|Refused to execute|Uncaught (?:Error|TypeError|ReferenceError)|fatal startup/i;

/** Use a fresh home for Chromium, provider discovery, and the local server. */
export function makeSmokeEnvironment(root, inherited) {
  const keep =
    /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|SYSTEMDRIVE|OS|ALLUSERSPROFILE|PROGRAMDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMW6432|COMMONPROGRAMFILES(?:\(X86\))?|COMMONPROGRAMW6432|DRIVERDATA|COMPUTERNAME|USERNAME|USERDOMAIN|USERDOMAIN_ROAMINGPROFILE|LOGONSERVER|PROCESSOR_\w+|NUMBER_OF_PROCESSORS|LANG|LC_\w+|SHELL|TERM|CI)$/i;
  const environment = Object.fromEntries(
    Object.entries(inherited).filter(([name, value]) => keep.test(name) && value !== undefined),
  );
  const profile = NodePath.join(root, "home");
  return {
    ...environment,
    HOME: profile,
    TEMP: NodePath.join(root, "tmp"),
    TMP: NodePath.join(root, "tmp"),
    TMPDIR: NodePath.join(root, "tmp"),
    USERPROFILE: profile,
    APPDATA: NodePath.join(profile, "AppData", "Roaming"),
    LOCALAPPDATA: NodePath.join(profile, "AppData", "Local"),
    XDG_CONFIG_HOME: NodePath.join(profile, ".config"),
    XDG_DATA_HOME: NodePath.join(profile, ".local", "share"),
    T3CODE_HOME: NodePath.join(root, "state"),
    T3CODE_DISABLE_AUTO_UPDATE: "1",
    ELECTRON_ENABLE_LOGGING: "1",
  };
}

export function assertIsolatedUserData(root, userData) {
  const relative = NodePath.relative(root, userData);
  if (!relative || relative.startsWith("..") || NodePath.isAbsolute(relative)) {
    throw new Error("Desktop smoke test refused to use non-isolated user data.");
  }
}

/** A running process alone is not success: require a connected app and working IPC. */
export async function waitForDesktopReady(app, root, timeoutMs = 30_000) {
  let timer;
  let output = "";
  const pages = new Set();
  const child = app.process();
  const failure = Promise.withResolvers();
  // Listen before awaiting anything so an early clean exit cannot count as a pass.
  const onClose = () =>
    failure.reject(new Error("Desktop exited before startup verification completed."));
  const onError = (error) => failure.reject(error);
  const onOutput = (chunk) => {
    const text = chunk.toString();
    output = (output + text).slice(-20_000);
    if (FATAL_OUTPUT.test(output))
      failure.reject(new Error("Desktop logged a fatal startup error."));
  };
  const watchPage = (page) => {
    if (pages.has(page)) return;
    pages.add(page);
    page.on("pageerror", onError);
    page.on("crash", onClose);
  };
  app.on("close", onClose);
  app.on("window", watchPage);
  child.on("exit", onClose);
  child.on("error", onError);
  child.stdout?.on("data", onOutput);
  child.stderr?.on("data", onOutput);
  for (const page of app.windows()) watchPage(page);
  timer = setTimeout(
    () => failure.reject(new Error("Desktop startup verification timed out.")),
    timeoutMs,
  );
  const verify = async () => {
    if (child.exitCode !== null || child.signalCode !== null) onClose();
    const page = await app.firstWindow({ timeout: timeoutMs });
    watchPage(page);
    const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"));
    assertIsolatedUserData(root, userData);
    await page.waitForURL((url) => url.protocol === "t3code:" && url.hostname === "app", {
      timeout: timeoutMs,
    });
    await page
      .getByRole("heading", { name: "Set up this computer", exact: true })
      .waitFor({ timeout: timeoutMs });
    // This button is enabled only once the local environment's WebSocket is connected.
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .click({ trial: true, timeout: timeoutMs });
    const bridgeReady = await page.evaluate(async () => {
      if (typeof window.desktopBridge?.getClientSettings !== "function") return false;
      // A fresh profile validly returns null until it first saves settings.
      await window.desktopBridge.getClientSettings();
      return true;
    });
    if (!bridgeReady) throw new Error("Desktop preload IPC is unavailable.");
    const errors = await page.pageErrors();
    if (errors.length > 0) throw errors[0];
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("Desktop exited during startup verification.");
  };
  try {
    await Promise.race([verify(), failure.promise]);
  } catch (error) {
    if (output) console.error(output);
    throw error;
  } finally {
    clearTimeout(timer);
    app.off("close", onClose);
    app.off("window", watchPage);
    child.off("exit", onClose);
    child.off("error", onError);
    child.stdout?.off("data", onOutput);
    child.stderr?.off("data", onOutput);
    for (const page of pages) {
      page.off("pageerror", onError);
      page.off("crash", onClose);
    }
  }
}

export async function runDesktopSmokeTest() {
  // oxlint-disable-next-line t3code/no-global-process-runtime -- Standalone smoke runner has no Effect runtime.
  const platform = NodeOS.platform();
  if (platform !== "darwin" && platform !== "win32") {
    throw new Error("Desktop smoke testing supports Windows and macOS.");
  }
  await NodeFSP.access(mainJs);
  const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "coco-desktop-smoke-"));
  if (
    NodePath.dirname(root) !== NodeOS.tmpdir() ||
    !NodePath.basename(root).startsWith("coco-desktop-smoke-")
  ) {
    throw new Error("Refused smoke cleanup outside its temporary directory.");
  }
  let app;
  try {
    const env = makeSmokeEnvironment(root, process.env);
    for (const directory of [env.HOME, env.APPDATA, env.LOCALAPPDATA, env.T3CODE_HOME, env.TMP]) {
      await NodeFSP.mkdir(directory, { recursive: true });
    }
    // Launcher mode is selected at module load time; this smoke test always uses production assets.
    delete process.env.VITE_DEV_SERVER_URL;
    const { resolveElectronLaunchCommand } = await import("./electron-launcher.mjs");
    const command = resolveElectronLaunchCommand([mainJs]);
    app = await _electron.launch({
      executablePath: command.electronPath,
      args: command.args,
      cwd: desktopDir,
      env,
      timeout: 30_000,
    });
    await waitForDesktopReady(app, root);
    console.log("Desktop smoke test passed: production UI, local connection, and IPC are ready.");
  } finally {
    // Playwright closes only this captured Electron process tree, including its local backend.
    // Keep the isolated state if shutdown fails, rather than deleting files a process still uses.
    if (app) await app.close();
    await NodeFSP.rm(root, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  NodePath.resolve(process.argv[1]) === NodeURL.fileURLToPath(import.meta.url)
) {
  runDesktopSmokeTest().catch((error) => {
    console.error("Desktop smoke test failed:", error);
    process.exitCode = 1;
  });
}
