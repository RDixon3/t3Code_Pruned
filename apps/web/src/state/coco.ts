import { WS_METHODS } from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { connectionAtomRuntime } from "../connection/runtime";
export const cocoLibrary = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "coco:library",
  tag: WS_METHODS.cocoGetLibrary,
  staleTimeMs: 60_000,
});
export const cocoSkillsAction = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "coco:skills",
  tag: WS_METHODS.cocoSkillsAction,
});

export const cocoGenerateFocus = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "coco:focus",
  tag: WS_METHODS.cocoGenerateFocus,
});
