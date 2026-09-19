import { helpArticles } from "./content";
import { findHelpTopic } from "./catalog";

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}
export function articleHeadings(text: string) {
  return [...text.matchAll(/^## (.+)$/gm)].map((match) => ({
    title: match[1]!.trim(),
    id: headingId(match[1]!),
  }));
}
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const questionWords = new Set([
  "a",
  "an",
  "the",
  "i",
  "my",
  "me",
  "we",
  "our",
  "you",
  "your",
  "how",
  "what",
  "why",
  "when",
  "where",
  "do",
  "does",
  "did",
  "is",
  "are",
  "was",
  "were",
  "can",
  "could",
  "would",
  "should",
  "please",
  "to",
  "of",
  "for",
]);
function queryTerms(query: string) {
  const words = normalize(query).split(" ").filter(Boolean);
  return [
    ...new Set(
      words.filter(
        (word, index) =>
          // Preserve the board's "To Do" category and meaningful negations such as "not" and "no".
          !questionWords.has(word) ||
          (word === "to" && words[index + 1] === "do") ||
          (word === "do" && words[index - 1] === "to"),
      ),
    ),
  ];
}
const index = helpArticles.map((article) => ({
  article,
  title: normalize(article.title),
  aliases: normalize(article.aliases),
  sections: article.text.split(/(?=^## )/m).map((text) => {
    const title = /^## (.+)/.exec(text)?.[1] ?? article.title;
    const plain = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      anchor: title === article.title ? "" : headingId(title),
      plain,
      searchable: normalize(plain),
    };
  }),
}));
export function searchHelp(query: string) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  return index
    .flatMap(({ article, title, aliases, sections }) => {
      let best: { score: number; anchor: string; excerpt: string } | undefined;
      for (const section of sections) {
        const heading = section.anchor ? normalize(section.title) : "";
        if (!terms.every((term) => `${title} ${aliases} ${section.searchable}`.includes(term)))
          continue;
        const score = terms.reduce(
          (total, term) =>
            total +
            (title.includes(term) ? 12 : 0) +
            (heading.includes(term) ? 8 : 0) +
            (aliases.includes(term) ? 5 : 0) +
            (section.searchable.includes(term) ? (title.includes(term) ? 1 : 3) : 0),
          0,
        );
        const matchAt = Math.max(
          0,
          Math.min(
            ...terms
              .map((term) => section.plain.toLowerCase().indexOf(term))
              .filter((at) => at >= 0),
          ),
        );
        const start = Number.isFinite(matchAt) ? Math.max(0, matchAt - 40) : 0;
        const excerpt =
          (start ? "…" : "") +
          section.plain.slice(start, start + 160) +
          (section.plain.length > start + 160 ? "…" : "");
        if (
          !best ||
          score > best.score ||
          (score === best.score && !best.anchor && section.anchor)
        ) {
          best = { score, anchor: section.anchor, excerpt };
        }
      }
      return best ? [{ article, ...best }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
export function resolveHelpLink(href: string, currentId: string) {
  if (href.startsWith("#")) return { articleId: currentId, hash: href.slice(1) };
  const [file, hash = ""] = href.split("#");
  const id = file?.replace(/^\.\//, "").replace(/\.md$/, "");
  return id && findHelpTopic(id) ? { articleId: id, hash } : null;
}
