// @effect-diagnostics nodeBuiltinImport:off - Tests exercise optional root env files.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { loadRepoEnv } from "./public-config.ts";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    NodeFS.rmSync(directory, { recursive: true, force: true });
  }
});
function temporaryRepository() {
  const directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "coco-build-env-"));
  temporaryDirectories.push(directory);
  return directory;
}
it("starts with no external-service configuration", () => {
  expect(loadRepoEnv({ baseEnv: {}, repoRoot: temporaryRepository() })).toEqual({});
});
it("applies process, local, and root environment precedence", () => {
  const repoRoot = temporaryRepository();
  NodeFS.writeFileSync(
    NodePath.join(repoRoot, ".env"),
    "T3CODE_PORT=3773\nBUILD_VALUE=root\nROOT_ONLY=keep\n",
  );
  NodeFS.writeFileSync(
    NodePath.join(repoRoot, ".env.local"),
    "T3CODE_PORT=3774\nBUILD_VALUE=local\n",
  );
  expect(loadRepoEnv({ repoRoot, baseEnv: { T3CODE_PORT: "3775" } })).toEqual({
    T3CODE_PORT: "3775",
    BUILD_VALUE: "local",
    ROOT_ONLY: "keep",
  });
});
