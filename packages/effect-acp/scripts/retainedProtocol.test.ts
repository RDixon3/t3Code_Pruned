import { describe, expect, it } from "@effect/vitest";
import { retainSchemas } from "./retainedProtocol.ts";

describe("retained ACP schema closure", () => {
  it("keeps transitive and cyclic references while excluding unused operations", () => {
    const entries = new Map([
      ["Prompt", "Prompt: Content"],
      ["Content", "Content: Text | Resource"],
      ["Text", "Text: string"],
      ["Resource", "Resource: Content"],
      ["Logout", "Logout: void"],
    ]);
    expect([...retainSchemas(entries, ["Prompt"]).keys()]).toEqual([
      "Prompt",
      "Content",
      "Text",
      "Resource",
    ]);
  });

  it("fails when a retained root disappears from the pinned upstream schema", () => {
    expect(() => retainSchemas(new Map(), ["Prompt"])).toThrow(
      "Unknown retained protocol schema: Prompt",
    );
  });
});
