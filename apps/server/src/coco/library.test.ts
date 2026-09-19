// @effect-diagnostics nodeBuiltinImport:off
import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import * as NodePath from "node:path";
import { readAgents, resolveAgent, agentInstructions, skillDestinations } from "./library.ts";
describe("CoCo library", () => {
  it("loads neutral personas and leaves the default agent unchanged", async () => {
    expect((await readAgents()).map((agent) => agent.id)).toEqual(["build", "manage", "pursuit"]);
    expect(await resolveAgent(undefined)).toBeUndefined();
    expect(agentInstructions(null)).toBeUndefined();
    await expect(resolveAgent("missing")).rejects.toThrow("unavailable");
    const agent = await resolveAgent("manage");
    expect(agentInstructions({ ...agent!, skills: ["coco-example"] })).toContain("coco-example");
  });
  it("uses native homes and deduplicates shared Codex/Cursor destinations", () => {
    const base = {
      HOME: NodePath.resolve("test-home"),
      CLAUDE_CONFIG_DIR: NodePath.resolve("claude-home"),
    };
    expect(skillDestinations(DEFAULT_SERVER_SETTINGS, base)).toEqual(
      [NodePath.resolve("claude-home/skills"), NodePath.resolve("test-home/.agents/skills")].sort(),
    );
    const settings = {
      ...DEFAULT_SERVER_SETTINGS,
      providers: {
        ...DEFAULT_SERVER_SETTINGS.providers,
        claudeAgent: {
          ...DEFAULT_SERVER_SETTINGS.providers.claudeAgent,
          homePath: "~/custom-claude",
        },
      },
    };
    expect(skillDestinations(settings, base)).toContain(
      NodePath.resolve("test-home/custom-claude/skills"),
    );
  });
});
