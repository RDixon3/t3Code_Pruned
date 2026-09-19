export function makeJiraDiagnostics() {
  let lines: string[] = [];
  const secrets = new Set<string>();
  const redact = (value: string) => {
    let text = value;
    for (const secret of secrets) {
      text = text
        .replaceAll(secret, "[redacted]")
        .replaceAll(encodeURIComponent(secret), "[redacted]");
    }
    return text
      .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
      .replace(/(https?:\/\/[^\s?"'<>]+)\?[^\s"'<>]*/g, "$1?[redacted]")
      .replace(
        /((?:access_token|refresh_token|client_secret|code_verifier|authorization|cookie)\s*["']?\s*[:=]\s*["']?)[^\s,"'<>]+/gi,
        "$1[redacted]",
      )
      .slice(0, 8000);
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
      // Keep startup context and the final outcome even for very large catalogs.
      if (lines.length >= 1000) lines.splice(50, 1);
      lines.push(`${stage}: ${redact(message)}`);
    },
    text: () => lines.map(redact).join("\n"),
  };
}

/** Keep network cause codes (TLS, proxy, DNS) without serializing request objects or headers. */
export function describeJiraError(error: unknown): string {
  const seen = new Set<unknown>();
  const describe = (value: unknown, depth: number): string => {
    if (depth > 3 || value === null || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    const name = "name" in value && typeof value.name === "string" ? value.name : "Error";
    const message = "message" in value && typeof value.message === "string" ? value.message : "";
    const code =
      "code" in value && (typeof value.code === "string" || typeof value.code === "number")
        ? ` [${value.code}]`
        : "";
    const causes = [
      "cause" in value ? describe(value.cause, depth + 1) : "",
      ...("errors" in value && Array.isArray(value.errors)
        ? value.errors.slice(0, 3).map((cause: unknown) => describe(cause, depth + 1))
        : []),
    ].filter(Boolean);
    return `${name}${code}${message ? `: ${message}` : ""}${causes.length ? `; caused by ${causes.join("; ")}` : ""}`;
  };
  return describe(error, 0) || "Unknown failure";
}
