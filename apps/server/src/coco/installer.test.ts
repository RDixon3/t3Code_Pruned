// @effect-diagnostics nodeBuiltinImport:off
import { afterEach, describe, expect, it } from "vite-plus/test";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { synchronizeSkills, readManifest } from "./installer.ts";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await NodeFSP.rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "coco-installer-"));
  roots.push(root);
  const source = NodePath.join(root, "source");
  const destinations = [NodePath.join(root, "agents/skills"), NodePath.join(root, "claude/skills")];
  await NodeFSP.mkdir(source);
  const add = async (name = "coco-test", text = "Version one") => {
    const dir = NodePath.join(source, name);
    await NodeFSP.mkdir(NodePath.join(dir, "scripts"), { recursive: true });
    await NodeFSP.writeFile(
      NodePath.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: Test skill\n---\n${text}`,
    );
    await NodeFSP.writeFile(NodePath.join(dir, "scripts/run.js"), "console.log('hello')");
    await NodeFSP.writeFile(NodePath.join(dir, "asset.bin"), Buffer.from([0, 255, 2]));
  };
  return {
    root,
    source,
    destinations,
    manifestPath: NodePath.join(root, "state/skills.json"),
    add,
  };
}
describe("CoCo skill installation", () => {
  it("copies full packages, skips unchanged installs, updates and removes only managed skills", async () => {
    const f = await fixture();
    await f.add();
    expect(await synchronizeSkills(f)).toBe(2);
    const installed = NodePath.join(f.destinations[0]!, "coco-test");
    expect(await NodeFSP.readFile(NodePath.join(installed, "asset.bin"))).toEqual(
      Buffer.from([0, 255, 2]),
    );
    expect(await NodeFSP.readFile(NodePath.join(installed, "scripts/run.js"), "utf8")).toContain(
      "hello",
    );
    const before = await NodeFSP.stat(NodePath.join(installed, "SKILL.md"));
    await synchronizeSkills(f);
    expect((await NodeFSP.stat(NodePath.join(installed, "SKILL.md"))).mtimeMs).toBe(before.mtimeMs);
    await f.add("coco-test", "Version two");
    await synchronizeSkills(f);
    expect(await NodeFSP.readFile(NodePath.join(installed, "SKILL.md"), "utf8")).toContain(
      "Version two",
    );
    await NodeFSP.mkdir(NodePath.join(f.destinations[0]!, "personal"));
    expect(await synchronizeSkills({ ...f, remove: true })).toBe(0);
    await expect(NodeFSP.stat(installed)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await NodeFSP.stat(NodePath.join(f.destinations[0]!, "personal"))).isDirectory()).toBe(
      true,
    );
  });
  it("removes packages retired from the library and old configured destinations", async () => {
    const f = await fixture();
    await f.add();
    await f.add("coco-retired");
    await synchronizeSkills(f);
    await NodeFSP.rm(NodePath.join(f.source, "coco-retired"), { recursive: true });
    expect(await synchronizeSkills({ ...f, destinations: [f.destinations[1]!] })).toBe(1);
    await expect(
      NodeFSP.stat(NodePath.join(f.destinations[0]!, "coco-test")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      NodeFSP.stat(NodePath.join(f.destinations[1]!, "coco-retired")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
  it("preserves user collisions and records successful installs before a later failure", async () => {
    const f = await fixture();
    await f.add();
    const collision = NodePath.join(f.destinations[1]!, "coco-test");
    await NodeFSP.mkdir(collision, { recursive: true });
    await NodeFSP.writeFile(NodePath.join(collision, "SKILL.md"), "User content");
    await expect(synchronizeSkills(f)).rejects.toThrow("existing user skill");
    expect(Object.keys(await readManifest(f.manifestPath))).toContain(f.destinations[0]);
    expect(await NodeFSP.readFile(NodePath.join(collision, "SKILL.md"), "utf8")).toBe(
      "User content",
    );
    await synchronizeSkills({ ...f, remove: true });
    await expect(
      NodeFSP.stat(NodePath.join(f.destinations[0]!, "coco-test")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await NodeFSP.readFile(NodePath.join(collision, "SKILL.md"), "utf8")).toBe(
      "User content",
    );
  });
  it("removes managed staging leftovers when an installation is cancelled", async () => {
    const f = await fixture();
    await f.add();
    await synchronizeSkills(f);
    const { rename } = await import("node:fs/promises");
    const destination = NodePath.join(f.destinations[0]!, "coco-test");
    await rename(destination, destination + ".coco-next");
    await synchronizeSkills({ ...f, remove: true });
    await expect(NodeFSP.stat(destination + ".coco-next")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("recovers an interrupted package swap", async () => {
    const f = await fixture();
    await f.add();
    await synchronizeSkills(f);
    const { rename } = await import("node:fs/promises");
    const destination = NodePath.join(f.destinations[0]!, "coco-test");
    await rename(destination, destination + ".coco-previous");
    await synchronizeSkills(f);
    expect(await NodeFSP.readFile(NodePath.join(destination, "SKILL.md"), "utf8")).toContain(
      "Version one",
    );
  });
  it("rejects malformed or unnamespaced packages before writing destinations", async () => {
    const f = await fixture();
    await f.add("user-test");
    await expect(synchronizeSkills(f)).rejects.toThrow("Invalid managed skill name");
    await expect(NodeFSP.stat(f.destinations[0]!)).rejects.toMatchObject({ code: "ENOENT" });
    await NodeFSP.rm(NodePath.join(f.source, "user-test"), { recursive: true });
    await f.add();
    await NodeFSP.writeFile(NodePath.join(f.source, "coco-test/SKILL.md"), "missing metadata");
    await expect(synchronizeSkills(f)).rejects.toThrow("Invalid SKILL.md");
  });
});
