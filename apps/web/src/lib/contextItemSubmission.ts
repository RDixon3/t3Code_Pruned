import { contextItemKey, type ContextItem } from "./contextItem";

/** Native slash commands leave selected references in the draft for the next prompt. */
export function contextItemsForTurn(prompt: string, items: ReadonlyArray<ContextItem>) {
  return prompt.trimStart().startsWith("/") ? [] : items;
}

/** Consume sent snapshots without dropping references added or refreshed during submission. */
export function remainingContextItems(
  current: ReadonlyArray<ContextItem>,
  submitted: ReadonlyArray<ContextItem>,
) {
  const submittedByKey = new Map(submitted.map((item) => [contextItemKey(item), item]));
  return current.filter((item) => {
    const snapshot = submittedByKey.get(contextItemKey(item));
    return (
      !snapshot ||
      item.sourceLabel !== snapshot.sourceLabel ||
      item.title !== snapshot.title ||
      item.kind !== snapshot.kind ||
      item.url !== snapshot.url ||
      item.content !== snapshot.content ||
      item.capturedAt !== snapshot.capturedAt
    );
  });
}
