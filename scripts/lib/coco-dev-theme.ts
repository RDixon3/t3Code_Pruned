// @effect-diagnostics nodeBuiltinImport:off - standalone development bootstrap using exclusive file creation.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

/** Seed only a worktree's isolated development state; existing files win. */
export async function seedCocoDevTheme(baseDir: string): Promise<void> {
  const stateDir = NodePath.join(baseDir, "userdata");
  const theme = await NodeFSP.readFile(new URL("../../themes/coco.json", import.meta.url), "utf8");
  await NodeFSP.mkdir(NodePath.join(stateDir, "themes"), { recursive: true });
  const seed = async (name: string, content: string) => {
    try {
      await NodeFSP.writeFile(NodePath.join(stateDir, name), content, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
  };
  await seed("themes/coco.json", theme);
  await seed(
    "settings.json",
    JSON.stringify({ defaultTheme: "coco", defaultThemeSetAt: "2026-09-09T00:00:00.000Z" }),
  );
}
