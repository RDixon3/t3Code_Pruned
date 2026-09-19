// @effect-diagnostics nodeBuiltinImport:off - validates bundled documentation links against route files.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { HELP_TOPICS } from "./catalog";
import { helpArticles, findHelpArticle } from "./content";
import { articleHeadings, resolveHelpLink } from "./search";

const settingsSources: Record<string, readonly string[]> = {
  "/settings/general": ["SettingsPanels.tsx", "settingsSearch.ts"],
  "/settings/integrations": [
    "JiraSettings.tsx",
    "V0Settings.tsx",
    "ServiceNowSdkSettings.tsx",
    "ServiceNowConnectionSettings.tsx",
  ],
  "/settings/appearance": ["SettingsPanels.tsx", "settingsSearch.ts"],
  "/settings/providers": ["ProviderSettingsPanel.tsx", "settingsSearch.ts"],
  "/settings/connections": ["ConnectionsSettings.tsx", "settingsSearch.ts"],
};

describe("bundled CoCo help", () => {
  it("registers every bundled guide with readable content and unique destinations", () => {
    const files = NodeFS.readdirSync(new URL("../../../../docs/user/coco/", import.meta.url))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3));
    expect(HELP_TOPICS.map((topic) => topic.id).toSorted()).toEqual(files.toSorted());
    expect(helpArticles).toHaveLength(HELP_TOPICS.length);
    expect(new Set(HELP_TOPICS.map((topic) => topic.id)).size).toBe(HELP_TOPICS.length);
    for (const article of helpArticles) {
      expect(article.text.trim(), article.id).not.toBe("");
      expect(article.text.match(/^# .+$/gm), article.id).toHaveLength(1);
      const headings = articleHeadings(article.text);
      expect(headings.length, article.id).toBeGreaterThan(0);
      expect(
        headings.every((heading) => heading.id.length > 0),
        article.id,
      ).toBe(true);
      expect(new Set(headings.map((heading) => heading.id)).size, article.id).toBe(headings.length);
    }
  });

  it("resolves every article link, section link, and Settings destination", () => {
    for (const article of helpArticles) {
      const links = [...article.text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)];
      for (const match of links) {
        const href = match[1]!;
        const description = `${article.id}: ${href}`;
        if (href.startsWith("https://")) {
          expect(new URL(href).hostname, description).not.toBe("");
          continue;
        }
        if (href.startsWith("/settings/")) {
          const [path, hash] = href.split("#");
          const routeFile = `${path!.slice(1).replaceAll("/", ".")}.tsx`;
          const route = NodeFS.readFileSync(
            new URL(`../routes/${routeFile}`, import.meta.url),
            "utf8",
          );
          expect(route, description).toContain(`createFileRoute("${path}")`);
          if (hash !== undefined) {
            expect(hash, description).not.toBe("");
            const source = (settingsSources[path!] ?? [])
              .map((file) =>
                NodeFS.readFileSync(
                  new URL(`../components/settings/${file}`, import.meta.url),
                  "utf8",
                ),
              )
              .join("\n");
            expect(source, description).toMatch(
              new RegExp(`(?:id=|searchableSetting\\()"${hash}"`),
            );
          }
          continue;
        }
        const target = resolveHelpLink(href, article.id);
        expect(target, description).not.toBeNull();
        const destination = findHelpArticle(target!.articleId);
        expect(destination, description).toBeDefined();
        if (href.includes("#")) {
          expect(target!.hash, description).not.toBe("");
          expect(
            articleHeadings(destination!.text).map((heading) => heading.id),
            description,
          ).toContain(target!.hash);
        }
      }
    }
  });
});
