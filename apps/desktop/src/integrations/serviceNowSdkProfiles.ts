import type { ServiceNowSdkProfile } from "@t3tools/contracts";
import * as NodeUtil from "node:util";

/** Parse the SDK's public `auth --list` output, not its credential store. */
export function parseServiceNowSdkProfiles(output: string): ServiceNowSdkProfile[] {
  const lines = NodeUtil.stripVTControlCharacters(output).split(/\r?\n/);
  const profiles: ServiceNowSdkProfile[] = [];
  let alias: string | undefined;
  let instanceUrl: string | undefined;
  const finish = () => {
    if (alias === undefined) return;
    if (!instanceUrl || profiles.some((profile) => profile.alias === alias)) {
      throw new Error(
        "Unrecognized ServiceNow SDK profile listing. Refresh after checking now-sdk auth --list.",
      );
    }
    const url = new URL(instanceUrl);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Invalid ServiceNow SDK instance URL.");
    }
    profiles.push({ alias, instanceUrl });
  };
  for (const line of lines) {
    const header = /^\s*\*?\[([^\]]+)\]\s*$/.exec(line);
    if (header) {
      finish();
      alias = header[1]?.trim();
      if (!alias) throw new Error("Empty ServiceNow SDK alias.");
      instanceUrl = undefined;
    } else if (alias !== undefined) {
      const host = /^\s*host\s*=\s*(\S+)\s*$/.exec(line);
      if (host) instanceUrl = host[1];
    }
  }
  finish();
  if (!profiles.length && !output.includes("No credentials found")) {
    throw new Error("Unrecognized ServiceNow SDK profile listing.");
  }
  return profiles;
}
