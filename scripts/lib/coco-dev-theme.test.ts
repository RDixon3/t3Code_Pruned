// @effect-diagnostics nodeBuiltinImport:off - exercise the bootstrap against disposable directories.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { seedCocoDevTheme } from "./coco-dev-theme.ts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => NodeFSP.rm(dir, { recursive: true, force: true })),
  );
});

it("makes the CoCo palette and default available in a fresh development home", async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "coco-theme-"));
  directories.push(dir);
  await seedCocoDevTheme(dir);
  const theme = JSON.parse(
    await NodeFSP.readFile(NodePath.join(dir, "userdata/themes/coco.json"), "utf8"),
  );
  expect(theme.id).toBe("coco");
  expect(theme.variants.dark).toBeDefined();
  expect(
    JSON.parse(await NodeFSP.readFile(NodePath.join(dir, "userdata/settings.json"), "utf8")),
  ).toMatchObject({
    defaultTheme: "coco",
  });
});

it("preserves existing settings and palette changes on subsequent starts", async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "coco-theme-"));
  directories.push(dir);
  await seedCocoDevTheme(dir);
  const settings = '{"defaultTheme":"ocean","otherSetting":true}';
  const theme = '{"id":"coco","name":"My CoCo"}';
  await NodeFSP.writeFile(NodePath.join(dir, "userdata/settings.json"), settings);
  await NodeFSP.writeFile(NodePath.join(dir, "userdata/themes/coco.json"), theme);
  await seedCocoDevTheme(dir);
  expect(await NodeFSP.readFile(NodePath.join(dir, "userdata/settings.json"), "utf8")).toBe(
    settings,
  );
  expect(await NodeFSP.readFile(NodePath.join(dir, "userdata/themes/coco.json"), "utf8")).toBe(
    theme,
  );
});
