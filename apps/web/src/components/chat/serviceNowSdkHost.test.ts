import { expect, it } from "vite-plus/test";
import { isHostLocalSdkEnvironment } from "./serviceNowSdkHost";

it("offers host profiles only for the native local desktop environment", () => {
  const target = { _tag: "PrimaryConnectionTarget", httpBaseUrl: "http://127.0.0.1:3773" };
  const page = "http://localhost:5173";
  expect(isHostLocalSdkEnvironment(target, "darwin", "darwin", page)).toBe(true);
  expect(isHostLocalSdkEnvironment(target, "windows", "win32", page)).toBe(true);
  expect(isHostLocalSdkEnvironment(target, "linux", "win32", page)).toBe(false);
  expect(isHostLocalSdkEnvironment(target, "darwin", undefined, page)).toBe(false);
  expect(
    isHostLocalSdkEnvironment({ ...target, _tag: "SshConnectionTarget" }, "darwin", "darwin", page),
  ).toBe(false);
  expect(
    isHostLocalSdkEnvironment(
      { ...target, httpBaseUrl: "https://remote.example" },
      "darwin",
      "darwin",
      page,
    ),
  ).toBe(false);
});
