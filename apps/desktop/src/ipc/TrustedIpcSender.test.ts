import { describe, expect, it } from "vite-plus/test";
import { isTrustedDesktopIpcSender, trustDesktopIpcSender } from "./TrustedIpcSender.ts";

describe("desktop IPC callers", () => {
  it("accepts only the registered window's main frame at the application origin", () => {
    const mainFrame = { url: "t3code://app/settings" };
    const sender = { id: 1, mainFrame };
    const event = { sender, senderFrame: mainFrame };
    const revoke = trustDesktopIpcSender(sender, "t3code://app/");
    expect(isTrustedDesktopIpcSender(event)).toBe(true);
    expect(isTrustedDesktopIpcSender({ sender, senderFrame: null })).toBe(false);
    expect(isTrustedDesktopIpcSender({ sender, senderFrame: { ...mainFrame } })).toBe(false);
    expect(isTrustedDesktopIpcSender({ ...event, sender: { ...sender } })).toBe(false);
    for (const url of [
      "https://app/",
      "t3code://evil/",
      "file:///app",
      "data:text/html,test",
      "t3code://user@app/",
    ]) {
      mainFrame.url = url;
      expect(isTrustedDesktopIpcSender(event), url).toBe(false);
    }
    mainFrame.url = "t3code://app/";
    revoke();
    expect(isTrustedDesktopIpcSender(event)).toBe(false);
  });

  it("keeps dev origins exact including port", () => {
    const mainFrame = { url: "http://127.0.0.1:5733/chat" };
    const sender = { id: 2, mainFrame };
    const revoke = trustDesktopIpcSender(sender, "http://127.0.0.1:5733/");
    expect(isTrustedDesktopIpcSender({ sender, senderFrame: mainFrame })).toBe(true);
    mainFrame.url = "http://127.0.0.1:5734/chat";
    expect(isTrustedDesktopIpcSender({ sender, senderFrame: mainFrame })).toBe(false);
    revoke();
  });
});
