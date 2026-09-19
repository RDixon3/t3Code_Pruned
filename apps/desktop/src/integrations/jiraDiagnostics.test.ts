import { expect, it } from "vite-plus/test";
import { describeJiraError, makeJiraDiagnostics } from "./jiraDiagnostics.ts";

it("redacts credentials and auth URLs while retaining useful errors", () => {
  const log = makeJiraDiagnostics();
  log.protect("secret/token", "oauth-code");
  log.add(
    "FAILED tools/list",
    'MCP error -32602: invalid schema; Bearer anything; access_token="abc123" https://auth.atlassian.com/token?code=oauth-code&state=abc secret/token secret%2Ftoken',
  );
  expect(log.text()).toContain("MCP error -32602: invalid schema");
  for (const secret of [
    "anything",
    "abc123",
    "oauth-code",
    "state=abc",
    "secret/token",
    "secret%2Ftoken",
  ])
    expect(log.text()).not.toContain(secret);
});

it("bounds reports and starts a fresh report on reset", () => {
  const log = makeJiraDiagnostics();
  for (let i = 0; i < 1100; i++) log.add("HTTP", "200");
  expect(log.text().split("\n")).toHaveLength(1000);
  log.reset();
  expect(log.text()).toBe("");
});

it("retains nested network codes while redacting secrets and query parameters", () => {
  const log = makeJiraDiagnostics();
  log.protect("secret");
  const cause = Object.assign(
    new Error("certificate rejected https://auth.atlassian.com/token?code=secret"),
    { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
  );
  log.add("FAILED initialize", describeJiraError(new TypeError("fetch failed", { cause })));
  expect(log.text()).toContain("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
  expect(log.text()).toContain("TypeError: fetch failed");
  expect(log.text()).not.toContain("secret");
  expect(log.text()).not.toContain("code=");
});
it("handles nested aggregate connection failures and cyclic causes without dumping objects", () => {
  const cause = Object.assign(new Error("DNS lookup failed"), {
    code: "ENOTFOUND",
    headers: { Authorization: "do-not-log" },
  });
  const aggregate = new AggregateError([cause], "connection failed");
  aggregate.cause = aggregate;
  const text = describeJiraError(new TypeError("fetch failed", { cause: aggregate }));
  expect(text).toContain("ENOTFOUND");
  expect(text).not.toContain("do-not-log");
  expect(text.length).toBeLessThan(500);
});
