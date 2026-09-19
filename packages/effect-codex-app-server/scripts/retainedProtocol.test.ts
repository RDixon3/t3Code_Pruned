import { describe, expect, it } from "@effect/vitest";
import { retainSchemas } from "./retainedProtocol.ts";

describe("retained protocol dependency closure", () => {
  it("keeps shared and recursive dependencies while removing unused operations", () => {
    const entries = new Map([
      ["Leaf", "export const Leaf = Schema.String;"],
      ["History", "export const History = Schema.Array(Leaf);"],
      ["Turn", "export const Turn = Schema.Struct({ history: History, child: Turn });"],
      ["Unused", "export const Unused = Schema.Struct({ leaf: Leaf });"],
    ]);
    expect([...retainSchemas(entries, ["Turn", "Leaf"]).keys()]).toEqual([
      "Leaf",
      "History",
      "Turn",
    ]);
  });

  it("rejects a stale compatibility root instead of silently dropping it", () => {
    expect(() => retainSchemas(new Map(), ["Missing"])).toThrow("Missing");
  });
});
