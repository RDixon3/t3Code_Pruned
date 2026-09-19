import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import type * as Electron from "electron";
import { beforeEach, vi } from "vite-plus/test";

const { handleMock, netFetchMock, unhandleMock, beforeRequestMock, webContentsFromIdMock } =
  vi.hoisted(() => ({
    handleMock: vi.fn(),
    netFetchMock: vi.fn(),
    unhandleMock: vi.fn(),
    beforeRequestMock: vi.fn(),
    webContentsFromIdMock: vi.fn(),
  }));

vi.mock("electron", () => ({
  net: { fetch: netFetchMock },
  protocol: { handle: handleMock, unhandle: unhandleMock },
  session: { defaultSession: { webRequest: { onBeforeRequest: beforeRequestMock } } },
  webContents: { fromId: webContentsFromIdMock },
}));

import * as ElectronProtocol from "./ElectronProtocol.ts";

type BeforeRequest = (
  details: Electron.OnBeforeRequestListenerDetails,
  callback: (response: Electron.CallbackResponse) => void,
) => void;

function checkRequest(
  url: string,
  resourceType: Electron.OnBeforeRequestListenerDetails["resourceType"] = "xhr",
  webContentsId: number | undefined = 1,
): Effect.Effect<Electron.CallbackResponse> {
  const handler = beforeRequestMock.mock.calls.find(
    (call) => call.length === 2,
  )?.[1] as BeforeRequest;
  assert.isFunction(handler);
  return Effect.promise(
    () =>
      new Promise((resolve) =>
        handler(
          {
            id: 1,
            url,
            method: "GET",
            resourceType,
            referrer: "",
            timestamp: 0,
            uploadData: [],
            ...(webContentsId === undefined ? {} : { webContentsId }),
          },
          resolve,
        ),
      ),
  );
}

describe("ElectronProtocol", () => {
  beforeEach(() => {
    handleMock.mockReset();
    netFetchMock.mockReset();
    unhandleMock.mockReset();
    beforeRequestMock.mockReset();
    webContentsFromIdMock.mockReset();
    webContentsFromIdMock.mockImplementation((id) => ({
      isDestroyed: () => false,
      getURL: () => (id === 1 ? "t3code://app/" : "https://example.com/preview"),
    }));
  });

  it.effect("proxies the stable renderer origin to the current app server", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      netFetchMock.mockResolvedValue(new Response("ok"));

      yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code-dev",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3774/"),
          });
          assert.isDefined(handler);

          const response = yield* Effect.promise(() =>
            handler!(
              new Request("t3code-dev://app/api/health?verbose=1", {
                headers: {
                  accept: "application/json",
                  origin: "t3code-dev://app",
                  referer: "t3code-dev://app/",
                  "sec-fetch-site": "same-origin",
                },
              }),
            ),
          );
          assert.equal(yield* Effect.promise(() => response.text()), "ok");
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "connect-src 'self' http://127.0.0.1:3773 http://127.0.0.1:3774 ws://127.0.0.1:3773 ws://127.0.0.1:3774 https://open-vsx.org https://openvsx.eclipsecontent.org",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "img-src 'self' t3code-dev: blob: data: http://127.0.0.1:3773 http://127.0.0.1:3774 https:",
          );
          assert.include(
            response.headers.get("content-security-policy") ?? "",
            "font-src 'self' t3code-dev: data:",
          );
        }),
      );

      assert.deepEqual(
        handleMock.mock.calls.map((call) => call[0]),
        ["t3code-dev"],
      );
      assert.equal(netFetchMock.mock.calls[0]?.[0], "http://127.0.0.1:3773/api/health?verbose=1");
      const forwardedHeaders = new Headers(netFetchMock.mock.calls[0]?.[1]?.headers);
      assert.equal(forwardedHeaders.get("accept"), "application/json");
      assert.isNull(forwardedHeaders.get("origin"));
      assert.isNull(forwardedHeaders.get("referer"));
      assert.isNull(forwardedHeaders.get("sec-fetch-site"));
      assert.deepEqual(unhandleMock.mock.calls, [["t3code-dev"]]);
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("rejects custom protocol requests for another host", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });

      const response = yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
          });
          return yield* Effect.promise(() => handler!(new Request("t3code://other/")));
        }),
      );

      assert.equal(response.status, 404);
      assert.equal(netFetchMock.mock.calls.length, 0);
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("retries transient renderer target failures", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      netFetchMock
        .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5733"))
        .mockResolvedValueOnce(new Response("ready"));

      const response = yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code-dev",
            targetOrigin: new URL("http://127.0.0.1:5733/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
          });
          return yield* Effect.promise(() => handler!(new Request("t3code-dev://app/")));
        }),
      );

      assert.equal(yield* Effect.promise(() => response.text()), "ready");
      assert.equal(netFetchMock.mock.calls.length, 2);
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("preserves protocol registration failures", () =>
    Effect.gen(function* () {
      const cause = new Error("protocol registration failed");
      handleMock.mockImplementationOnce(() => {
        throw cause;
      });

      const protocol = yield* ElectronProtocol.ElectronProtocol;
      const error = yield* Effect.scoped(
        protocol.registerDesktopProtocol({
          scheme: "t3code-dev",
          targetOrigin: new URL("http://127.0.0.1:3773/"),
          backendOrigin: new URL("http://127.0.0.1:3774/"),
        }),
      ).pipe(Effect.flip);

      assert.instanceOf(error, ElectronProtocol.ElectronProtocolRegistrationError);
      assert.equal(error.scheme, "t3code-dev");
      assert.strictEqual(error.cause, cause);
      assert.equal(error.message, 'Failed to register Electron protocol scheme "t3code-dev".');
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("preserves protocol unregistration failures", () =>
    Effect.gen(function* () {
      const cause = new Error("protocol unregistration failed");
      unhandleMock.mockImplementationOnce(() => {
        throw cause;
      });

      const protocol = yield* ElectronProtocol.ElectronProtocol;
      const exit = yield* Effect.exit(
        Effect.scoped(
          protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
          }),
        ),
      );

      assert.equal(exit._tag, "Failure");
      if (exit._tag === "Failure") {
        const error = Cause.squash(exit.cause);
        assert.instanceOf(error, ElectronProtocol.ElectronProtocolUnregistrationError);
        assert.equal(error.scheme, "t3code");
        assert.strictEqual(error.cause, cause);
        assert.equal(error.message, 'Failed to unregister Electron protocol scheme "t3code".');
      }
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it("restricts production scripts and connections to the desktop's dependencies", () => {
    const policy = ElectronProtocol.makeDesktopContentSecurityPolicy({
      scheme: "t3code",
      targetOrigin: new URL("http://127.0.0.1:3773/"),
      backendOrigin: new URL("http://127.0.0.1:3773/"),
    });
    const directives = Object.fromEntries(
      policy.split("; ").map((directive) => {
        const [name, ...sources] = directive.split(" ");
        return [name, sources];
      }),
    );

    assert.deepEqual(directives["script-src"], ["'self'", "'wasm-unsafe-eval'"]);
    assert.deepEqual(directives["connect-src"], [
      "'self'",
      "http://127.0.0.1:3773",
      "ws://127.0.0.1:3773",
      "https://open-vsx.org",
      "https://openvsx.eclipsecontent.org",
    ]);
    assert.deepEqual(directives["img-src"], [
      "'self'",
      "t3code:",
      "blob:",
      "data:",
      "http://127.0.0.1:3773",
      "https:",
    ]);
    assert.deepEqual(directives["frame-src"], ["'self'", "blob:", "http://127.0.0.1:3773"]);
    assert.deepEqual(directives["object-src"], ["'none'"]);
    assert.deepEqual(directives["base-uri"], ["'self'"]);
  });

  it.effect("preserves the isolation policy on local HTML artifacts", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      const artifactPolicy = "sandbox allow-scripts allow-forms allow-popups allow-modals";
      netFetchMock.mockResolvedValue(
        new Response("<h1>Preview</h1>", {
          headers: { "Content-Security-Policy": artifactPolicy, "Content-Type": "text/html" },
        }),
      );
      const response = yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
          });
          return yield* Effect.promise(() =>
            handler!(new Request("t3code://app/api/attachments/report.html")),
          );
        }),
      );
      assert.equal(response.headers.get("Content-Security-Policy"), artifactPolicy);
      assert.equal(yield* Effect.promise(() => response.text()), "<h1>Preview</h1>");
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );
  it.effect("leaves PDF responses available to Chromium's document viewer", () =>
    Effect.gen(function* () {
      let handler: ((request: Request) => Promise<Response>) | undefined;
      handleMock.mockImplementation((_scheme, nextHandler) => {
        handler = nextHandler;
      });
      netFetchMock.mockResolvedValue(
        new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf" } }),
      );
      const response = yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
          });
          return yield* Effect.promise(() =>
            handler!(new Request("t3code://app/api/attachments/report.pdf")),
          );
        }),
      );
      assert.isNull(response.headers.get("Content-Security-Policy"));
      assert.equal(response.headers.get("Content-Type"), "application/pdf");
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("allows only currently managed endpoints as a dual-mode WSL backend changes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const primary = new URL("http://127.0.0.1:3773/");
        const wsl = new URL("http://172.27.0.99:3774/");
        const backends = yield* Ref.make<ElectronProtocol.DesktopProtocolBackends>({
          primaryOrigin: primary,
          backendOrigins: [primary],
        });
        const protocol = yield* ElectronProtocol.ElectronProtocol;
        yield* protocol.registerDesktopProtocol({
          scheme: "t3code",
          targetOrigin: primary,
          backendOrigin: primary,
          resolveBackends: Ref.get(backends),
        });
        assert.isTrue((yield* checkRequest(`${wsl}api/health`)).cancel);
        yield* Ref.set(backends, { primaryOrigin: primary, backendOrigins: [primary, wsl] });
        for (const resource of ["xhr", "image", "media", "subFrame"] as const) {
          assert.isFalse((yield* checkRequest(`${wsl}api/data`, resource)).cancel);
        }
        assert.isFalse((yield* checkRequest("ws://172.27.0.99:3774/ws", "webSocket")).cancel);
        assert.isTrue((yield* checkRequest("http://172.27.0.99:4000/api")).cancel);
        assert.isTrue((yield* checkRequest("http://192.168.1.5:3774/api")).cancel);
        assert.isTrue((yield* checkRequest("https://unrelated.example/api")).cancel);
        yield* Ref.set(backends, { primaryOrigin: primary, backendOrigins: [primary] });
        assert.isTrue((yield* checkRequest(`${wsl}api/health`)).cancel);
        assert.isTrue((yield* checkRequest("ws://172.27.0.99:3774/ws", "webSocket")).cancel);
        assert.isFalse((yield* checkRequest(`${primary}api/health`)).cancel);
      }),
    ).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("serves WSL-only windows from the current primary and revokes replaced addresses", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const windows = new URL("http://127.0.0.1:3773/");
        const wsl = new URL("http://172.27.0.99:3773/");
        const backends = yield* Ref.make<ElectronProtocol.DesktopProtocolBackends>({
          primaryOrigin: wsl,
          backendOrigins: [wsl],
        });
        netFetchMock.mockImplementation(() => Promise.resolve(new Response("app")));
        const protocol = yield* ElectronProtocol.ElectronProtocol;
        yield* protocol.registerDesktopProtocol({
          scheme: "t3code",
          targetOrigin: windows,
          backendOrigin: windows,
          resolveBackends: Ref.get(backends),
        });
        const handler = handleMock.mock.calls[0]?.[1] as (request: Request) => Promise<Response>;
        const response = yield* Effect.promise(() => handler(new Request("t3code://app/")));
        assert.equal(netFetchMock.mock.calls[0]?.[0], wsl.href);
        assert.include(response.headers.get("Content-Security-Policy") ?? "", "http: ws:");
        assert.isTrue((yield* checkRequest(`${windows}api/health`)).cancel);
        assert.isFalse((yield* checkRequest(`${wsl}api/health`)).cancel);
        const replacement = new URL("http://172.28.0.2:3773/");
        yield* Ref.set(backends, { primaryOrigin: replacement, backendOrigins: [replacement] });
        yield* Effect.promise(() => handler(new Request("t3code://app/api/health?check=1")));
        assert.equal(netFetchMock.mock.calls[1]?.[0], `${replacement}api/health?check=1`);
        assert.isTrue((yield* checkRequest(`${wsl}api/health`)).cancel);
        yield* Ref.set(backends, { primaryOrigin: null, backendOrigins: [] });
        const unavailable = yield* Effect.promise(() => handler(new Request("t3code://app/")));
        assert.equal(unavailable.status, 503);
        assert.lengthOf(netFetchMock.mock.calls, 2);
      }),
    ).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("keeps Vite as the development document target with a WSL primary", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const vite = new URL("http://127.0.0.1:5733/");
        const wsl = new URL("http://172.27.0.99:3773/");
        webContentsFromIdMock.mockReturnValue({
          isDestroyed: () => false,
          getURL: () => "t3code-dev://app/",
        });
        netFetchMock.mockResolvedValue(new Response("dev app"));
        const protocol = yield* ElectronProtocol.ElectronProtocol;
        yield* protocol.registerDesktopProtocol({
          scheme: "t3code-dev",
          targetOrigin: vite,
          backendOrigin: new URL("http://127.0.0.1:3773/"),
          resolveBackends: Effect.succeed({ primaryOrigin: wsl, backendOrigins: [wsl] }),
        });
        const handler = handleMock.mock.calls[0]?.[1] as (request: Request) => Promise<Response>;
        yield* Effect.promise(() => handler(new Request("t3code-dev://app/")));
        assert.equal(netFetchMock.mock.calls[0]?.[0], vite.href);
        assert.isFalse((yield* checkRequest("ws://127.0.0.1:5733/", "webSocket")).cancel);
        assert.isFalse((yield* checkRequest("ws://172.27.0.99:3773/ws", "webSocket")).cancel);
      }),
    ).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("preserves main-process integration requests and the theme marketplace", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const primary = new URL("http://127.0.0.1:3773/");
        const protocol = yield* ElectronProtocol.ElectronProtocol;
        yield* protocol.registerDesktopProtocol({
          scheme: "t3code",
          targetOrigin: primary,
          backendOrigin: primary,
          resolveBackends: Effect.succeed({ primaryOrigin: primary, backendOrigins: [primary] }),
        });
        assert.isFalse((yield* checkRequest("https://mcp.atlassian.com/v1/mcp", "xhr", -1)).cancel);
        assert.isFalse((yield* checkRequest("https://v0.app/api/mcp", "xhr", 0)).cancel);
        assert.isFalse((yield* checkRequest("https://preview.example/", "xhr", 2)).cancel);
        assert.isFalse((yield* checkRequest("https://open-vsx.org/api/themes")).cancel);
        assert.isFalse(
          (yield* checkRequest("https://openvsx.eclipsecontent.org/theme.vsix")).cancel,
        );
        assert.isFalse((yield* checkRequest("https://avatar.example/image.png", "image")).cancel);
        assert.isTrue((yield* checkRequest("https://mcp.atlassian.com/v1/mcp")).cancel);
        assert.isTrue((yield* checkRequest("https://open-vsx.org/script.js", "script")).cancel);
      }),
    ).pipe(Effect.provide(ElectronProtocol.layer)),
  );

  it.effect("fails closed when the dynamic endpoint resolver fails and removes its listener", () =>
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const protocol = yield* ElectronProtocol.ElectronProtocol;
          yield* protocol.registerDesktopProtocol({
            scheme: "t3code",
            targetOrigin: new URL("http://127.0.0.1:3773/"),
            backendOrigin: new URL("http://127.0.0.1:3773/"),
            resolveBackends: Effect.die("pool unavailable"),
          });
          assert.isTrue((yield* checkRequest("http://127.0.0.1:3773/api")).cancel);
          assert.isFalse(
            (yield* checkRequest("https://mcp.atlassian.com/v1/mcp", "xhr", -1)).cancel,
          );
        }),
      );
      assert.deepEqual(beforeRequestMock.mock.calls.at(-1), [null]);
    }).pipe(Effect.provide(ElectronProtocol.layer)),
  );
});
