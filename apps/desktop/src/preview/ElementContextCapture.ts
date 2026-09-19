import { ELEMENT_CONTEXT_FUNCTION, normalizeElementContext } from "./ElementContext.ts";

interface CaptureFrame {
  executeJavaScript: (code: string) => Promise<unknown>;
}
interface CaptureContents {
  readonly mainFrame: CaptureFrame;
}
interface CaptureEvent {
  readonly sender: unknown;
  readonly senderFrame: CaptureFrame | null;
}

/** The active picker can inspect a DOM marker, never supply code to execute. */
export function makeElementContextHandler(
  contents: CaptureContents,
  readRuntime: () => Promise<string>,
  isActive: () => boolean = () => true,
) {
  return async (event: CaptureEvent, marker: unknown) => {
    if (
      !isActive() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame ||
      typeof marker !== "string" ||
      !/^[a-f0-9-]{36}$/.test(marker)
    )
      return null;
    const frame = event.senderFrame;
    const runtime = await readRuntime();
    // Re-check after the read: navigation must not move a queued inspection to
    // another document. The result is page-controlled and decoded again here.
    if (!isActive() || frame !== contents.mainFrame) return null;
    const result = await frame.executeJavaScript(
      `${runtime}\n;globalThis.${ELEMENT_CONTEXT_FUNCTION}(${JSON.stringify(marker)})`,
    );
    return normalizeElementContext(result);
  };
}
