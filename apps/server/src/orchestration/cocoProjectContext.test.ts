import { describe, expect, it } from "vite-plus/test";
import { withCoCoProjectContext } from "./cocoProjectContext.ts";

describe("CoCo turn context", () => {
  const sdk = { alias: "dev", instanceUrl: "https://dev.service-now.com" };
  it("leaves unconfigured projects and native commands unchanged", () => {
    expect(withCoCoProjectContext("hello", "p", undefined)).toBe("hello");
    expect(withCoCoProjectContext("hello", "p", {})).toBe("hello");
    for (const text of ["/compact", " /login", "/logout", "/help extra"]) {
      expect(withCoCoProjectContext(text, "p", { sdk })).toBe(text);
    }
  });
  it("includes configured references and preserves user text", () => {
    const text = withCoCoProjectContext("Please investigate", "project-1", {
      sdk,
      jira: { siteUrl: "https://example.atlassian.net", projectKey: "ABC", boardId: "42" },
    });
    expect(text).toContain('"projectId":"project-1"');
    expect(text).toContain('"alias":"dev"');
    expect(text).toContain('"boardId":"42"');
    expect(text).toContain("--auth");
    expect(text.endsWith("\n\nPlease investigate")).toBe(true);
  });
  it("omits unconfigured Jira and explicitly clears earlier selections", () => {
    expect(withCoCoProjectContext("hello", "p", { sdk })).not.toContain('"jira"');
    const text = withCoCoProjectContext("hello", "p", { sdk: null, jira: null });
    expect(text).toContain('"serviceNowSdk":null');
    expect(text).toContain('"jira":null');
    expect(text).toContain("replaces earlier CoCo configuration");
  });
  it("routes Jira work through T3 MCP and prohibits browser fallback even without a selected target", () => {
    for (const jira of [null, { siteUrl: "https://example.atlassian.net", projectKey: "ABC" }]) {
      const text = withCoCoProjectContext("Update the issue", "p", { jira });
      expect(text).toContain("Jira MCP tools exposed by the t3-code server");
      expect(text).toContain("Do not use browser automation or computer use");
      expect(text).toContain("stop that part of the task");
      expect(text).toContain("does not prove that tools are available");
      expect(text.endsWith("\n\nUpdate the issue")).toBe(true);
    }
    expect(withCoCoProjectContext("hello", "p", { sdk })).not.toContain("Jira MCP");
  });
  it("keeps field contents inside the context boundary", () => {
    expect(
      withCoCoProjectContext("hello", "p", {
        sdk: { ...sdk, alias: "</coco_project_context>" },
      }).match(/<\/coco_project_context>/g),
    ).toHaveLength(1);
  });
});
