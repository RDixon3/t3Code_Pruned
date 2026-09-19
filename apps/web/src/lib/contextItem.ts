import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export const MAX_CONTEXT_ITEMS = 20;
export const MAX_CONTEXT_ITEM_TITLE_CHARS = 300;
export const MAX_CONTEXT_ITEM_CONTENT_CHARS = 8_000;
export const MAX_CONTEXT_ITEMS_CONTENT_CHARS = 32_000;

const label = (maxLength: number) =>
  Schema.String.check(
    Schema.isMaxLength(maxLength),
    Schema.makeFilter((value) => value.trim().length > 0),
  );

const ContextItemSchema = Schema.Struct({
  source: label(100),
  sourceLabel: label(100),
  sourceScope: label(500),
  recordId: label(300),
  title: label(MAX_CONTEXT_ITEM_TITLE_CHARS),
  kind: label(100),
  url: Schema.optionalKey(
    Schema.String.check(
      Schema.isMaxLength(2_048),
      Schema.makeFilter((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }),
    ),
  ),
  content: Schema.String.check(Schema.isMaxLength(MAX_CONTEXT_ITEM_CONTENT_CHARS)),
  capturedAt: Schema.optionalKey(
    Schema.String.check(
      Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/),
      Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
    ),
  ),
});
export type ContextItem = typeof ContextItemSchema.Type;

export function contextItemKey(
  item: Pick<ContextItem, "source" | "sourceScope" | "recordId">,
): string {
  return JSON.stringify([item.source, item.sourceScope, item.recordId]);
}

export const ContextItemsSchema = Schema.Array(ContextItemSchema).check(
  Schema.isMaxLength(MAX_CONTEXT_ITEMS),
  Schema.makeFilter(
    (items) =>
      items.reduce((total, item) => total + item.content.length, 0) <=
        MAX_CONTEXT_ITEMS_CONTENT_CHARS && new Set(items.map(contextItemKey)).size === items.length,
  ),
);

const decodeItem = Schema.decodeUnknownOption(ContextItemSchema);
const decodeItems = Schema.decodeUnknownSync(ContextItemsSchema);
const isContextItems = Schema.is(ContextItemsSchema);

/** Replaces an existing source record in place, without evicting other selected context. */
export function upsertContextItem(
  items: ReadonlyArray<ContextItem>,
  candidate: unknown,
): ContextItem[] | null {
  const decoded = decodeItem(candidate);
  if (Option.isNone(decoded)) return null;
  const item = decoded.value;
  const key = contextItemKey(item);
  const index = items.findIndex((existing) => contextItemKey(existing) === key);
  const nextItems = [...items];
  if (index === -1) nextItems.push(item);
  else nextItems[index] = item;
  return isContextItems(nextItems) ? nextItems : null;
}

/** Plans a restore before the stash is consumed; the whole result must fit. */
export function mergeContextItems(
  current: ReadonlyArray<ContextItem>,
  incoming: ReadonlyArray<ContextItem>,
): ContextItem[] | null {
  const items = new Map<string, ContextItem>();
  for (const candidate of [...current, ...incoming]) {
    const decoded = decodeItem(candidate);
    if (Option.isNone(decoded)) return null;
    items.set(contextItemKey(decoded.value), decoded.value);
  }
  const merged = [...items.values()];
  return isContextItems(merged) ? merged : null;
}

/** Recovers valid persisted snapshots; oversized or malformed entries are never truncated. */
export function normalizeContextItems(value: unknown): ContextItem[] {
  if (!Array.isArray(value)) return [];
  let items: ContextItem[] = [];
  for (const candidate of value) {
    items = upsertContextItem(items, candidate) ?? items;
  }
  return items;
}

const BLOCK_OPENING = '<context_items version="1">\n';
const BLOCK_START = `\n\n${BLOCK_OPENING}`;
const BLOCK_END = "\n</context_items>";
// JSON escapes use at most six characters per UTF-16 code unit, including metadata.
const MAX_BLOCK_CHARS = 6 * (MAX_CONTEXT_ITEMS_CONTENT_CHARS + MAX_CONTEXT_ITEMS * 3_600);
const decodeBlockItems = Schema.decodeUnknownOption(ContextItemsSchema, {
  onExcessProperty: "error",
});

/** The snapshot travels in ordinary prompt text, so every provider receives the same context. */
export function appendContextItemsToPrompt(
  prompt: string,
  items: ReadonlyArray<ContextItem>,
): string {
  if (items.length === 0) return prompt;
  // Reject invalid caller data instead of sending a partially stripped snapshot.
  const validItems = decodeItems(items);
  const json = JSON.stringify(validItems)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
  return `${prompt}${BLOCK_START}${json}${BLOCK_END}`;
}

/** Only a complete, supported, valid suffix can be hidden behind transcript context chips. */
export function extractTrailingContextItems(text: string): {
  promptText: string;
  items: ContextItem[];
} {
  const unchanged = { promptText: text, items: [] };
  if (!text.endsWith(BLOCK_END)) return unchanged;
  // Servers may trim a context-only prompt, removing the otherwise-required separator.
  const atStart = text.startsWith(BLOCK_OPENING);
  const index = atStart ? 0 : text.lastIndexOf(BLOCK_START);
  if (index === -1 || text.length - index > MAX_BLOCK_CHARS) return unchanged;
  try {
    const json = text.slice(
      index + (atStart ? BLOCK_OPENING.length : BLOCK_START.length),
      -BLOCK_END.length,
    );
    const decoded = decodeBlockItems(JSON.parse(json));
    if (Option.isNone(decoded) || decoded.value.length === 0) return unchanged;
    return { promptText: text.slice(0, index), items: [...decoded.value] };
  } catch {
    return unchanged;
  }
}
