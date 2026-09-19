// @effect-diagnostics nodeBuiltinImport:off globalTimers:off - SDK subprocess boundary; never retain or log OAuth output.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import type { ServiceNowSdkProfile } from "@t3tools/contracts";

export function normalizeSdkProfile(input: ServiceNowSdkProfile): ServiceNowSdkProfile {
  const alias = input.alias.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(alias))
    throw new Error(
      "Use 1–64 letters, numbers, dots, underscores or hyphens for the profile name.",
    );
  const url = new URL(input.instanceUrl.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Enter an HTTPS instance address without a path or credentials.");
  return { alias, instanceUrl: url.origin };
}

export function createSdkAuth(
  spawn: (
    command: string,
    args: ReadonlyArray<string>,
    options: NodeChildProcess.SpawnOptions,
  ) => NodeChildProcess.ChildProcess = NodeChildProcess.spawn,
) {
  const sessions = new Map<
    string,
    {
      profile: ServiceNowSdkProfile;
      child: NodeChildProcess.ChildProcess;
      done: Promise<void>;
      cancel: () => void;
      submitted: boolean;
      basic: boolean;
    }
  >();
  const cancel = (id: string) => {
    sessions.get(id)?.cancel();
    sessions.delete(id);
  };
  return {
    isActive: () => sessions.size > 0,
    async start(
      sdkPath: string,
      profile: ServiceNowSdkProfile,
      cwd: string,
      credentials?: { username: string; password: string },
    ) {
      if (credentials && (!credentials.username.trim() || !credentials.password))
        throw new Error("Enter a username and password.");
      if (sessions.size)
        throw new Error("Another SDK sign-in is in progress. Close it before starting another.");
      const id = NodeCrypto.randomUUID();
      const child = spawn(
        "node",
        [
          sdkPath,
          "auth",
          "--add",
          profile.instanceUrl,
          "--type",
          credentials ? "basic" : "oauth",
          "--alias",
          profile.alias,
          ...(credentials ? ["--username", credentials.username.trim(), "--password-stdin"] : []),
        ],
        { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      );
      let resolveReady!: () => void;
      let rejectReady!: (error: Error) => void;
      let resolveDone!: () => void;
      let rejectDone!: (error: Error) => void;
      let ready = false;
      let tail = "";
      const waiting = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      void waiting.catch(() => {});
      const done = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
      });
      void done.catch(() => {});
      const fail = (message: string) => {
        const error = new Error(message);
        rejectReady(error);
        rejectDone(error);
        child.kill();
      };
      const startupTimer = setTimeout(
        () => fail("SDK sign-in did not start. Check your SDK installation and try again."),
        45000,
      );
      const expiryTimer = setTimeout(
        () => {
          fail("SDK sign-in expired. Start again.");
          sessions.delete(id);
        },
        5 * 60 * 1000,
      );
      const observe = (chunk: Buffer) => {
        if (ready) return;
        tail = (tail + chunk.toString()).slice(-16000);
        if (tail.includes("Copy the code from the browser and paste it here")) {
          ready = true;
          tail = "";
          clearTimeout(startupTimer);
          resolveReady();
        }
      };
      child.stdout?.on("data", observe);
      child.stderr?.on("data", observe);
      child.stdin?.on("error", () => fail("SDK sign-in input closed. Start again."));
      child.once("error", () =>
        fail("Could not start the ServiceNow SDK. Check Node.js and the global SDK installation."),
      );
      child.once("exit", (code) => {
        clearTimeout(startupTimer);
        clearTimeout(expiryTimer);
        tail = "";
        if (!ready) rejectReady(new Error("The SDK exited before sign-in was ready."));
        if (code === 0 && ready) resolveDone();
        else rejectDone(new Error("SDK sign-in failed or was cancelled. Start again."));
      });
      sessions.set(id, {
        profile,
        child,
        done,
        submitted: false,
        basic: Boolean(credentials),
        cancel: () => {
          clearTimeout(startupTimer);
          clearTimeout(expiryTimer);
          fail("SDK sign-in cancelled.");
        },
      });
      if (credentials) {
        ready = true;
        clearTimeout(startupTimer);
        child.stdin?.end(credentials.password);
        resolveReady();
      }
      try {
        await waiting;
        return { sessionId: id, profile };
      } catch (error) {
        cancel(id);
        throw error;
      }
    },
    async complete(id: string, code: string) {
      const session = sessions.get(id);
      if (!session) throw new Error("SDK sign-in expired. Start again.");
      if (
        !session.basic &&
        (!code.trim() ||
          [...code].some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ) ||
          code.length > 8192)
      )
        throw new Error("Paste the single-line sign-in code from ServiceNow.");
      if (session.submitted) throw new Error("The sign-in code is already being checked.");
      session.submitted = true;
      try {
        if (!session.basic) session.child.stdin?.write(code.trim() + "\n");
        await session.done;
        return session.profile;
      } finally {
        cancel(id);
      }
    },
    cancel,
    cancelAll: () => {
      for (const id of sessions.keys()) cancel(id);
    },
  };
}
export const sdkAuth = createSdkAuth();
