export type HelpReturnTarget = {
  href: string;
  manage: boolean;
  projectScope: string | null;
};

export function isHelpPath(path: string) {
  return path === "/help" || path.startsWith("/help/");
}

export function safeReturnHref(href: string) {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /[\r\n]/.test(href) ||
    isHelpPath(href.split(/[?#]/)[0]!)
  )
    return "/settings/projects";
  return href;
}

/** Article and Settings links are part of the same Help visit. */
export function nextHelpReturn(current: HelpReturnTarget | null, next: HelpReturnTarget) {
  const path = next.href.split(/[?#]/)[0]!;
  if (isHelpPath(path) || (current && /^\/settings(?:\/|$)/.test(path))) return current;
  return { ...next, href: safeReturnHref(next.href) };
}

export function retainHelpReturn(current: HelpReturnTarget | null, pathname: string) {
  return isHelpPath(pathname) || /^\/settings(?:\/|$)/.test(pathname) ? current : null;
}

export function resolveHelpReturnHref(
  target: HelpReturnTarget | null,
  exists: (environmentId: string, threadId: string) => boolean,
  draftExists: (draftId: string) => boolean,
) {
  const href = safeReturnHref(target?.href ?? "/settings/projects");
  const path = href.split(/[?#]/)[0]!;
  const parts = path.split("/").filter(Boolean);
  try {
    if (parts.length === 2 && parts[0] === "draft") {
      return draftExists(decodeURIComponent(parts[1]!)) ? href : "/settings/projects";
    }
    if (parts.length === 2 && !["settings", "projects"].includes(parts[0]!)) {
      return exists(decodeURIComponent(parts[0]!), decodeURIComponent(parts[1]!))
        ? href
        : "/settings/projects";
    }
  } catch {
    return "/settings/projects";
  }
  return href;
}
