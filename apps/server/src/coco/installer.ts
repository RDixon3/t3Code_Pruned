// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import * as Schema from "effect/Schema";
import { parse } from "yaml";
import { packageFiles } from "./library.ts";

const Manifest = Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.String));
type Manifest = typeof Manifest.Type;
const decodeManifest = Schema.decodeUnknownSync(Manifest);
async function stat(path: string) {
  try {
    return await NodeFSP.lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function readManifest(path: string): Promise<Manifest> {
  return (await stat(path)) ? decodeManifest(JSON.parse(await NodeFSP.readFile(path, "utf8"))) : {};
}
export function installedCount(manifest: Manifest) {
  return Object.values(manifest).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
}
function target(root: string, name: string) {
  if (!/^coco-[a-z0-9-]+$/.test(name)) throw new Error(`Invalid managed skill name: ${name}`);
  return NodePath.join(NodePath.resolve(root), name);
}
async function ownedDirectory(path: string) {
  const info = await stat(path);
  if (!info) return false;
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    !(await stat(NodePath.join(path, ".coco-managed")))
  ) {
    throw new Error(`Refusing to overwrite an existing user skill: ${path}`);
  }
  return true;
}
/** The service serializes updates. Ownership is recorded before swapping a package so interrupted installs can recover. */
export async function synchronizeSkills(input: {
  source: string;
  manifestPath: string;
  destinations: readonly string[];
  remove?: boolean;
}) {
  const manifest: Record<string, Record<string, string>> = Object.fromEntries(
    Object.entries(await readManifest(input.manifestPath)).map(([root, entries]) => [
      root,
      { ...entries },
    ]),
  );
  const packages = new Map<
    string,
    { hash: string; files: Awaited<ReturnType<typeof packageFiles>> }
  >();
  if (!input.remove) {
    for (const entry of await NodeFSP.readdir(input.source, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error(`Skill packages cannot contain symbolic links: ${entry.name}`);
      if (!entry.isDirectory()) continue;
      target(input.source, entry.name);
      const files = await packageFiles(NodePath.join(input.source, entry.name));
      const skill = files.find((file) => file.path === "SKILL.md");
      const metadata: unknown =
        skill && parse(/^---\r?\n([\s\S]*?)\r?\n---/.exec(skill.bytes.toString("utf8"))?.[1] ?? "");
      if (
        !metadata ||
        typeof metadata !== "object" ||
        !("name" in metadata) ||
        metadata.name !== entry.name ||
        !("description" in metadata) ||
        typeof metadata.description !== "string" ||
        !metadata.description.trim()
      )
        throw new Error(`Invalid SKILL.md in ${entry.name}`);
      const hash = NodeCrypto.createHash("sha256");
      for (const file of files)
        hash
          .update(file.path)
          .update("\0")
          .update(String(file.mode & 0o777))
          .update("\0")
          .update(file.bytes);
      packages.set(entry.name, { hash: hash.digest("hex"), files });
    }
  }
  const save = async () => {
    await NodeFSP.mkdir(NodePath.dirname(input.manifestPath), { recursive: true });
    await NodeFSP.writeFile(input.manifestPath + ".tmp", JSON.stringify(manifest));
    await NodeFSP.rename(input.manifestPath + ".tmp", input.manifestPath);
  };
  const destinations = new Set(input.destinations.map((root) => NodePath.resolve(root)));
  for (const root of new Set([...Object.keys(manifest), ...destinations])) {
    const wanted = !input.remove && destinations.has(root) ? packages : new Map<string, never>();
    const saved = manifest[root] ?? (manifest[root] = {});
    for (const name of new Set([...Object.keys(saved), ...wanted.keys()])) {
      const destination = target(root, name);
      const previous = destination + ".coco-previous";
      const staged = destination + ".coco-next";
      // Only manifest-owned backup directories are eligible for recovery.
      if (saved[name] && !(await stat(destination)) && (await ownedDirectory(previous)))
        await NodeFSP.rename(previous, destination);
      if (!saved[name] && (await stat(destination)))
        throw new Error(`Refusing to overwrite an existing user skill: ${destination}`);
      const owned = await ownedDirectory(destination);
      if (saved[name]) {
        for (const leftover of [staged, previous]) {
          if (await ownedDirectory(leftover)) await NodeFSP.rm(leftover, { recursive: true });
        }
      }
      const pkg = wanted.get(name);
      if (!pkg) {
        if (owned) await NodeFSP.rm(destination, { recursive: true });
        delete saved[name];
        await save();
        continue;
      }
      if (
        owned &&
        (await NodeFSP.readFile(NodePath.join(destination, ".coco-managed"), "utf8")).trim() ===
          pkg.hash
      )
        continue;
      await NodeFSP.mkdir(root, { recursive: true });
      // Interrupted staging directories carry our ownership marker too.
      if (await stat(staged)) {
        if (!saved[name] || !(await ownedDirectory(staged)))
          throw new Error(`Unmanaged staging directory: ${staged}`);
        await NodeFSP.rm(staged, { recursive: true });
      }
      saved[name] = pkg.hash;
      await save();
      await NodeFSP.mkdir(staged);
      await NodeFSP.writeFile(NodePath.join(staged, ".coco-managed"), pkg.hash);
      await NodeFSP.cp(NodePath.join(input.source, name), staged, {
        recursive: true,
        dereference: false,
      });
      for (const file of pkg.files)
        await NodeFSP.chmod(NodePath.join(staged, file.path), file.mode & 0o777);
      await NodeFSP.writeFile(NodePath.join(staged, ".coco-managed"), pkg.hash);
      if (await ownedDirectory(previous)) await NodeFSP.rm(previous, { recursive: true });
      if (owned) await NodeFSP.rename(destination, previous);
      try {
        await NodeFSP.rename(staged, destination);
      } catch (error) {
        if (owned) await NodeFSP.rename(previous, destination);
        throw error;
      }
      if (owned) await NodeFSP.rm(previous, { recursive: true });
    }
  }
  await save();
  return installedCount(manifest);
}
