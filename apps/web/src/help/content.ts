import { HELP_TOPICS } from "./catalog";

const sources = import.meta.glob("../../../../docs/user/coco/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
export const helpArticles = HELP_TOPICS.map((topic) => ({
  ...topic,
  text: sources[`../../../../docs/user/coco/${topic.id}.md`] ?? "",
}));
export const findHelpArticle = (id: string) => helpArticles.find((article) => article.id === id);
