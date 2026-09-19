interface IpcFrame {
  readonly url: string;
}

export interface IpcSender {
  readonly id: number;
  readonly mainFrame?: IpcFrame;
}

export interface IpcSenderEvent {
  readonly sender: IpcSender;
  readonly senderFrame?: IpcFrame | null;
}

const trustedSenders = new Map<IpcSender, URL>();

/** Register only application windows, before their preload starts executing. */
export function trustDesktopIpcSender(sender: IpcSender, applicationUrl: string): () => void {
  const origin = new URL(applicationUrl);
  trustedSenders.set(sender, origin);
  return () => {
    if (trustedSenders.get(sender) === origin) trustedSenders.delete(sender);
  };
}

export function isTrustedDesktopIpcSender(event: IpcSenderEvent): boolean {
  const expected = trustedSenders.get(event.sender);
  if (!expected || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;
  try {
    const actual = new URL(event.senderFrame.url);
    // URL.origin is "null" for custom schemes in Node; compare the actual
    // protocol and host so unrelated opaque origins can never match the app.
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.username === "" &&
      actual.password === ""
    );
  } catch {
    return false;
  }
}
