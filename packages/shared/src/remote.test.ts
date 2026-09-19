import { describe, expect, it } from "vite-plus/test";

import { getPairingTokenFromUrl, stripPairingTokenFromUrl } from "./remote.ts";

describe("local browser pairing URLs", () => {
  it("prefers the fragment credential and still accepts legacy query credentials", () => {
    expect(getPairingTokenFromUrl(new URL("http://localhost:3000/?token=old#token=current"))).toBe(
      "current",
    );
    expect(getPairingTokenFromUrl(new URL("http://localhost:3000/?token=old#token=%20"))).toBe(
      "old",
    );
    expect(getPairingTokenFromUrl(new URL("http://localhost:3000/?token=%20"))).toBeNull();
  });

  it("removes every credential from the displayed URL without changing navigation or its input", () => {
    const source = new URL(
      "http://localhost:3000/project?view=chat&token=old&token=older#tab=build&token=current&token=another",
    );
    const sanitized = stripPairingTokenFromUrl(source);

    expect(sanitized.toString()).toBe("http://localhost:3000/project?view=chat#tab=build");
    expect(getPairingTokenFromUrl(sanitized)).toBeNull();
    expect(getPairingTokenFromUrl(source)).toBe("current");
  });

  it("preserves a URL with no credential", () => {
    const source = new URL("http://localhost:3000/project?view=chat#section");
    expect(stripPairingTokenFromUrl(source).toString()).toBe(source.toString());
  });
});
