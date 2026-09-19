# Local connections and WSL

CoCo runs on your own desktop. Its local server owns projects, chats, terminals, and provider processes. **Settings → Connections** shows the local connection and its status.

If the local server is unavailable, finish any work you can save, quit CoCo, and reopen it. Check the reported error before changing provider credentials. A server startup error and a provider sign-in error have different causes.

## Use WSL on Windows

Windows Subsystem for Linux (WSL) is an optional backend on the same Windows computer. Its projects, files, providers, and credentials are separate from the Windows backend.

1. Open **Settings → Connections**.
2. Under **WSL backend**, select an installed distribution.
3. Choose whether Windows should run alongside WSL or whether to use WSL only.
4. Confirm a restart if requested.

**WSL only** makes Windows-side projects unavailable until you turn that option off. Select **Off** to stop WSL; its saved projects and chats remain in the distribution. Finish active work before switching distributions.

Install and authenticate providers inside the selected distribution. Desktop Jira/v0 credentials and ServiceNow SDK profiles are not supplied to WSL automatically.

## Web development

The web client is for local development. Open the complete one-time pairing URL printed by the development runner. Its token authorizes the browser on your own machine; keep that URL out of screenshots and support reports.

See [Development setup](development.md) for isolated development state and [Find and fix a problem](troubleshooting.md) for diagnostics.
