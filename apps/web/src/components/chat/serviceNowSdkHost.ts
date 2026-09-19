export function isHostLocalSdkEnvironment(
  target: { _tag: string; httpBaseUrl?: string } | undefined,
  serverOs: string | undefined,
  clientOs: string | undefined,
  pageUrl: string,
): boolean {
  const nativeOs = clientOs === "win32" ? "windows" : clientOs;
  if (target?._tag !== "PrimaryConnectionTarget" || !nativeOs || serverOs !== nativeOs)
    return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(target.httpBaseUrl || pageUrl, pageUrl).hostname,
    );
  } catch {
    return false;
  }
}
