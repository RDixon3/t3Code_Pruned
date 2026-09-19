import { describe, expect, it } from "vite-plus/test";

import {
  appendContextItemsToPrompt,
  extractTrailingContextItems,
  type ContextItem,
} from "./contextItem";
import { contextItemsForTurn, remainingContextItems } from "./contextItemSubmission";

const item: ContextItem = {
  source: "catalog",
  sourceLabel: "Catalog",
  sourceScope: "workspace-one",
  recordId: "service-1",
  title: "Delivery service",
  kind: "service",
  content: "Owner: Maya",
};

describe("context item submission", () => {
  it.each(["/compact", " /compact keep recent errors ", "\n/login", "/logout", "/plan"])(
    "keeps %j unchanged and retains selected references for a later prompt",
    (prompt) => {
      const current = [item];
      const submitted = contextItemsForTurn(prompt, current);
      expect(appendContextItemsToPrompt(prompt, submitted)).toBe(prompt);
      expect(remainingContextItems(current, submitted)).toEqual(current);

      const nextSubmitted = contextItemsForTurn("Explain this service", current);
      expect(
        extractTrailingContextItems(
          appendContextItemsToPrompt("Explain this service", nextSubmitted),
        ),
      ).toEqual({ promptText: "Explain this service", items: current });
      expect(remainingContextItems(current, nextSubmitted)).toEqual([]);
    },
  );

  it.each(["", " ", "Explain /compact for this service"])(
    "sends references with ordinary or reference-only prompt %j",
    (prompt) => {
      const submitted = contextItemsForTurn(prompt, [item]);
      expect(extractTrailingContextItems(appendContextItemsToPrompt(prompt, submitted))).toEqual({
        promptText: prompt,
        items: [item],
      });
      expect(remainingContextItems([item], submitted)).toEqual([]);
    },
  );

  it("preserves new records and matching IDs from other sources or scopes", () => {
    const added = { ...item, recordId: "service-2" };
    const otherSource = { ...item, source: "inventory" };
    const otherScope = { ...item, sourceScope: "workspace-two" };
    const current = [item, added, otherSource, otherScope];
    expect(remainingContextItems(current, [item])).toEqual([added, otherSource, otherScope]);
    expect(current).toEqual([item, added, otherSource, otherScope]);
  });

  it.each([
    { sourceLabel: "Service catalog" },
    { title: "Renamed delivery service" },
    { kind: "offering" },
    { url: "https://example.com/services/1" },
    { content: "Owner: Jamie" },
    { capturedAt: "2026-09-12T15:00:00Z" },
  ])("retains a refreshed snapshot with changed metadata or content: %j", (update) => {
    const refreshed = { ...item, ...update };
    expect(remainingContextItems([refreshed], [item])).toEqual([refreshed]);
  });

  it("compares snapshots by field values regardless of object property order", () => {
    const reordered: ContextItem = {
      content: item.content,
      kind: item.kind,
      title: item.title,
      recordId: item.recordId,
      sourceScope: item.sourceScope,
      sourceLabel: item.sourceLabel,
      source: item.source,
    };
    expect(remainingContextItems([reordered], [item])).toEqual([]);
  });

  it("retains a snapshot when optional metadata was removed after submission", () => {
    const submitted = {
      ...item,
      url: "https://example.com/services/1",
      capturedAt: "2026-09-12T15:00:00Z",
    };
    expect(remainingContextItems([item], [submitted])).toEqual([item]);
    expect(remainingContextItems([{ ...submitted }], [submitted])).toEqual([]);
  });
});
