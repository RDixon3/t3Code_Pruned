import { BookOpenIcon } from "lucide-react";
import type { HelpArticleId } from "../../help/catalog";
import { useOpenHelp } from "../../help/navigation";
import { Button } from "../ui/button";

export function HelpLink({
  article,
  label = "Learn more",
  anchor = "",
}: {
  article: HelpArticleId;
  label?: string;
  anchor?: string;
}) {
  const open = useOpenHelp();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-muted-foreground"
      onClick={() => open(article, anchor)}
    >
      <BookOpenIcon className="size-3.5" />
      {label}
    </Button>
  );
}
