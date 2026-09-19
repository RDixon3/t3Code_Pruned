// @effect-diagnostics nodeBuiltinImport:off globalProcess:off - real disposable subprocesses exercise the SDK boundary.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { createSdkAuth, normalizeSdkProfile } from "./serviceNowSdkAuth.ts";
const homes: string[] = [];
const controllers: ReturnType<typeof createSdkAuth>[] = [];
const exits: Promise<void>[] = [];
afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.cancelAll();
  await Promise.all(exits.splice(0));
  await Promise.all(
    homes.splice(0).map((home) => NodeFSP.rm(home, { recursive: true, force: true })),
  );
});
const profile = { alias: "dev", instanceUrl: "https://dev.service-now.com" };
async function fixture(source: string) {
  const home = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "sdk-auth-"));
  homes.push(home);
  const script = NodePath.join(home, "sdk.cjs");
  await NodeFSP.writeFile(script, source);
  const controller = createSdkAuth((_command, args, options) => {
    const child = NodeChildProcess.spawn(process.execPath, args, options);
    exits.push(new Promise<void>((resolve) => child.once("close", () => resolve())));
    return child;
  });
  controllers.push(controller);
  return { home, script, controller };
}
it("normalizes profiles and rejects unsafe or malformed input", () => {
  expect(
    normalizeSdkProfile({ ...profile, alias: " dev ", instanceUrl: profile.instanceUrl + "/" }),
  ).toEqual(profile);
  for (const alias of ["", "bad name", "--flag", "$(cmd)"])
    expect(() => normalizeSdkProfile({ ...profile, alias })).toThrow();
  for (const instanceUrl of [
    "http://dev.service-now.com",
    "https://user:pass@dev.service-now.com",
    "https://dev.service-now.com/path",
  ])
    expect(() => normalizeSdkProfile({ ...profile, instanceUrl })).toThrow();
});
it("waits for the SDK prompt, sends the code privately, and completes without a terminal", async () => {
  const { controller, script, home } = await fixture(
    `process.stdout.write('Copy the code from the browser and paste it here: ');process.stdin.once('data',code=>process.exit(code.toString()==='test-code\\n'?0:2));`,
  );
  const session = await controller.start(script, profile, home);
  await expect(controller.complete(session.sessionId, "test-code")).resolves.toEqual(profile);
});
it("reports an early SDK exit instead of claiming sign-in opened", async () => {
  const { controller, script, home } = await fixture(`process.exit(1);`);
  await expect(controller.start(script, profile, home)).rejects.toThrow("before sign-in");
});

it("passes basic credentials on stdin without opening a browser or exposing the password in arguments", async () => {
  const { controller, script, home } = await fixture(
    `let password='';process.stdin.on('data',chunk=>password+=chunk);process.stdin.on('end',()=>process.exit(password==='secret-value'&&!process.argv.includes(password)&&process.argv.includes('--password-stdin')&&process.argv.includes('basic')?0:2));`,
  );
  const session = await controller.start(script, profile, home, {
    username: "admin",
    password: "secret-value",
  });
  await expect(controller.complete(session.sessionId, "")).resolves.toEqual(profile);
});

it("does not report successful basic sign-in when the SDK fails", async () => {
  const { controller, script, home } = await fixture(
    `process.stdin.resume();process.stdin.on('end',()=>process.exit(1));`,
  );
  const session = await controller.start(script, profile, home, {
    username: "admin",
    password: "bad",
  });
  await expect(controller.complete(session.sessionId, "")).rejects.toThrow("failed");
});
it("cancels the hidden process and rejects reused or invalid submissions", async () => {
  const { controller, script, home } = await fixture(
    `process.stdout.write('Copy the code from the browser and paste it here: ');process.stdin.resume();`,
  );
  const session = await controller.start(script, profile, home);
  await expect(controller.complete(session.sessionId, "bad\ncode")).rejects.toThrow("single-line");
  controller.cancelAll();
  await expect(controller.complete(session.sessionId, "code")).rejects.toThrow("expired");
});
