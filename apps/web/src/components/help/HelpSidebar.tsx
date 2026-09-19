import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon, BookOpenIcon, SearchIcon, XIcon } from "lucide-react";

import { HELP_CATEGORIES, HELP_TOPICS } from "../../help/catalog";
import { useHelpReturn } from "../../help/navigation";
import { searchHelp } from "../../help/search";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

export default function HelpSidebar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  const { goBack, label } = useHelpReturn();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 0;
  const selectedIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));
  const activeResult = results[selectedIndex];
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const clearSearch = () => {
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (searching && activeResult) {
      document
        .getElementById(`help-result-${activeResult.article.id}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeResult, searching]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape" && searching) {
      event.preventDefault();
      event.stopPropagation();
      clearSearch();
    } else if (results.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveIndex(
        (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length,
      );
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      document.getElementById(`help-result-${activeResult.article.id}`)?.click();
    }
  };

  return (
    <>
      <SidebarContent
        className="gap-0 overflow-x-hidden"
        fixedHeader={
          <SidebarGroup className="gap-3 pb-2">
            <div className="flex items-center gap-2 px-2 pt-2 text-sm font-semibold text-sidebar-foreground">
              <BookOpenIcon aria-hidden="true" className="size-4" />
              Help
            </div>
            <div className="flex h-9 items-center gap-2 rounded-md px-2 text-sidebar-muted-foreground focus-within:bg-sidebar-row-hover focus-within:ring-1 focus-within:ring-sidebar-ring">
              <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
              <Input
                ref={inputRef}
                nativeInput
                unstyled
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search help"
                aria-label="Search help"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searching && results.length > 0}
                aria-controls={searching && results.length > 0 ? "help-search-results" : undefined}
                aria-activedescendant={
                  searching && activeResult ? `help-result-${activeResult.article.id}` : undefined
                }
                className="min-w-0 flex-1 [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:p-0 [&_[data-slot=input]]:leading-normal [&_[data-slot=input]]:text-sm [&_[data-slot=input]]:text-sidebar-foreground [&_[data-slot=input]]:placeholder:text-sidebar-muted-foreground"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-micro"
                  aria-label="Clear help search"
                  className="shrink-0 text-sidebar-muted-foreground"
                  onClick={clearSearch}
                >
                  <XIcon aria-hidden="true" className="size-3" />
                </Button>
              )}
            </div>
          </SidebarGroup>
        }
      >
        {searching ? (
          <SidebarGroup>
            <p role="status" className="px-2 pb-2 text-xs text-sidebar-muted-foreground">
              {results.length === 0
                ? "No matching guides"
                : `${results.length} ${results.length === 1 ? "guide" : "guides"} found`}
            </p>
            {results.length === 0 ? (
              <div className="space-y-3 px-2 py-3 text-sm text-sidebar-muted-foreground">
                <p>Try a shorter phrase, such as “Jira”, “story points”, or “SDK profile”.</p>
                <Button size="sm" variant="outline" onClick={clearSearch}>
                  Browse all topics
                </Button>
              </div>
            ) : (
              <SidebarMenu id="help-search-results" role="listbox" aria-label="Help search results">
                {results.map((result, index) => (
                  <SidebarMenuItem key={result.article.id} role="presentation">
                    <SidebarMenuButton
                      render={
                        <Link
                          to="/help/$articleId"
                          params={{ articleId: result.article.id }}
                          hash={result.anchor}
                        />
                      }
                      id={`help-result-${result.article.id}`}
                      role="option"
                      aria-selected={selectedIndex === index}
                      tabIndex={-1}
                      isActive={selectedIndex === index}
                      className="h-auto min-h-12 items-start px-2 py-2"
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={closeMobile}
                    >
                      <span className="min-w-0 flex-1 whitespace-normal!">
                        <span className="block text-sm font-medium text-sidebar-foreground">
                          {result.article.title}
                        </span>
                        <span className="mt-1 block text-[11px] text-sidebar-muted-foreground">
                          {result.article.category}
                        </span>
                        <span className="mt-1 line-clamp-3 text-xs font-normal leading-relaxed text-sidebar-muted-foreground">
                          {result.excerpt}
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroup>
        ) : (
          <nav aria-label="Help topics">
            {HELP_CATEGORIES.map((category, index) => (
              <SidebarGroup key={category} className="py-1">
                <SidebarGroupLabel
                  id={`help-category-${index}`}
                  className="text-[11px] text-sidebar-muted-foreground"
                >
                  {category}
                </SidebarGroupLabel>
                <SidebarMenu aria-labelledby={`help-category-${index}`}>
                  {HELP_TOPICS.filter((topic) => topic.category === category).map((topic) => (
                    <SidebarMenuItem key={topic.id}>
                      <SidebarMenuButton
                        render={
                          <Link to="/help/$articleId" params={{ articleId: topic.id }} hash="" />
                        }
                        isActive={pathname === `/help/${topic.id}`}
                        aria-current={pathname === `/help/${topic.id}` ? "page" : undefined}
                        onClick={closeMobile}
                        className="h-auto min-h-8 py-1.5"
                      >
                        <span className="whitespace-normal!">{topic.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </nav>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-[var(--sidebar-content-inset)]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                closeMobile();
                goBack();
              }}
            >
              <ArrowLeftIcon aria-hidden="true" />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
