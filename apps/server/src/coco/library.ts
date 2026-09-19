// @effect-diagnostics nodeBuiltinImport:off
import { CoCoAgent, type ServerSettings } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import * as NodeFSP from "node:fs/promises";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeOS from "node:os";
import { parse } from "yaml";
import { mergeProviderInstanceEnvironment } from "../provider/ProviderInstanceEnvironment.ts";

const decodeAgent = Schema.decodeUnknownSync(CoCoAgent);
const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
export const libraryRoot = NodeFS.existsSync(NodePath.join(here, "coco"))
  ? NodePath.join(here, "coco")
  : NodePath.resolve(here, "../../../../coco");
export async function readAgents(root = libraryRoot): Promise<readonly CoCoAgent[]> {
  const files = await NodeFSP.readdir(NodePath.join(root, "agents"));
  const agents = await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map(async (file) => {
        const text = await NodeFSP.readFile(NodePath.join(root, "agents", file), "utf8");
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
        if (!match) throw new Error(`Invalid agent definition: ${file}`);
        const metadata: unknown = parse(match[1]!);
        if (!metadata || typeof metadata !== "object")
          throw new Error(`Invalid agent metadata: ${file}`);
        const agent = decodeAgent({
          ...metadata,
          prompt: match[2]!.trim(),
        });
        if (!/^[a-z0-9][a-z0-9-]*$/.test(agent.id)) throw new Error(`Invalid agent ID: ${file}`);
        return agent;
      }),
  );
  if (new Set(agents.map((agent) => agent.id)).size !== agents.length)
    throw new Error("Duplicate CoCo agent IDs.");
  return agents;
}
export async function resolveAgent(id: string | undefined) {
  if (!id) return undefined;
  const agent = (await readAgents()).find((entry) => entry.id === id);
  if (!agent)
    throw new Error(`CoCo agent '${id}' is unavailable. Select another agent before sending.`);
  return agent;
}
export function agentInstructions(agent: CoCoAgent | null | undefined): string | undefined {
  if (!agent) return undefined;
  return `<coco_agent>\n${agent.prompt}${agent.skills.length ? `\nRecommended installed skills: ${agent.skills.join(", ")}. Use relevant skills through this harness's normal skill support.` : ""}\n</coco_agent>`;
}

export function skillDestinations(settings: ServerSettings, base = process.env): string[] {
  const roots = new Set<string>();
  const add = (env: NodeJS.ProcessEnv, claudeHome?: string) => {
    const home = env.HOME?.trim() || env.USERPROFILE?.trim() || NodeOS.homedir();
    roots.add(NodePath.resolve(home, ".agents/skills"));
    if (claudeHome !== undefined) {
      const target =
        claudeHome.trim() || env.CLAUDE_CONFIG_DIR?.trim() || NodePath.join(home, ".claude");
      roots.add(NodePath.resolve(target.replace(/^~(?=[/\\]|$)/, home), "skills"));
    }
  };
  add(base, settings.providers.claudeAgent.homePath);
  for (const instance of Object.values(settings.providerInstances)) {
    if (instance.enabled === false || !["codex", "claudeAgent", "cursor"].includes(instance.driver))
      continue;
    const env = mergeProviderInstanceEnvironment(instance.environment, base);
    const config = instance.config;
    const homePath =
      config &&
      typeof config === "object" &&
      "homePath" in config &&
      typeof config.homePath === "string"
        ? config.homePath
        : "";
    add(env, instance.driver === "claudeAgent" ? homePath : undefined);
  }
  return [...roots].sort();
}

/** Read complete portable packages; never traverse filesystem links. */
export async function packageFiles(
  root: string,
  relative = "",
): Promise<{ path: string; bytes: Buffer; mode: number }[]> {
  const result: { path: string; bytes: Buffer; mode: number }[] = [];
  for (const name of (await NodeFSP.readdir(NodePath.join(root, relative))).sort()) {
    const path = NodePath.join(relative, name);
    const stat = await NodeFSP.lstat(NodePath.join(root, path));
    if (stat.isSymbolicLink())
      throw new Error(`Skill packages cannot contain symbolic links: ${path}`);
    if (stat.isDirectory()) result.push(...(await packageFiles(root, path)));
    else if (stat.isFile())
      result.push({
        path,
        bytes: await NodeFSP.readFile(NodePath.join(root, path)),
        mode: stat.mode,
      });
  }
  return result;
}
