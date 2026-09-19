import {
  CheckSquareIcon,
  ExternalLinkIcon,
  PackageIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { contextItemKey, type ContextItem } from "../../lib/contextItem";
import { cn } from "../../lib/utils";
import {
  CHAT_INLINE_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
} from "../composerInlineChip";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";

function sourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function ContextItemChips({
  items,
  onRemove,
  className,
}: {
  items: readonly ContextItem[];
  onRemove?: ((key: string) => void) | undefined;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("flex max-h-24 min-w-0 flex-wrap gap-1.5 overflow-y-auto", className)}>
      {items.map((item) => {
        const key = contextItemKey(item);
        const Icon =
          item.kind === "risk"
            ? TriangleAlertIcon
            : item.kind === "issue"
              ? CheckSquareIcon
              : PackageIcon;
        const url = sourceUrl(item.url);
        return (
          <Popover key={key}>
            <span className={cn(CHAT_INLINE_CHIP_CLASS_NAME, "min-w-0 max-w-[min(20rem,100%)]")}>
              <PopoverTrigger
                type="button"
                aria-label={`Inspect ${item.sourceLabel} ${item.recordId}: ${item.title}`}
                className="inline-flex min-w-0 cursor-pointer items-center gap-[0.33em] rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
                    item.kind === "risk"
                      ? "text-orange-500"
                      : item.kind === "issue"
                        ? "text-blue-500"
                        : "text-muted-foreground",
                  )}
                />
                <span className="max-w-32 shrink-0 truncate leading-tight">{item.recordId}</span>
                <span className="truncate font-normal leading-tight text-muted-foreground">
                  {item.title}
                </span>
              </PopoverTrigger>
              {onRemove && (
                <button
                  type="button"
                  className={COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME}
                  aria-label={`Remove ${item.recordId} context`}
                  onClick={() => onRemove(key)}
                >
                  <XIcon className="size-full" aria-hidden="true" />
                </button>
              )}
            </span>
            <PopoverPopup align="start" className="w-96 max-w-[calc(100vw-2rem)]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {item.sourceLabel} · {item.recordId}
                  </p>
                  <PopoverTitle className="text-sm leading-snug">{item.title}</PopoverTitle>
                </div>
                <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                  {item.content}
                </p>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    onClick={(event) => {
                      if (window.desktopBridge) {
                        event.preventDefault();
                        void window.desktopBridge.openExternal(url);
                      }
                    }}
                  >
                    <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                    Open in {item.sourceLabel}
                  </a>
                )}
              </div>
            </PopoverPopup>
          </Popover>
        );
      })}
    </div>
  );
}
