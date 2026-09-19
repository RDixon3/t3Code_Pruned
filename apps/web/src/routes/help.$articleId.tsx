import { createFileRoute } from "@tanstack/react-router";
import { HelpArticle } from "../components/help/HelpArticle";

export const Route = createFileRoute("/help/$articleId")({ component: HelpArticleRoute });

function HelpArticleRoute() {
  const { articleId } = Route.useParams();
  return <HelpArticle articleId={articleId} />;
}
