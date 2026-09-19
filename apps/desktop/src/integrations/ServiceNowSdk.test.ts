import { describe, expect } from "vite-plus/test";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeServiceNowSdk, ServiceNowSdkError } from "./ServiceNowSdk.ts";

const metadata = JSON.stringify({ name: "@servicenow/sdk", version: "1.2.3" });

function fixture(initial: string | null, installResult: string | null = metadata) {
  let raw = initial;
  const commands: ReadonlyArray<string>[] = [];
  const paths: string[] = [];
  const sdk = makeServiceNowSdk({
    runSdk: () => Effect.succeed("No credentials found"),
    runNpm: (args) =>
      Effect.sync(() => {
        commands.push(args);
        if (args[0] === "install") {
          raw = installResult;
          return "installed";
        }
        if (args[0] === "view") return '"2.0.0"';
        return "/global/node_modules\n";
      }),
    readPackage: (root) =>
      Effect.sync(() => {
        paths.push(root);
        return raw;
      }),
  });
  return { sdk, commands, paths };
}

describe("global ServiceNow SDK", () => {
  it.effect("checks npm latest without installing or discovering auth profiles", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(metadata);
      expect(yield* sdk.checkUpdates).toMatchObject({
        version: "1.2.3",
        latestVersion: "2.0.0",
        updateAvailable: true,
      });
      expect(commands).toEqual([
        ["root", "--global"],
        ["view", "@servicenow/sdk@latest", "version", "--json"],
      ]);
    }),
  );
  it.effect("updates to the requested version and serializes duplicate updates", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(metadata, '{"name":"@servicenow/sdk","version":"2.0.0"}');
      const input = { version: "2.0.0", globalRoot: "/global/node_modules" };
      const results = yield* Effect.all([sdk.update(input), sdk.update(input)], {
        concurrency: "unbounded",
      });
      expect(results.every((result) => result.version === "2.0.0")).toBe(true);
      expect(commands.filter((args) => args[0] === "install")).toEqual([
        ["install", "--global", "--engine-strict", "@servicenow/sdk@2.0.0"],
      ]);
    }),
  );
  it.effect("does not downgrade or repeat an already installed update", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(metadata);
      yield* sdk.update({ version: "1.2.3", globalRoot: "/global/node_modules" });
      yield* sdk.update({ version: "1.0.0", globalRoot: "/global/node_modules" });
      expect(commands.some((args) => args[0] === "install")).toBe(false);
    }),
  );
  it.effect(
    "rejects changed directories, missing installations, and invalid versions before installation",
    () =>
      Effect.gen(function* () {
        for (const [raw, version, root] of [
          [metadata, "2.0.0", "/other"],
          [null, "2.0.0", "/global/node_modules"],
          [metadata, "latest", "/global/node_modules"],
        ] as const) {
          const { sdk, commands } = fixture(raw);
          yield* Effect.flip(sdk.update({ version, globalRoot: root }));
          expect(commands.some((args) => args[0] === "install")).toBe(false);
        }
      }),
  );
  it.effect(
    "does not report successful updates when npm leaves the wrong version or no package",
    () =>
      Effect.gen(function* () {
        for (const result of [metadata, null]) {
          const { sdk } = fixture(metadata, result);
          expect(
            (yield* Effect.flip(
              sdk.update({ version: "2.0.0", globalRoot: "/global/node_modules" }),
            )).message,
          ).toContain("could not be verified");
        }
      }),
  );
  it.effect("reports registry errors and malformed responses while local checks still work", () =>
    Effect.gen(function* () {
      for (const output of [
        Effect.succeed('{"version":"bad"}'),
        Effect.fail(new ServiceNowSdkError({ message: "Registry unavailable" })),
      ]) {
        const sdk = makeServiceNowSdk({
          readPackage: () => Effect.succeed(metadata),
          runSdk: () => Effect.die("Must not access profiles"),
          runNpm: (args) => (args[0] === "view" ? output : Effect.succeed("/global")),
        });
        yield* Effect.flip(sdk.checkUpdates);
        expect((yield* sdk.check).version).toBe("1.2.3");
      }
    }),
  );
  it.effect("propagates npm update failures without claiming success", () =>
    Effect.gen(function* () {
      const sdk = makeServiceNowSdk({
        readPackage: () => Effect.succeed(metadata),
        runSdk: () => Effect.die("Must not access profiles"),
        runNpm: (args) =>
          args[0] === "install"
            ? Effect.fail(new ServiceNowSdkError({ message: "Permission denied" }))
            : Effect.succeed("/global"),
      });
      expect(
        (yield* Effect.flip(sdk.update({ version: "2.0.0", globalRoot: "/global" }))).message,
      ).toBe("Permission denied");
    }),
  );
  it.effect("deletes only the confirmed profile and verifies it is gone", () =>
    Effect.gen(function* () {
      let removed = false;
      const commands: ReadonlyArray<string>[] = [];
      const sdk = makeServiceNowSdk({
        runNpm: () => Effect.succeed("/global"),
        readPackage: () => Effect.succeed(metadata),
        runSdk: (_root, args = ["auth", "--list"]) =>
          Effect.sync(() => {
            commands.push(args);
            if (args[1] === "--delete") {
              removed = true;
              return "";
            }
            return (
              (removed ? "" : "[dev]\n host = https://dev.service-now.com\n") +
              "[other]\n host = https://other.service-now.com"
            );
          }),
      });
      expect(
        yield* sdk.deleteProfile({ alias: "dev", instanceUrl: "https://dev.service-now.com" }),
      ).toEqual([{ alias: "other", instanceUrl: "https://other.service-now.com" }]);
      expect(commands.filter((args) => args[1] === "--delete")).toEqual([
        ["auth", "--delete", "dev"],
      ]);
    }),
  );
  it.effect(
    "refuses to delete a profile whose instance changed and detects unsuccessful deletion",
    () =>
      Effect.gen(function* () {
        const commands: ReadonlyArray<string>[] = [];
        const sdk = makeServiceNowSdk({
          runNpm: () => Effect.succeed("/global"),
          readPackage: () => Effect.succeed(metadata),
          runSdk: (_root, args = ["auth", "--list"]) =>
            Effect.sync(() => {
              commands.push(args);
              return "[dev]\n host = https://dev.service-now.com";
            }),
        });
        expect(
          (yield* Effect.flip(
            sdk.deleteProfile({ alias: "dev", instanceUrl: "https://old.service-now.com" }),
          )).message,
        ).toContain("changed");
        expect(commands.some((args) => args[1] === "--delete")).toBe(false);
        expect(
          (yield* Effect.flip(
            sdk.deleteProfile({ alias: "dev", instanceUrl: "https://dev.service-now.com" }),
          )).message,
        ).toContain("did not delete");
      }),
  );
  it.effect("lists existing global profiles and propagates discovery failures", () =>
    Effect.gen(function* () {
      const roots: string[] = [];
      let fail = false;
      const sdk = makeServiceNowSdk({
        runNpm: () => Effect.succeed("/global/node_modules"),
        readPackage: () => Effect.succeed(metadata),
        runSdk: (root) => {
          roots.push(root);
          return fail
            ? Effect.fail(new ServiceNowSdkError({ message: "SDK failed" }))
            : Effect.succeed("[dev]\n host = https://dev.service-now.com");
        },
      });
      expect(yield* sdk.listProfiles).toEqual([
        { alias: "dev", instanceUrl: "https://dev.service-now.com" },
      ]);
      expect(roots).toEqual(["/global/node_modules"]);
      fail = true;
      expect(yield* Effect.flip(sdk.listProfiles)).toMatchObject({ message: "SDK failed" });
    }),
  );
  it.effect("checks only npm's global root and reports the installed version", () =>
    Effect.gen(function* () {
      const { sdk, commands, paths } = fixture(metadata);
      expect(yield* sdk.check).toEqual({
        installed: true,
        version: "1.2.3",
        globalRoot: "/global/node_modules",
      });
      expect(commands).toEqual([["root", "--global"]]);
      expect(paths).toEqual(["/global/node_modules"]);
    }),
  );

  it.effect("reports a missing global package without installing during a check", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(null);
      expect((yield* sdk.check).installed).toBe(false);
      expect(commands).toEqual([["root", "--global"]]);
    }),
  );

  it.effect("uses the fixed global install command, rechecks, and avoids duplicate installs", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(null);
      const results = yield* Effect.all([sdk.install, sdk.install], { concurrency: "unbounded" });
      expect(results.every((result) => result.installed)).toBe(true);
      expect(commands.filter((args) => args[0] === "install")).toEqual([
        ["install", "--global", "@servicenow/sdk"],
      ]);
      expect(commands.filter((args) => args[0] === "root")).toHaveLength(3);
    }),
  );

  it.effect("does not overwrite an existing global installation", () =>
    Effect.gen(function* () {
      const { sdk, commands } = fixture(metadata);
      yield* sdk.install;
      expect(commands).toEqual([["root", "--global"]]);
    }),
  );

  it.effect(
    "does not report success when npm exits successfully but the SDK is still missing",
    () =>
      Effect.gen(function* () {
        const { sdk } = fixture(null, null);
        const error = yield* Effect.flip(sdk.install);
        expect(error.message).toContain("was not found");
      }),
  );

  it.effect("distinguishes unavailable npm and corrupt metadata from a missing SDK", () =>
    Effect.gen(function* () {
      const unavailable = makeServiceNowSdk({
        runSdk: () => Effect.succeed("No credentials found"),
        runNpm: () => Effect.fail(new ServiceNowSdkError({ message: "npm unavailable" })),
        readPackage: () => Effect.succeed(null),
      });
      expect((yield* Effect.flip(unavailable.check)).message).toBe("npm unavailable");
      expect((yield* Effect.flip(fixture("invalid json").sdk.check)).message).toContain(
        "metadata is invalid",
      );
    }),
  );
});
