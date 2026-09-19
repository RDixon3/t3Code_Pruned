import type { PickedElementPayload, PickedElementStackFrame } from "@t3tools/contracts";

export const ELEMENT_CONTEXT_ATTRIBUTE = "data-coco-element-context";
export const ELEMENT_CONTEXT_FUNCTION = "__cocoReadElementContext";
export type ElementContext = Pick<
  PickedElementPayload,
  "selector" | "htmlPreview" | "componentName" | "source" | "stack" | "styles"
>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
const text = (value: unknown, limit: number): string | null =>
  typeof value === "string" ? value.slice(0, limit) : null;
const coordinate = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

/** Page-owned objects stay in the page. Only bounded, plain inspection data crosses back. */
export function normalizeElementContext(value: unknown): ElementContext | null {
  const context = record(value);
  if (!context) return null;
  const stack: PickedElementStackFrame[] = [];
  if (Array.isArray(context.stack)) {
    for (const raw of context.stack.slice(0, 30)) {
      const frame = record(raw);
      if (!frame) continue;
      stack.push({
        functionName: text(frame.functionName, 500),
        fileName: text(frame.fileName, 2_000),
        lineNumber: coordinate(frame.lineNumber),
        columnNumber: coordinate(frame.columnNumber),
      });
    }
  }
  return {
    selector: text(context.selector, 4_000),
    htmlPreview: text(context.htmlPreview, 8_000) ?? "",
    componentName: text(context.componentName, 500),
    source: stack[0] ?? null,
    stack,
    styles: text(context.styles, 16_000) ?? "",
  };
}
