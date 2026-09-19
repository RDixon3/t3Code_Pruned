import { Atom } from "effect/unstable/reactivity";
export const v0AgentStatus = Atom.make("v0 chat tools are not connected.").pipe(Atom.keepAlive);
