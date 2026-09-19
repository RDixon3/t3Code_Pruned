import { describe, expect, it } from "vite-plus/test";
import { articleHeadings, headingId, resolveHelpLink, searchHelp } from "./search";

describe("help search", () => {
  it.each([
    ["story points missing", "manage", "story-points-missing"],
    ["Jira connected but chat cannot use it", "jira", "jira-connected-but-chat-cannot-use-it"],
    ["Jira tools missing", "jira", "jira-connected-but-chat-cannot-use-it"],
    ["change ServiceNow account", "servicenow", undefined],
    ["repo saved no updates", "agents", "define-the-future-content-repository"],
    ["where does the agent run", "technical", "where-does-the-agent-run"],
    ["background activity", "settings", "general-background-activity"],
    ["capture shortcut", "snapshots", "change-the-capture-shortcut"],
    ["custom model", "providers", undefined],
    ["restore stashed prompt", "chat-context", "save-a-prompt-with-stash"],
    ["WSL backend", "connections", "use-wsl-on-windows"],
    ["backup", "technical", undefined],
    ["model prices", "providers", "set-custom-model-prices"],
    ["usage cost", "providers", "read-usage-and-estimated-cost"],
    ["account limits", "providers", "read-account-limits"],
  ])("finds the right guidance for %s", (query, articleId, anchor) => {
    const result = searchHelp(query!)[0];
    expect(result?.article.id).toBe(articleId);
    if (anchor) expect(result?.anchor).toBe(anchor);
    expect(result?.excerpt.trim()).toBeTruthy();
    if (result?.anchor) {
      expect(articleHeadings(result.article.text).map((heading) => heading.id)).toContain(
        result.anchor,
      );
    }
  });

  it("handles blank queries, absent terms, and case and punctuation consistently", () => {
    expect(searchHelp("")).toEqual([]);
    expect(searchHelp(" \t\n ")).toEqual([]);
    expect(searchHelp("???")).toEqual([]);
    expect(searchHelp("xylophone-unlisted-term")).toEqual([]);
    expect(searchHelp(" STORY   POINTS, missing! ")).toEqual(searchHelp("story points missing"));
  });

  it.each([
    ["How do I change my ServiceNow account?", "change ServiceNow account", "servicenow"],
    ["Why are my story points missing?", "story points missing", "manage"],
    ["Where does the agent run?", "agent run", "technical"],
    ["How do I select a profile?", "select profile", "servicenow"],
  ])("understands the natural question %s", (question, keywords, articleId) => {
    expect(searchHelp(question)).toEqual(searchHelp(keywords));
    const result = searchHelp(question)[0];
    expect(result?.article.id).toBe(articleId);
    expect(result?.anchor).toBeTruthy();
  });

  it("retains negation and the To Do category instead of stripping meaningful words", () => {
    expect(searchHelp("not").length).toBeGreaterThan(0);
    expect(searchHelp("no").length).toBeGreaterThan(0);
    expect(searchHelp("To Do").some((result) => result.article.id === "manage")).toBe(true);
    expect(searchHelp("How do I?")).toEqual([]);
  });

  it("returns each article once and opens an existing section or article beginning", () => {
    const results = searchHelp("Jira");
    expect(results.length).toBeGreaterThan(1);
    expect(new Set(results.map((result) => result.article.id)).size).toBe(results.length);
    for (const result of results) {
      expect(result.excerpt.trim()).not.toBe("");
      expect(["", ...articleHeadings(result.article.text).map((heading) => heading.id)]).toContain(
        result.anchor,
      );
    }
  });
});

describe("help headings and links", () => {
  it("creates stable section IDs from punctuation, CRLF text, and non-ASCII letters", () => {
    expect(headingId("  Who owns credentials & stored data?  ")).toBe(
      "who-owns-credentials-stored-data",
    );
    expect(
      articleHeadings("# Guide\r\n\r\n## First step\r\nText\r\n## Cafés & résumé\r\n"),
    ).toEqual([
      { title: "First step", id: "first-step" },
      { title: "Cafés & résumé", id: "cafés-résumé" },
    ]);
  });

  it("resolves relative and same-article links without treating external URLs as articles", () => {
    expect(resolveHelpLink("./jira.md#connect-with-sso", "build")).toEqual({
      articleId: "jira",
      hash: "connect-with-sso",
    });
    expect(resolveHelpLink("#connect-with-sso", "jira")).toEqual({
      articleId: "jira",
      hash: "connect-with-sso",
    });
    expect(resolveHelpLink("agents.md", "build")).toEqual({ articleId: "agents", hash: "" });
    expect(resolveHelpLink("unknown.md", "build")).toBeNull();
    expect(resolveHelpLink("https://example.com/jira.md", "build")).toBeNull();
    expect(resolveHelpLink("/settings/agents", "build")).toBeNull();
  });
});
