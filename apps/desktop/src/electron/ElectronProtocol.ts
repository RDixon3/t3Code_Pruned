import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeTimersPromises from "node:timers/promises";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";

import * as Electron from "electron";

const DESKTOP_HOST = "app";
const DESKTOP_PRODUCTION_SCHEME = "t3code";
const DESKTOP_DEVELOPMENT_SCHEME = "t3code-dev";

export function getDesktopScheme(isDevelopment: boolean): string {
  return isDevelopment ? DESKTOP_DEVELOPMENT_SCHEME : DESKTOP_PRODUCTION_SCHEME;
}

function getDesktopOrigin(isDevelopment: boolean): string {
  return `${getDesktopScheme(isDevelopment)}://${DESKTOP_HOST}`;
}

export function getDesktopUrl(isDevelopment: boolean): string {
  return `${getDesktopOrigin(isDevelopment)}/`;
}

export class ElectronProtocolRegistrationError extends Schema.TaggedError<ElectronProtocolRegistrationError>()(
  "ElectronProtocolRegistrationError",
  {
    scheme: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to register Electron protocol scheme "${this.scheme}".`;
  }
}

export class ElectronProtocolUnregistrationError extends Schema.TaggedError<ElectronProtocolUnregistrationError>()(
  "ElectronProtocolUnregistrationError",
  {
    scheme: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to unregister Electron protocol scheme "${this.scheme}".`;
  }
}

export interface DesktopProtocolBackends {
  readonly primaryOrigin: URL | null;
  readonly backendOrigins: readonly URL[];
}

export interface DesktopProtocolRegistrationInput {
  readonly scheme: string;
  readonly targetOrigin: URL;
  readonly backendOrigin: URL;
  // Read the managed pool on demand: WSL can start, stop, or change address
  // after the renderer document has loaded. Never populate this from a URL
  // supplied by the renderer.
  readonly resolveBackends?: Effect.Effect<DesktopProtocolBackends>;
}

export class ElectronProtocol extends Context.Service<
  ElectronProtocol,
  {
    readonly registerDesktopProtocol: (
      input: DesktopProtocolRegistrationInput,
    ) => Effect.Effect<void, ElectronProtocolRegistrationError, Scope.Scope>;
  }
>()("@t3tools/desktop/electron/ElectronProtocol") {}

export function makeDesktopContentSecurityPolicy(input: DesktopProtocolRegistrationInput): string {
  const scriptSources = [
    "'self'",
    "'wasm-unsafe-eval'",
    // Vite injects its React refresh bootstrap during development.
    ...(input.scheme === DESKTOP_DEVELOPMENT_SCHEME ? ["'unsafe-inline'"] : []),
  ];
  const localOrigins = [...new Set([input.targetOrigin.origin, input.backendOrigin.origin])];
  const socketOrigins = localOrigins.map((origin) => origin.replace(/^http/, "ws"));
  // A document CSP cannot gain origins after load. For dynamic WSL endpoints,
  // the default-session request guard below checks the exact current pool
  // origins instead. CSP still limits scripts and external theme connections.
  const connectSources = [
    "'self'",
    ...localOrigins,
    ...socketOrigins,
    ...(input.resolveBackends ? ["http:", "ws:"] : []),
    "https://open-vsx.org",
    "https://openvsx.eclipsecontent.org",
  ];

  const backendAssetSources = input.resolveBackends ? "http:" : localOrigins.join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `connect-src ${connectSources.join(" ")}`,
    `img-src 'self' ${input.scheme}: blob: data: ${backendAssetSources} https:`,
    `media-src 'self' ${input.scheme}: blob: ${backendAssetSources} https:`,
    "style-src 'self' 'unsafe-inline'",
    `font-src 'self' ${input.scheme}: data:`,
    "worker-src 'self' blob:",
    `frame-src 'self' blob: ${backendAssetSources}`,
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

function withContentSecurityPolicy(response: Response, policy: string): Response {
  const headers = new Headers(response.headers);
  // Local HTML/SVG artifacts already carry a sandbox policy. Replacing it with
  // the privileged renderer's policy would remove that isolation.
  // Chromium's built-in PDF viewer needs its own plugin document policy.
  const isPdf =
    headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/pdf";
  if (!isPdf && !headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", policy);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const THEME_MARKETPLACE_ORIGINS = new Set([
  "https://open-vsx.org",
  "https://openvsx.eclipsecontent.org",
]);

function isAppRendererRequest(
  details: Electron.OnBeforeRequestListenerDetails,
  scheme: string,
): boolean {
  // Electron net.fetch (OAuth/MCP/SDK requests in the main process) has no
  // renderer webContents. Preview browsers use separate session partitions.
  if (details.webContentsId === undefined || details.webContentsId <= 0) return false;
  const contents = Electron.webContents.fromId(details.webContentsId);
  if (!contents || contents.isDestroyed()) return false;
  const url = URL.parse(contents.getURL());
  return url?.protocol === `${scheme}:` && url.host === DESKTOP_HOST;
}

function allowsRendererRequest(
  details: Electron.OnBeforeRequestListenerDetails,
  input: DesktopProtocolRegistrationInput,
  backends: DesktopProtocolBackends,
): boolean {
  const url = URL.parse(details.url);
  if (!url || url.username || url.password) return false;
  const origin = url.origin.replace(/^ws/, "http");
  const trustedOrigins = new Set([
    ...(input.scheme === DESKTOP_DEVELOPMENT_SCHEME || !input.resolveBackends
      ? [input.targetOrigin.origin]
      : []),
    // The bootstrap address is a fallback only for static registrations. WSL
    // primary replacement must not leave an obsolete Windows endpoint trusted.
    ...(input.resolveBackends ? [] : [input.backendOrigin.origin]),
    ...backends.backendOrigins.map((backend) => backend.origin),
  ]);
  if (trustedOrigins.has(origin)) return true;
  if (details.resourceType === "xhr" && THEME_MARKETPLACE_ORIGINS.has(url.origin)) return true;
  // Keep the existing HTTPS avatar and media support. This does not allow
  // scripts, frames, fetches, or sockets to arbitrary external origins.
  return (
    url.protocol === "https:" &&
    (details.resourceType === "image" || details.resourceType === "media")
  );
}

/**
 * Must run synchronously during process bootstrap, before Electron emits `ready`.
 */
function registerDesktopSchemePrivilegesSync(): void {
  Electron.protocol.registerSchemesAsPrivileged([
    {
      scheme: DESKTOP_PRODUCTION_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
    {
      scheme: DESKTOP_DEVELOPMENT_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

const registerDesktopSchemePrivileges = Effect.sync(registerDesktopSchemePrivilegesSync).pipe(
  Effect.withSpan("desktop.electron.protocol.registerSchemePrivileges"),
);

export const layerSchemePrivileges = Layer.effectDiscard(registerDesktopSchemePrivileges);

async function proxyRequest(
  request: Request,
  targetOrigin: URL,
  contentSecurityPolicy: string,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (requestUrl.host !== DESKTOP_HOST) {
    return new Response(null, { status: 404 });
  }

  const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, targetOrigin);
  const headers = new Headers(request.headers);
  const headersToRemove: string[] = [];
  for (const name of headers.keys()) {
    if (
      name === "host" ||
      name === "origin" ||
      name === "referer" ||
      name === "connection" ||
      name === "content-length" ||
      name === "accept-encoding" ||
      name === "upgrade-insecure-requests" ||
      name.startsWith("sec-fetch-")
    ) {
      headersToRemove.push(name);
    }
  }
  for (const name of headersToRemove) {
    headers.delete(name);
  }
  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    (init as RequestInit & { duplex: "half" }).duplex = "half";
  }
  const response =
    request.method === "GET" || request.method === "HEAD"
      ? await fetchWithTransientRetry(targetUrl.toString(), init)
      : await Electron.net.fetch(targetUrl.toString(), init);
  return withContentSecurityPolicy(response, contentSecurityPolicy);
}

const TRANSIENT_FETCH_RETRY_DELAYS_MS = [0, 50, 150] as const;

async function fetchWithTransientRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (const delayMs of TRANSIENT_FETCH_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await NodeTimersPromises.setTimeout(delayMs);
    }

    try {
      return await Electron.net.fetch(url, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const registered = yield* Ref.make(false);

  const registerDesktopProtocol = Effect.fn("desktop.electron.protocol.registerDesktopProtocol")(
    function* (input: DesktopProtocolRegistrationInput) {
      if (yield* Ref.get(registered)) return;

      const contentSecurityPolicy = makeDesktopContentSecurityPolicy(input);
      const readBackends =
        input.resolveBackends ??
        Effect.succeed({
          primaryOrigin: input.backendOrigin,
          backendOrigins: [input.backendOrigin],
        });
      const beforeRequest = (
        details: Electron.OnBeforeRequestListenerDetails,
        callback: (response: Electron.CallbackResponse) => void,
      ) => {
        if (!isAppRendererRequest(details, input.scheme)) {
          callback({ cancel: false });
          return;
        }
        void Effect.runPromise(readBackends).then(
          (backends) => callback({ cancel: !allowsRendererRequest(details, input, backends) }),
          // Resolver failure must not silently grant the renderer network access.
          () => callback({ cancel: true }),
        );
      };

      yield* Effect.acquireRelease(
        Effect.try({
          try: () => {
            // This is the sole default-session onBeforeRequest listener. Preview
            // sessions keep their own policies; no global Electron net hook is used.
            Electron.session.defaultSession.webRequest.onBeforeRequest(
              { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
              beforeRequest,
            );
            try {
              Electron.protocol.handle(input.scheme, async (request) => {
                if (input.scheme === DESKTOP_DEVELOPMENT_SCHEME || !input.resolveBackends) {
                  return proxyRequest(request, input.targetOrigin, contentSecurityPolicy);
                }
                const backends = await Effect.runPromise(readBackends);
                if (backends.primaryOrigin === null) {
                  return new Response("Desktop backend is not ready.", { status: 503 });
                }
                return proxyRequest(request, backends.primaryOrigin, contentSecurityPolicy);
              });
            } catch (error) {
              Electron.session.defaultSession.webRequest.onBeforeRequest(null);
              throw error;
            }
          },
          catch: (cause) => new ElectronProtocolRegistrationError({ scheme: input.scheme, cause }),
        }).pipe(Effect.andThen(Ref.set(registered, true))),
        () =>
          Effect.try({
            try: () => {
              Electron.session.defaultSession.webRequest.onBeforeRequest(null);
              Electron.protocol.unhandle(input.scheme);
            },
            catch: (cause) =>
              new ElectronProtocolUnregistrationError({
                scheme: input.scheme,
                cause,
              }),
          }).pipe(Effect.andThen(Ref.set(registered, false)), Effect.orDie),
      );
    },
  );

  return ElectronProtocol.of({ registerDesktopProtocol });
});

export const layer = Layer.effect(ElectronProtocol, make);
