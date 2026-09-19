/** Messages authored by CoCo, safe to include alongside transport metadata. */
export class V0ConnectionError extends Error {}

/** Diagnostics contain transport metadata only, never tool arguments or result content. */
export function makeV0Diagnostics() {
  let lines: string[] = [];
  const secrets = new Set<string>();
  const redact = (value: string) => {
    let text = value;
    for (const secret of secrets)
      text = text
        .replaceAll(secret, "[redacted]")
        .replaceAll(encodeURIComponent(secret), "[redacted]");
    return text
      .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
      .replace(/(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/g, "$1?[redacted]")
      .replace(
        /((?:access_token|refresh_token|client_secret|code_verifier|authorization|cookie)\s*["']?\s*[:=]\s*["']?)[^\s,"'<>]+/gi,
        "$1[redacted]",
      )
      .slice(0, 4000);
  };
  return {
    reset: () => {
      lines = [];
      secrets.clear();
    },
    protect: (...values: (string | undefined)[]) => {
      for (const value of values) if (value) secrets.add(value);
    },
    add: (stage: string, message: string) => {
      if (lines.length >= 200) lines.splice(20, 1);
      lines.push(`${stage}: ${redact(message)}`);
    },
    text: () => lines.map(redact).join("\n"),
  };
}

/** Preserve useful network failure codes without serializing request objects or response bodies. */
export function describeV0Error(error: unknown): string {
  const seen = new Set<unknown>();
  const describe = (value: unknown, depth: number): string => {
    if (!value || typeof value !== "object" || depth > 3 || seen.has(value)) return "";
    seen.add(value);
    const name =
      value instanceof Error && value.constructor !== Error
        ? value.constructor.name
        : "name" in value && typeof value.name === "string"
          ? value.name
          : "Error";
    const code =
      "code" in value && (typeof value.code === "number" || typeof value.code === "string")
        ? ` [${value.code}]`
        : "";
    // SDK/OAuth errors can embed HTTP bodies. Keep their type/code, not arbitrary server text.
    const message =
      value instanceof V0ConnectionError ||
      (value instanceof TypeError && value.message === "fetch failed")
        ? `: ${value.message}`
        : "";
    const causes = [
      "cause" in value ? describe(value.cause, depth + 1) : "",
      ...("errors" in value && Array.isArray(value.errors)
        ? value.errors.slice(0, 3).map((item: unknown) => describe(item, depth + 1))
        : []),
    ].filter(Boolean);
    return `${name}${code}${message}${causes.length ? `; caused by ${causes.join("; ")}` : ""}`;
  };
  return describe(error, 0) || "Unknown failure";
}
