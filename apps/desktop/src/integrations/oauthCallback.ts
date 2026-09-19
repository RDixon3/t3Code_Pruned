// @effect-diagnostics nodeBuiltinImport:off -- Desktop OAuth uses a loopback HTTP callback.
import * as NodeHttp from "node:http";

export async function listenForOAuth(
  state: string,
  signal: AbortSignal,
  options: { path: string; port: number; name: string },
) {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // The callback can arrive while the MCP connection is still unwinding its 401.
  void code.catch(() => {});
  const server = NodeHttp.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" || url.pathname !== options.path) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (url.searchParams.get("state") !== state) {
      response.writeHead(400).end("Invalid sign-in state. Return to CoCo and try again.");
      return;
    }
    const authorizationCode = url.searchParams.get("code");
    if (url.searchParams.has("error") || !authorizationCode) {
      response.writeHead(400).end("Sign-in was not completed. Return to CoCo.");
      rejectCode(new Error(`${options.name} sign-in was declined or incomplete.`));
      return;
    }
    response.end("Sign-in received. You can return to CoCo.");
    resolveCode(authorizationCode);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", resolve);
  });
  const close = () => {
    signal.removeEventListener("abort", abort);
    server.close();
    server.closeAllConnections();
  };
  const abort = () => {
    rejectCode(new Error(`${options.name} sign-in cancelled or timed out.`));
    close();
  };
  signal.addEventListener("abort", abort, { once: true });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error(`Could not start ${options.name} sign-in.`);
  if (signal.aborted) abort();
  return { redirectUrl: `http://127.0.0.1:${address.port}${options.path}`, code, close };
}
