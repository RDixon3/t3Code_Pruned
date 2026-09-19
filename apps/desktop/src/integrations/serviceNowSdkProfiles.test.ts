import { describe, expect, it } from "vite-plus/test";
import { parseServiceNowSdkProfiles } from "./serviceNowSdkProfiles.ts";

describe("SDK profile listing", () => {
  it.each(["\n", "\r\n"])("reads metadata with %j line endings and ANSI colors", (newline) => {
    const output = [
      "Listing all credentials:",
      "\x1b[36m*[dev]\x1b[39m",
      " host = https://dev.service-now.com",
      " type = oauth",
      " default = Yes",
      "[test]",
      " host = https://test.service-now.com",
      " username = user",
      " default = No",
    ].join(newline);
    expect(parseServiceNowSdkProfiles(output)).toEqual([
      { alias: "dev", instanceUrl: "https://dev.service-now.com" },
      { alias: "test", instanceUrl: "https://test.service-now.com" },
    ]);
  });
  it("accepts an explicitly empty listing", () => {
    expect(parseServiceNowSdkProfiles("[info] No credentials found\n")).toEqual([]);
  });
  it.each([
    "",
    "unexpected",
    "[dev]\n type = oauth",
    "[dev]\n host = bad",
    "[dev]\n host = https://user:password@host",
    "[]\n host = https://host",
  ])("rejects malformed output: %s", (output) => {
    expect(() => parseServiceNowSdkProfiles(output)).toThrow();
  });
});
