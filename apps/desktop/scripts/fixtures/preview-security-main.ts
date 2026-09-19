// Hidden, disposable Electron integration fixture. Never loads the user's app state.
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ElectronProtocol from "../../src/electron/ElectronProtocol.ts";
import * as DesktopIpc from "../../src/ipc/DesktopIpc.ts";
import * as BrowserSession from "../../src/preview/BrowserSession.ts";
import { makeElementContextHandler } from "../../src/preview/ElementContextCapture.ts";
import {
  ELEMENT_CONTEXT_CHANNEL,
  ELEMENT_PICKED_CHANNEL,
  START_PICK_CHANNEL,
} from "../../src/preview/GuestProtocol.ts";
import type { PreviewAnnotationPayload } from "@t3tools/contracts";

const root = process.env.COCO_PREVIEW_SECURITY_ROOT!;
const fixtureUrl = process.env.COCO_PREVIEW_SECURITY_URL!;
const blockedUrl = process.env.COCO_PREVIEW_BLOCKED_URL!;
Electron.app.setPath("userData", NodePath.join(root, "electron"));
// The runner owns shutdown after collecting the result, including failure cleanup.
Electron.app.on("window-all-closed", () => {});
Effect.runSync(Effect.scoped(Layer.build(ElectronProtocol.layerSchemePrivileges)));

function within<T>(promise: Promise<T>, description: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), 10_000);
    }),
  ]).finally(() => clearTimeout(timer));
}

type DomNode = {
  nodeId: number;
  attributes?: string[];
  children?: DomNode[];
  shadowRoots?: DomNode[];
};
function attachButton(node: DomNode): DomNode | undefined {
  if (node.attributes?.includes("Attach annotation and screenshot (Enter)")) return node;
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
    const found = attachButton(child);
    if (found) return found;
  }
}

declare global {
  var runPreviewSecurityRegression: () => Promise<string[]>;
}
globalThis.runPreviewSecurityRegression = async () => {
  await Electron.app.whenReady();
  const runtime = await NodeFSP.readFile(
    NodePath.join(root, "preview-element-context.iife.js"),
    "utf8",
  );
  const browserSessions = await Effect.runPromise(
    BrowserSession.make.pipe(Effect.provide(NodeCrypto.layer)),
  );
  const previewSession = await Effect.runPromise(
    browserSessions.getSession("security-regression", false),
  );
  const preview = new Electron.BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      session: previewSession,
      preload: NodePath.join(root, "preview-pick-preload.cjs"),
    },
  });
  const wc = preview.webContents;
  const appWindow = new Electron.BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const preloadProbe = Promise.withResolvers<{ denied: boolean; isolated: boolean }>();
  const picked = Promise.withResolvers<PreviewAnnotationPayload>();
  wc.ipc.once("security-test:preload-result", (_event, result) => preloadProbe.resolve(result));
  wc.ipc.once(ELEMENT_PICKED_CHANNEL, (_event, payload) => picked.resolve(payload));
  wc.ipc.handle(
    ELEMENT_CONTEXT_CHANNEL,
    makeElementContextHandler(wc, async () => runtime),
  );
  let privilegedCalls = 0;
  const errors: string[] = [];
  wc.on("preload-error", (_event, _path, error) => errors.push(error.message));
  wc.on("console-message", (details) => {
    if (details.level === "error") errors.push(details.message);
  });
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* DesktopIpc.make(Electron.ipcMain).handle(
            DesktopIpc.makeIpcMethod({
              channel: "security-test:privileged",
              payload: Schema.Void,
              result: Schema.Void,
              handler: () =>
                Effect.sync(() => {
                  privilegedCalls++;
                }),
            }),
          );
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL(fixtureUrl),
            backendOrigin: new URL(fixtureUrl),
            resolveBackends: Effect.succeed({
              primaryOrigin: new URL(fixtureUrl),
              backendOrigins: [new URL(fixtureUrl)],
            }),
          });
          yield* Effect.promise(async () => {
            await preview.loadURL(fixtureUrl);
            NodeAssert.deepEqual(await within(preloadProbe.promise, "preload isolation probe"), {
              denied: true,
              isolated: true,
            });
            NodeAssert.equal(privilegedCalls, 0);
            NodeAssert.deepEqual(
              await wc.executeJavaScript(
                `({ require: typeof require, process: typeof process, bridge: typeof desktopBridge })`,
              ),
              { require: "undefined", process: "undefined", bridge: "undefined" },
            );
            NodeAssert.equal(
              await wc.executeJavaScript(`document.querySelector('#vision-card')?.textContent`),
              "Vision card",
            );
            const permissions = await wc.executeJavaScript(
              `Promise.all([
          Notification.requestPermission(),
          navigator.clipboard.readText().then(() => 'granted', () => 'denied'),
          new Promise(resolve => navigator.geolocation.getCurrentPosition(() => resolve('granted'), error => resolve(error.code === 1 ? 'denied' : 'unexpected'), {timeout:3000}))
        ])`,
              true,
            );
            NodeAssert.deepEqual(permissions, ["denied", "denied", "denied"]);
            await appWindow.loadURL("t3code://app/");
            const rendererNetwork = await within(
              appWindow.webContents.executeJavaScript(`Promise.all([
                fetch(${JSON.stringify(fixtureUrl)}).then(response => response.ok, () => false),
                fetch(${JSON.stringify(blockedUrl)}).then(response => response.ok, () => false),
                ...[${JSON.stringify(fixtureUrl.replace(/^http/, "ws"))}, ${JSON.stringify(blockedUrl.replace(/^http/, "ws"))}].map(url => new Promise(resolve => {
                  const socket = new WebSocket(url);
                  socket.onopen = () => {resolve(true); socket.close();};
                  socket.onerror = () => resolve(false);
                }))
              ])`),
              "app renderer endpoint boundary",
            );
            NodeAssert.deepEqual(rendererNetwork, [true, false, true, false]);
            NodeAssert.equal(
              (await Electron.net.fetch(blockedUrl)).ok,
              true,
              "Main-process integrations must remain outside the renderer endpoint policy",
            );
            wc.send(START_PICK_CHANNEL);
            await within(
              wc.executeJavaScript(`new Promise(resolve => {
          const ready = () => document.querySelector('[data-t3code-annotation-ui]');
          if (ready()) return resolve(true);
          const observer = new MutationObserver(() => { if (ready()) {observer.disconnect(); resolve(true);} });
          observer.observe(document.documentElement, {childList:true, subtree:true});
        })`),
              "annotation overlay",
            );
            await wc.executeJavaScript(`(() => { const target=document.querySelector('#vision-card'), rect=target.getBoundingClientRect();
          target.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, button:0, clientX:rect.x+10, clientY:rect.y+10})); })()`);
            // CDP can inspect the closed annotation shadow root; no native mouse/keyboard input.
            wc.debugger.attach("1.3");
            const document = await wc.debugger.sendCommand("DOM.getDocument", {
              depth: -1,
              pierce: true,
            });
            const button = attachButton(document.root);
            NodeAssert.ok(button, "Annotation Attach control should exist");
            const resolved = await wc.debugger.sendCommand("DOM.resolveNode", {
              nodeId: button.nodeId,
            });
            await wc.debugger.sendCommand("Runtime.callFunctionOn", {
              objectId: resolved.object.objectId,
              functionDeclaration: "function(){this.click()}",
            });
            const annotation = await within(picked.promise, "React annotation metadata");
            NodeAssert.equal(annotation.elements.length, 1);
            NodeAssert.equal(
              annotation.elements[0]?.element.componentName,
              "VisionCard",
              JSON.stringify({
                context: annotation.elements[0]?.element,
                reactKeys: await wc.executeJavaScript(
                  "Object.keys(document.querySelector('#vision-card')).filter(key => key.includes('react'))",
                ),
              }),
            );
            NodeAssert.match(annotation.elements[0]!.element.selector ?? "", /vision-card/);
            NodeAssert.match(annotation.elements[0]!.element.htmlPreview, /Vision card/);
            NodeAssert.ok(
              annotation.elements[0]!.element.stack.length > 0,
              "React source context should survive isolation",
            );
            const pdf = await Electron.net.fetch("t3code://app/report.pdf");
            NodeAssert.equal(pdf.headers.get("content-type"), "application/pdf");
            NodeAssert.equal(
              pdf.headers.get("content-security-policy"),
              null,
              "Native PDF viewer must not inherit the app's object-src:none",
            );
            NodeAssert.match(await pdf.text(), /^%PDF-/);
            NodeAssert.equal(preview.isVisible(), false);
            NodeAssert.deepEqual(errors, []);
          });
        }),
      ).pipe(Effect.provide(ElectronProtocol.layer)),
    );
    return [
      "isolated preload",
      "privileged IPC denied",
      "sensitive permissions denied",
      "React component annotation",
      "renderer HTTP and WebSocket endpoint boundary",
      "PDF policy preserved",
    ];
  } finally {
    if (wc.debugger.isAttached()) wc.debugger.detach();
    preview.destroy();
    appWindow.destroy();
  }
};
