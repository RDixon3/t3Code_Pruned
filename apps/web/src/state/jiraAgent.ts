import { Atom } from "effect/unstable/reactivity";
export const jiraAgentStatus = Atom.make("Jira chat tools are not connected.").pipe(Atom.keepAlive);
