import { JiraProjectSchema, JiraSiteSchema } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

const decodeResult = Schema.decodeUnknownSync(
  Schema.Struct({
    structuredContent: Schema.optionalKey(Schema.Unknown),
    content: Schema.optionalKey(Schema.Unknown),
    isError: Schema.optionalKey(Schema.Boolean),
  }),
);
const decodeSites = Schema.decodeUnknownSync(Schema.Array(JiraSiteSchema));
const decodeProjects = Schema.decodeUnknownSync(Schema.Array(JiraProjectSchema));

/** MCP tools may return structured data or JSON in text content. Never include payloads in errors. */
export function jiraToolData(value: unknown): unknown {
  let result;
  try {
    result = decodeResult(value);
  } catch {
    throw new Error("Jira discovery returned an unrecognized response.");
  }
  if (result.isError)
    throw new Error(
      "Jira discovery returned a tool error. Test the connection in Settings → Integrations.",
    );
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const text = result.content
      .filter(
        (item: unknown): item is { type: "text"; text: string } =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          item.type === "text" &&
          "text" in item &&
          typeof item.text === "string",
      )
      .map((item) => item.text)
      .join("\n");
    try {
      return JSON.parse(text);
    } catch {
      /* Report an actionable error without the response contents. */
    }
  }
  throw new Error("Jira discovery returned an unrecognized response.");
}

export function parseJiraSites(data: unknown) {
  try {
    return decodeSites(data).map((site) => {
      const url = new URL(site.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      return { ...site, url: url.origin };
    });
  } catch {
    throw new Error("Jira returned an unrecognized site list.");
  }
}

const Page = Schema.Struct({
  values: Schema.Array(JiraProjectSchema),
  startAt: Schema.optionalKey(Schema.Number),
  total: Schema.optionalKey(Schema.Number),
  isLast: Schema.optionalKey(Schema.Boolean),
});

const decodePage = Schema.decodeUnknownSync(Page);

export function parseJiraProjects(data: unknown, startAt: number) {
  try {
    if (Array.isArray(data))
      return {
        projects: decodeProjects(data),
        nextStartAt: null,
      };
    const page = decodePage(data);
    if (page.startAt !== undefined && page.startAt !== startAt) throw new Error();
    const next = startAt + page.values.length;
    const more =
      page.isLast === false ||
      (page.isLast !== true && page.total !== undefined && next < page.total);
    if (more && !page.values.length) throw new Error();
    return { projects: page.values, nextStartAt: more ? next : null };
  } catch {
    throw new Error("Jira returned an unrecognized project page.");
  }
}
