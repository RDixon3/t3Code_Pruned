// @effect-diagnostics nodeBuiltinImport:off -- Exercises bootstrap writes in a disposable directory before an Effect runtime exists.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { assert, it } from "vite-plus/test";

import { prepareCoCoDataDirectory } from "./cocoReleaseBootstrap.ts";

it("seeds isolated CoCo state once and preserves settings and theme edits", () => {
  const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "coco-bootstrap-"));
  try {
    const directory = prepareCoCoDataDirectory(home);
    assert.equal(directory, NodePath.join(home, ".coco"));
    const state = NodePath.join(directory, "userdata");
    const settings = NodePath.join(state, "settings.json");
    const theme = NodePath.join(state, "themes/coco.json");
    assert.equal(JSON.parse(NodeFS.readFileSync(settings, "utf8")).defaultTheme, "coco");
    assert.equal(JSON.parse(NodeFS.readFileSync(theme, "utf8")).id, "coco");
    NodeFS.writeFileSync(settings, '{"defaultTheme":"custom"}');
    NodeFS.writeFileSync(theme, '{"id":"coco","name":"Edited"}');
    prepareCoCoDataDirectory(home);
    assert.equal(NodeFS.readFileSync(settings, "utf8"), '{"defaultTheme":"custom"}');
    assert.equal(NodeFS.readFileSync(theme, "utf8"), '{"id":"coco","name":"Edited"}');
    const configured = NodePath.join(home, "configured");
    assert.equal(prepareCoCoDataDirectory(home, configured), configured);
    assert.isTrue(NodeFS.existsSync(NodePath.join(configured, "userdata/settings.json")));
  } finally {
    NodeFS.rmSync(home, { recursive: true, force: true });
  }
});
