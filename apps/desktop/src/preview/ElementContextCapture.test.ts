import { describe, expect, it, vi } from "vite-plus/test";
import { makeElementContextHandler } from "./ElementContextCapture.ts";
import { normalizeElementContext } from "./ElementContext.ts";

const marker = "12345678-1234-1234-1234-123456789abc";
describe("isolated element inspection", () => {
  it("inspects the selected page element and returns component/source data without DOM or fiber objects", async () => {
    const context = {
      selector: "#save",
      htmlPreview: "<button>Save</button>",
      componentName: "SaveButton",
      stack: [
        {
          functionName: "SaveButton",
          fileName: "/src/Button.tsx",
          lineNumber: 12,
          columnNumber: 4,
        },
      ],
      styles: "color: red",
      fiber: { secret: true },
      element: { nodeType: 1 },
    };
    const frame = { executeJavaScript: vi.fn(async () => context) };
    const contents = { mainFrame: frame };
    const read = vi.fn(async () => "/* bundled browser inspector */");
    const result = await makeElementContextHandler(contents, read)(
      { sender: contents, senderFrame: frame },
      marker,
    );
    expect(result).toEqual({
      selector: "#save",
      htmlPreview: "<button>Save</button>",
      componentName: "SaveButton",
      stack: context.stack,
      source: context.stack[0],
      styles: "color: red",
    });
    expect(frame.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify(marker)),
    );
  });

  it("rejects another window, subframe, or code supplied in place of a DOM marker", async () => {
    const frame = { executeJavaScript: vi.fn(async () => null) };
    const contents = { mainFrame: frame };
    const read = vi.fn(async () => "runtime");
    const handler = makeElementContextHandler(contents, read);
    expect(await handler({ sender: {}, senderFrame: frame }, marker)).toBeNull();
    expect(await handler({ sender: contents, senderFrame: { ...frame } }, marker)).toBeNull();
    expect(
      await handler({ sender: contents, senderFrame: frame }, '");process.exit();//'),
    ).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(frame.executeJavaScript).not.toHaveBeenCalled();
  });

  it("does not execute after navigation replaces the main frame while the runtime loads", async () => {
    const frame = { executeJavaScript: vi.fn(async () => null) };
    const contents = { mainFrame: frame };
    const handler = makeElementContextHandler(contents, async () => {
      contents.mainFrame = { ...frame };
      return "runtime";
    });
    expect(await handler({ sender: contents, senderFrame: frame }, marker)).toBeNull();
    expect(frame.executeJavaScript).not.toHaveBeenCalled();
  });

  it("bounds page-controlled metadata and rejects invalid coordinate values", () => {
    const value = normalizeElementContext({
      selector: "x".repeat(10_000),
      htmlPreview: "h".repeat(20_000),
      styles: "s".repeat(30_000),
      componentName: {},
      stack: Array.from({ length: 50 }, () => ({
        lineNumber: Infinity,
        fileName: "f".repeat(3_000),
      })),
    });
    expect(value?.selector).toHaveLength(4_000);
    expect(value?.htmlPreview).toHaveLength(8_000);
    expect(value?.styles).toHaveLength(16_000);
    expect(value?.componentName).toBeNull();
    expect(value?.stack).toHaveLength(30);
    expect(value?.source?.fileName).toHaveLength(2_000);
    expect(value?.source?.lineNumber).toBeNull();
    expect(normalizeElementContext(null)).toBeNull();
  });

  it("drops a request if the picker is cancelled while its runtime loads", async () => {
    let active = true;
    const frame = { executeJavaScript: vi.fn(async () => null) };
    const contents = { mainFrame: frame };
    const handler = makeElementContextHandler(
      contents,
      async () => {
        active = false;
        return "runtime";
      },
      () => active,
    );
    expect(await handler({ sender: contents, senderFrame: frame }, marker)).toBeNull();
    expect(frame.executeJavaScript).not.toHaveBeenCalled();
  });
});
