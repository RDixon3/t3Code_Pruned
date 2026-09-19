// @effect-diagnostics nodeBuiltinImport:off -- Synchronous initialization must finish before the desktop configuration layer reads the environment.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import theme from "../../../themes/coco.json" with { type: "json" };

/** Called before the packaged desktop reads its configuration. Existing user choices win. */
export function prepareCoCoDataDirectory(homeDirectory: string, configuredHome?: string): string {
  const baseDirectory = configuredHome || NodePath.join(homeDirectory, ".coco");
  const stateDirectory = NodePath.join(baseDirectory, "userdata");
  NodeFS.mkdirSync(NodePath.join(stateDirectory, "themes"), { recursive: true });
  const seed = (name: string, value: unknown) => {
    try {
      NodeFS.writeFileSync(NodePath.join(stateDirectory, name), JSON.stringify(value), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  };
  seed("themes/coco.json", theme);
  seed("settings.json", { defaultTheme: "coco", defaultThemeSetAt: "2026-09-09T00:00:00.000Z" });
  return baseDirectory;
}
