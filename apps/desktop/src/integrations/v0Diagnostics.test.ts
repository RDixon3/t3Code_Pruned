import { describe, expect, it } from "vite-plus/test";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describeV0Error, makeV0Diagnostics } from "./v0Diagnostics.ts";

describe("v0 diagnostics", () => {
  it("redacts known credentials, authorization headers, cookies and URL query/fragment data", () => {
    const diagnostics = makeV0Diagnostics();
    diagnostics.protect("token+/secret", "refresh-secret");
    diagnostics.add(
      "failure",
      "token+/secret token%2B%2Fsecret refresh-secret Bearer other-secret cookie=private https://v0.app/api/mcp?code=private#secret https://v0.app/#private",
    );
    diagnostics.add(
      "token",
      'access_token="unknown-token" client_secret=private code_verifier=secret',
    );
    const text = diagnostics.text();
    for (const secret of [
      "token+/secret",
      "token%2B%2Fsecret",
      "refresh-secret",
      "other-secret",
      "private",
      "unknown-token",
      "=secret",
    ])
      expect(text).not.toContain(secret);
    expect(text).toContain("https://v0.app/api/mcp?[redacted]");
  });

  it("redacts values registered after a diagnostic line was recorded and bounds the log", () => {
    const diagnostics = makeV0Diagnostics();
    diagnostics.add("startup", "sensitive-value");
    diagnostics.protect("sensitive-value");
    for (let index = 0; index < 300; index++) diagnostics.add("line", String(index));
    expect(diagnostics.text()).not.toContain("sensitive-value");
    expect(diagnostics.text().split("\n")).toHaveLength(200);
    expect(diagnostics.text()).toContain("line: 299");
    diagnostics.reset();
    expect(diagnostics.text()).toBe("");
  });

  it("retains network causes but excludes server error bodies and attached request objects", () => {
    const cause = Object.assign(new Error("certificate verification failed"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
    const network = new TypeError("fetch failed", { cause });
    expect(describeV0Error(network)).toContain("SELF_SIGNED_CERT_IN_CHAIN");
    const remote = {
      name: "McpError",
      code: -32000,
      message: "private prototype content",
      request: { token: "private" },
    };
    expect(describeV0Error(remote)).toBe("McpError [-32000]");
    expect(describeV0Error(new StreamableHTTPError(500, "private response body"))).toBe(
      "StreamableHTTPError [500]",
    );
    expect(describeV0Error(new Error("private response body"))).toBe("Error");
  });
});
