import { getElementContext } from "react-grab/primitives";
import { getDisplayName, isCompositeFiber } from "bippy";
import { getOwnerStack } from "bippy/source";
import {
  ELEMENT_CONTEXT_ATTRIBUTE,
  ELEMENT_CONTEXT_FUNCTION,
  normalizeElementContext,
} from "./preview/ElementContext.ts";

// This bundle runs only in the preview page's JavaScript world. It has no
// Electron imports, IPC, filesystem access, or reference to the isolated preload.
Object.defineProperty(globalThis, ELEMENT_CONTEXT_FUNCTION, {
  configurable: true,
  value: async (marker: string) => {
    const element = document.querySelector(`[${ELEMENT_CONTEXT_ATTRIBUTE}="${marker}"]`);
    if (!element) return null;
    const context = await getElementContext(element);
    // The inspector is loaded on demand, after React may have mounted without a
    // DevTools hook. Read existing fibers with react-grab's own inspection library
    // in that case; do not install continuous instrumentation or expose the preload.
    if (context.fiber && !context.componentName) {
      for (let fiber = context.fiber.return; fiber; fiber = fiber.return) {
        if (!isCompositeFiber(fiber)) continue;
        const name = getDisplayName(fiber.type);
        if (name) {
          context.componentName = name;
          break;
        }
      }
      if (context.stack.length === 0)
        context.stack = await getOwnerStack(context.fiber).catch(() => []);
    }
    return normalizeElementContext(context);
  },
});
