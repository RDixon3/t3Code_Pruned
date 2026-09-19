import type { ServiceNowSdkStatus, ServiceNowSdkProfile } from "@t3tools/contracts";
import { compareSemverVersions } from "@t3tools/shared/semver";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { DesktopEnvironment } from "../app/DesktopEnvironment.ts";
import { parseServiceNowSdkProfiles } from "./serviceNowSdkProfiles.ts";

export class ServiceNowSdkError extends Schema.TaggedError<ServiceNowSdkError>()(
  "ServiceNowSdkError",
  {
    message: Schema.String,
  },
) {}

const PackageMetadata = Schema.Struct({
  name: Schema.Literal("@servicenow/sdk"),
  version: Schema.NonEmptyString,
});
const decodePackageMetadata = Schema.decodeUnknownEffect(Schema.fromJsonString(PackageMetadata));
const decodeVersion = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String));
const isServiceNowSdkError = Schema.is(ServiceNowSdkError);
const installLock = Semaphore.makeUnsafe(1);
const validVersion = (version: string) =>
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);

export function makeServiceNowSdk(deps: {
  runNpm: (args: ReadonlyArray<string>) => Effect.Effect<string, ServiceNowSdkError>;
  readPackage: (globalRoot: string) => Effect.Effect<string | null, ServiceNowSdkError>;
  runSdk: (
    globalRoot: string,
    args?: ReadonlyArray<string>,
  ) => Effect.Effect<string, ServiceNowSdkError>;
}) {
  const check = Effect.gen(function* () {
    const globalRoot = (yield* deps.runNpm(["root", "--global"])).trim();
    if (!globalRoot)
      return yield* new ServiceNowSdkError({
        message: "npm did not return a global package directory.",
      });
    const raw = yield* deps.readPackage(globalRoot);
    if (raw === null)
      return { installed: false, version: null, globalRoot } satisfies ServiceNowSdkStatus;
    const metadata = yield* decodePackageMetadata(raw).pipe(
      Effect.mapError(
        () =>
          new ServiceNowSdkError({
            message: "The global ServiceNow SDK package metadata is invalid.",
          }),
      ),
    );
    return { installed: true, version: metadata.version, globalRoot } satisfies ServiceNowSdkStatus;
  });
  const install = installLock.withPermits(1)(
    Effect.gen(function* () {
      const current = yield* check;
      if (current.installed) return current;
      yield* deps.runNpm(["install", "--global", "@servicenow/sdk"]);
      const result = yield* check;
      if (!result.installed)
        return yield* new ServiceNowSdkError({
          message: "npm finished, but the SDK was not found in its global package directory.",
        });
      return result;
    }),
  );
  const checkUpdates = Effect.gen(function* () {
    const current = yield* check;
    if (!current.installed) return current;
    const output = yield* deps.runNpm(["view", "@servicenow/sdk@latest", "version", "--json"]);
    const latestVersion = yield* Effect.try({
      try: () => {
        const version = decodeVersion(output);
        if (typeof version !== "string" || !validVersion(version)) throw new Error();
        return version;
      },
      catch: () => new ServiceNowSdkError({ message: "npm returned an invalid SDK version." }),
    });
    return {
      ...current,
      latestVersion,
      updateAvailable:
        current.version !== null && compareSemverVersions(current.version, latestVersion) < 0,
    };
  });
  const update = (input: { version: string; globalRoot: string }) =>
    installLock.withPermits(1)(
      Effect.gen(function* () {
        if (!validVersion(input.version))
          return yield* new ServiceNowSdkError({
            message: "Invalid SDK update version. Check for updates again.",
          });
        const current = yield* check;
        if (current.globalRoot !== input.globalRoot)
          return yield* new ServiceNowSdkError({
            message: "The global npm directory changed. Check for updates again.",
          });
        if (!current.version)
          return yield* new ServiceNowSdkError({
            message: "The SDK is no longer installed. Check again and install it.",
          });
        if (compareSemverVersions(current.version, input.version) >= 0) return current;
        yield* deps.runNpm([
          "install",
          "--global",
          "--engine-strict",
          `@servicenow/sdk@${input.version}`,
        ]);
        const result = yield* check;
        if (result.globalRoot !== current.globalRoot || result.version !== input.version)
          return yield* new ServiceNowSdkError({
            message:
              "npm finished, but the requested SDK version could not be verified. Check again.",
          });
        return { ...result, latestVersion: input.version, updateAvailable: false };
      }),
    );
  const listProfiles = Effect.gen(function* () {
    const status = yield* check;
    if (!status.installed)
      return yield* new ServiceNowSdkError({
        message: "Install the global ServiceNow SDK in Settings first.",
      });
    const output = yield* deps.runSdk(status.globalRoot);
    return yield* Effect.try({
      try: () => parseServiceNowSdkProfiles(output),
      catch: () =>
        new ServiceNowSdkError({
          message: "Could not read SDK profiles. Check now-sdk auth --list and refresh.",
        }),
    });
  });
  const deleteProfile = Effect.fn("desktop.serviceNowSdk.deleteProfile")(function* (
    profile: ServiceNowSdkProfile,
  ) {
    const profiles = yield* listProfiles;
    const current = profiles.find((entry) => entry.alias === profile.alias);
    if (!current) return profiles;
    if (current.instanceUrl !== profile.instanceUrl)
      return yield* new ServiceNowSdkError({
        message:
          "This profile's instance has changed. Refresh the list and confirm deletion again.",
      });
    const status = yield* check;
    yield* deps.runSdk(status.globalRoot, ["auth", "--delete", profile.alias]);
    const remaining = yield* listProfiles;
    if (remaining.some((entry) => entry.alias === profile.alias))
      return yield* new ServiceNowSdkError({
        message: "The SDK did not delete the profile. Please try again.",
      });
    return remaining;
  });
  return { check, checkUpdates, install, update, listProfiles, deleteProfile };
}

export const serviceNowSdk = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const runCommand = Effect.fn("desktop.serviceNowSdk.command")(function* (
    executable: string,
    args: ReadonlyArray<string>,
  ) {
    const command = yield* resolveSpawnCommand(executable, args);
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawner.spawn(
          ChildProcess.make(command.command, command.args, {
            shell: command.shell,
            cwd: environment.homeDirectory,
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          }),
        );
        const tail = (stream: typeof child.stdout) =>
          stream.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (text, chunk) => (text + chunk).slice(-16000),
            ),
          );
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [tail(child.stdout), tail(child.stderr), child.exitCode],
          { concurrency: "unbounded" },
        );
        if (Number(exitCode) !== 0)
          return yield* new ServiceNowSdkError({
            message:
              executable === "npm"
                ? `npm exited with code ${exitCode}. ${stderr || stdout}`.trim()
                : `ServiceNow SDK exited with code ${exitCode}. Check now-sdk auth --list.`,
          });
        return stdout;
      }),
    ).pipe(
      Effect.timeout(
        args[0] === "install" ? "10 minutes" : executable === "node" ? "45 seconds" : "15 seconds",
      ),
      Effect.mapError((error) =>
        isServiceNowSdkError(error)
          ? error
          : new ServiceNowSdkError({
              message: `Could not run ${executable}: ${error.message}. Ensure Node.js and npm are available to the desktop app.`,
            }),
      ),
    );
  });
  return makeServiceNowSdk({
    runNpm: (args) => runCommand("npm", args),
    runSdk: (globalRoot, args = ["auth", "--list"]) =>
      runCommand("node", [
        environment.path.join(globalRoot, "@servicenow", "sdk", "bin", "index.js"),
        ...args,
      ]),
    readPackage: (globalRoot) =>
      fs
        .readFileString(environment.path.join(globalRoot, "@servicenow", "sdk", "package.json"))
        .pipe(
          Effect.catch((error) =>
            error.reason._tag === "NotFound"
              ? Effect.succeed(null)
              : Effect.fail(
                  new ServiceNowSdkError({
                    message: `Could not read the global SDK package: ${error.message}`,
                  }),
                ),
          ),
        ),
  });
});
