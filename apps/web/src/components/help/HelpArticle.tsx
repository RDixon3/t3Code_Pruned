import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { findHelpArticle } from "../../help/content";
import { articleHeadings, headingId, resolveHelpLink } from "../../help/search";
import { WorkspacePageContainer } from "../WorkspacePageContainer";

// Kept only for this window's Help visit; no new persistence or server traffic.
const readingPositions = new Map<string, number>();

function HelpAnchor({ href, children }: ComponentPropsWithoutRef<"a">) {
  const articleId = useLocation({
    select: (location) => location.pathname.split("/").at(-1) ?? "",
  });
  const navigate = useNavigate();
  const target = href ? resolveHelpLink(href, articleId) : null;
  const className =
    "rounded-sm font-medium text-foreground underline decoration-foreground/50 underline-offset-4 hover:decoration-foreground focus-visible:outline-ring";
  if (target)
    return (
      <Link
        className={className}
        to="/help/$articleId"
        params={{ articleId: target.articleId }}
        hash={target.hash}
      >
        {children}
      </Link>
    );
  if (href?.startsWith("/settings/") && !href.includes("\\"))
    return (
      <a
        href={href}
        className={className}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          void navigate({ href });
        }}
      >
        {children}
      </a>
    );
  if (href?.startsWith("https://"))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
        <ExternalLinkIcon aria-hidden="true" className="ml-1 inline size-3" />
        <span className="sr-only"> (opens externally)</span>
      </a>
    );
  return <span>{children}</span>;
}

const markdownComponents: Components = {
  h1: () => null,
  h2: ({ children }) => (
    <h2
      id={headingId(String(children))}
      tabIndex={-1}
      className="mt-8 mb-3 scroll-mt-6 text-lg font-semibold tracking-tight outline-none first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-6 mb-2 font-semibold">{children}</h3>,
  a: HelpAnchor,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2">
        {children}
      </table>
    </div>
  ),
};

export function HelpArticle({ articleId }: { articleId: string }) {
  const article = findHelpArticle(articleId);
  const location = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    if (location.hash) {
      const heading = document.getElementById(location.hash);
      heading?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    } else {
      container.scrollTop = readingPositions.get(articleId) ?? 0;
      title.current?.focus({ preventScroll: true });
    }
  }, [articleId, location.hash]);

  if (!article)
    return (
      <WorkspacePageContainer>
        <h1 className="text-2xl font-semibold">Guide not found</h1>
        <p className="text-muted-foreground">
          Choose a topic or search Help to find what you need.
        </p>
        <Link
          className="text-foreground underline underline-offset-4"
          to="/help/$articleId"
          params={{ articleId: "getting-started" }}
        >
          Start with CoCo
        </Link>
      </WorkspacePageContainer>
    );
  const headings = articleHeadings(article.text);
  return (
    <div
      ref={scroller}
      onScroll={(event) => readingPositions.set(articleId, event.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <WorkspacePageContainer className="gap-7 pb-16 pt-8 sm:pt-10">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{article.category}</p>
          <h1
            ref={title}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            {article.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {article.summary}
          </p>
        </div>
        <nav
          aria-label="On this page"
          className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-3 text-xs"
        >
          {headings.map((heading) => (
            <Link
              key={heading.id}
              to="/help/$articleId"
              params={{ articleId }}
              hash={heading.id}
              className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-ring"
            >
              {heading.title}
            </Link>
          ))}
        </nav>
        <article className="max-w-none text-sm leading-7 text-foreground [&_p]:my-3 [&_li]:my-1 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground">
          <Markdown remarkPlugins={[remarkGfm]} skipHtml components={markdownComponents}>
            {article.text}
          </Markdown>
        </article>
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Included with this version of CoCo. Provider and SDK features can vary with their
          installed versions.
        </p>
      </WorkspacePageContainer>
    </div>
  );
}
