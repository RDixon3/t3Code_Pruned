import { CoCoError, CoCoLibrary, type ServerSettings } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { ServerConfig } from "../config.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { libraryRoot, readAgents, skillDestinations } from "./library.ts";
import { synchronizeSkills, readManifest, installedCount } from "./installer.ts";

const isCoCoError = Schema.is(CoCoError);

export class CoCoService extends Context.Service<
  CoCoService,
  {
    read: Effect.Effect<typeof CoCoLibrary.Type, CoCoError>;
    act: (
      action: "enable" | "disable" | "retry" | "remove",
    ) => Effect.Effect<typeof CoCoLibrary.Type, CoCoError>;
  }
>()("t3/coco/service/CoCoService") {}
export const layer = Layer.effect(
  CoCoService,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const config = yield* ServerConfig;
    const settingsService = yield* ServerSettingsService;
    const manifestPath = path.join(path.dirname(config.settingsPath), "coco-skills.json");
    let error: string | null = null;
    let installed = yield* Effect.tryPromise({
      try: async () => installedCount(await readManifest(manifestPath)),
      catch: (cause) => new CoCoError({ message: String(cause) }),
    }).pipe(
      Effect.catch((cause) => {
        error = cause.message;
        return Effect.succeed(0);
      }),
    );
    let signature = "";
    let pending: Promise<void> = Promise.resolve();
    const run = (settings: ServerSettings, remove = false) =>
      Effect.tryPromise({
        try: () => {
          const task = pending.then(async () => {
            try {
              installed = await synchronizeSkills({
                source: path.join(libraryRoot, "skills"),
                manifestPath,
                destinations: skillDestinations(settings),
                remove,
              });
              error = null;
            } catch (cause) {
              error = cause instanceof Error ? cause.message : String(cause);
              throw cause;
            }
          });
          pending = task.catch(() => {});
          return task;
        },
        catch: (cause) => new CoCoError({ message: String(cause) }),
      });
    const reconcile = (settings: ServerSettings) =>
      Effect.gen(function* () {
        const next = [String(settings.cocoSkillsEnabled), ...skillDestinations(settings)].join(
          "\0",
        );
        if (signature === next) return;
        signature = next;
        if (settings.cocoSkillsEnabled) yield* run(settings).pipe(Effect.catch(() => Effect.void));
      });
    yield* reconcile(yield* settingsService.getSettings);
    yield* settingsService.streamChanges.pipe(
      Stream.runForEach(() => settingsService.getSettings.pipe(Effect.flatMap(reconcile))),
      Effect.forkScoped,
    );
    const read = Effect.gen(function* () {
      const settings = yield* settingsService.getSettings;
      const agents = yield* Effect.tryPromise({
        try: () => readAgents(),
        catch: (cause) => new CoCoError({ message: String(cause) }),
      });
      return {
        agents,
        enabled: settings.cocoSkillsEnabled,
        installed,
        destinations: skillDestinations(settings),
        error,
      };
    }).pipe(
      Effect.mapError((cause) =>
        isCoCoError(cause) ? cause : new CoCoError({ message: String(cause) }),
      ),
    );
    return {
      read,
      act: (action) =>
        Effect.gen(function* () {
          let settings = yield* settingsService.getSettings;
          if (action !== "retry") {
            settings = yield* settingsService.updateSettings({
              cocoSkillsEnabled: action === "enable",
            });
            signature = [String(settings.cocoSkillsEnabled), ...skillDestinations(settings)].join(
              "\0",
            );
          }
          if (action === "retry" && !settings.cocoSkillsEnabled) return yield* read;
          if (action !== "disable") yield* run(settings, action === "remove");
          return yield* read;
        }).pipe(
          Effect.mapError((cause) =>
            isCoCoError(cause) ? cause : new CoCoError({ message: String(cause) }),
          ),
        ),
    };
  }),
);
