# Desktop deployment and security

CoCo is a local desktop client for Windows x64 and Apple Silicon macOS. Its agent providers and terminals deliberately execute with the signed-in operating-system user's permissions. The **Auto** chat setting controls provider approval behavior; it is not an operating-system sandbox or a guarantee that an agent cannot access local data.

## Network and trust boundaries

The desktop starts a loopback backend. Remote environments, SSH orchestration, Tailscale sharing, managed relays, hosted client deployment, and upstream product analytics are removed. The web client remains a local development tool.

Windows WSL is the one networking exception: the desktop can bootstrap a backend bound to the exact address of its own WSL distribution. This is accepted only through the private desktop bootstrap with a token, in WSL, for an address present on that distribution's interfaces. CLI and environment configuration cannot enable arbitrary network listeners. WSL traffic may traverse a local virtual adapter; retain host firewall protections. Desktop integration credentials are not automatically shared into WSL.

The trusted application window has the desktop bridge. IPC handlers validate its sender, main frame, and trusted application origin. Preview pages run in isolated guest contexts without that bridge. Their element-selection helper exposes only bounded page metadata; it does not receive application credentials. Browser profile cookie import is removed.

Local process access is still powerful: another process under the same user can read files and interact with that user's installed tools. Use managed endpoints, least-privilege accounts, disk encryption, and approved provider accounts for organization data.

## External services and sensitive data

Outbound access remains necessary for selected providers, Jira/Atlassian, v0/Vercel, ServiceNow, Git hosting, and explicit CLI/SDK updates. OAuth also uses browser authorization and local callbacks. Public package registries and platform download services are used at build/install time. Inventory the exact domains used by the chosen accounts with IT; do not disable TLS verification to bypass corporate proxy problems.

Provider prompts can include project files, Jira records, issue context, and ServiceNow references. External service permissions govern tool operations. Repository or issue text is untrusted input to agents, and connecting MCP tools is a capability grant, not a data-loss prevention control.

Jira, v0, and pursuit-connection credentials use the desktop's encrypted credential storage. SDK and provider credentials remain in those tools' stores. Chats, logs, terminal history, project settings, drafts, snapshots, and local caches can contain sensitive content; not all of those stores are encrypted by the application. Review retention and backup requirements before loading regulated or customer data. Diagnostics redact expected token fields, but support logs still require review before sharing.

Native agents/skills can influence commands and data handling. Their future content-repository setting does not currently provide a signed content update system. Review instruction changes through the organization's normal repository process.

## Repository and release controls

Workspace packages are private. Release jobs build only supported desktop targets. Actions are pinned, credentials are not persisted by checkout, and publication alone receives write permission. Configure branch protection and `release` environment review in the organization; repository files cannot enforce those account settings.

Use source and history secret scanning, a locked dependency audit, native dependency review, and the staged-payload SBOM. A dependency match needs reachability and packaging analysis; a clean scan is not a penetration test. Test fixtures can resemble credentials and should be classified rather than broadly suppressing whole directories.

This repository starts from a clean CoCo source snapshot. Pre-fork Git history and removed files are not part of this repository. The upstream copyright, license, and attribution remain required even without that history.

See [Release](release.md) for the unsigned/ad-hoc pilot exception and manual update process. Signing, software distribution approval, provider/service data policies, and security reporting ownership remain organization decisions; no placeholder credentials or approval claims are baked into the app.
