import * as NodeFSP from "node:fs/promises";
import * as NodeHttp from "node:http";
import * as NodeCrypto from "node:crypto";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { Rolldown } from "vite-plus/pack";
import { _electron } from "playwright-core";
import { makeSmokeEnvironment } from "./smoke-test.mjs";

const desktopDir = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const webRequire = NodeModule.createRequire(NodePath.join(desktopDir, "../web/package.json"));
const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "coco-preview-security-"));
if (
  NodePath.dirname(root) !== NodeOS.tmpdir() ||
  !NodePath.basename(root).startsWith("coco-preview-security-")
)
  throw new Error("Unexpected fixture directory");
let app;
let server;
let blockedServer;
try {
  const fixture = NodePath.join(root, "react-fixture.js");
  await NodeFSP.writeFile(
    fixture,
    `
    import React from ${JSON.stringify(webRequire.resolve("react"))};
    import {createRoot} from ${JSON.stringify(webRequire.resolve("react-dom/client"))};
    import {flushSync} from ${JSON.stringify(webRequire.resolve("react-dom"))};
    function VisionCard() {return React.createElement('button', {id:'vision-card',style:{position:'absolute',left:100,top:150,width:200,height:80}}, 'Vision card');}
    flushSync(() => createRoot(document.getElementById('root')).render(React.createElement(VisionCard)));
  `,
  );
  await Rolldown.build({
    input: fixture,
    platform: "browser",
    transform: { define: { "process.env.NODE_ENV": '"development"' } },
    output: { file: NodePath.join(root, "fixture.iife.js"), format: "iife" },
  });
  await Rolldown.build({
    input: NodePath.join(desktopDir, "scripts/fixtures/preview-security-main.ts"),
    platform: "node",
    external: ["electron"],
    output: { file: NodePath.join(root, "main.cjs"), format: "cjs" },
  });
  const preload = await NodeFSP.readFile(
    NodePath.join(desktopDir, "dist-electron/preview-pick-preload.cjs"),
    "utf8",
  );
  // Keep the shipped preload intact; append a test-only caller from its isolated world.
  await NodeFSP.writeFile(
    NodePath.join(root, "preview-pick-preload.cjs"),
    preload +
      `
    ;require('electron').ipcRenderer.invoke('security-test:privileged').then(
      () => require('electron').ipcRenderer.send('security-test:preload-result',{denied:false,isolated:process.contextIsolated}),
      () => require('electron').ipcRenderer.send('security-test:preload-result',{denied:true,isolated:process.contextIsolated}));
  `,
  );
  await NodeFSP.copyFile(
    NodePath.join(desktopDir, "dist-electron/preview-element-context.iife.js"),
    NodePath.join(root, "preview-element-context.iife.js"),
  );
  if (process.argv.includes("--build-only")) {
    console.log("Hidden Electron regression fixture compiled successfully.");
  } else {
    const script = await NodeFSP.readFile(NodePath.join(root, "fixture.iife.js"));
    server = NodeHttp.createServer((request, response) => {
      response.setHeader("access-control-allow-origin", "*");
      if (request.url === "/fixture.js") {
        response.writeHead(200, { "content-type": "application/javascript" });
        response.end(script);
      } else if (request.url === "/report.pdf") {
        response.writeHead(200, { "content-type": "application/pdf" });
        response.end("%PDF-1.4\n%%EOF");
      } else {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(
          '<!doctype html><html><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
        );
      }
    });
    server.on("upgrade", (request, socket) => {
      const accept = NodeCrypto.createHash("sha1")
        .update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");
      socket.end(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    blockedServer = NodeHttp.createServer((_request, response) => {
      response.setHeader("access-control-allow-origin", "*");
      response.end("Unrelated service");
    });
    await new Promise((resolve, reject) => {
      blockedServer.once("error", reject);
      blockedServer.listen(0, "127.0.0.1", resolve);
    });
    const env = {
      ...makeSmokeEnvironment(root, process.env),
      COCO_PREVIEW_SECURITY_ROOT: root,
      COCO_PREVIEW_SECURITY_URL: `http://127.0.0.1:${address.port}`,
      COCO_PREVIEW_BLOCKED_URL: `http://127.0.0.1:${blockedServer.address().port}`,
    };
    for (const directory of [env.HOME, env.APPDATA, env.LOCALAPPDATA, env.T3CODE_HOME, env.TMP])
      await NodeFSP.mkdir(directory, { recursive: true });
    delete process.env.VITE_DEV_SERVER_URL;
    const { resolveElectronLaunchCommand } = await import("./electron-launcher.mjs");
    const command = resolveElectronLaunchCommand([NodePath.join(root, "main.cjs")]);
    app = await _electron.launch({
      executablePath: command.electronPath,
      args: command.args,
      cwd: desktopDir,
      env,
      timeout: 30_000,
    });
    const results = await app.evaluate(async () => globalThis.runPreviewSecurityRegression());
    console.log(`Hidden Electron regression passed: ${results.join(", ")}.`);
  }
} finally {
  if (app) await app.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (blockedServer) await new Promise((resolve) => blockedServer.close(resolve));
  await NodeFSP.rm(root, { recursive: true, force: true });
}
