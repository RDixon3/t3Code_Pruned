# Desktop release

The `CoCo Desktop Release` workflow produces Apple Silicon DMG and Windows x64 NSIS installers. A separate Linux job supplies only the native terminal module used by Windows WSL. There is no Linux desktop, Intel Mac, mobile, hosted web, or npm publication lane.

## Build and verify

1. Use a reviewed commit with green CoCo CI on Windows and macOS.
2. Run the workflow with a numeric version such as `0.2.0` and **Publish installers** disabled for a rehearsal. This produces downloadable workflow artifacts without creating a release.
3. Test those artifacts on both operating systems: launch, local project/chat, terminal, provider sign-in, Manage, Jira/v0, SDK profiles, preview annotation, and restart persistence. Check Windows WSL separately if it is used.
4. Review the dependency audit, staged-payload CycloneDX inventories, native dependencies, and SHA-256 checksums.
5. For publication, run from the default branch with **Publish installers** enabled and approve the repository's `release` environment when configured. The workflow creates a draft, uploads the two installers and inventories, verifies checksums, then publishes it.

Build jobs have read-only repository access. Only the publication job receives `contents: write`. Third-party actions are pinned by commit; tool and dependency updates must update their review and lockfile together. CoCo branding and app/storage identities are part of the source; release verification checks the packaged identities. Production dependencies are audited again from their staged lockfiles before installers are uploaded.

## Pilot signing and updates

The current pilot deliberately uses an ad-hoc Mac signature and an unsigned Windows installer. Mac Developer ID notarization and Windows publisher identity are not provided. IT must approve this distribution exception and its installation procedure before team deployment. Do not instruct users to disable certificate validation or system malware checks globally.

Application update checking, notifications, download, and installation support remain in the app. Pilot packaging has no update feed configured, so those releases use manual installers. Before enabling organization updates, configure an approved feed and verify its access, update metadata, and artifacts on both platforms. Never bundle a repository token into the app or silently fall back to upstream releases. Provider and ServiceNow SDK updates use their own distribution channels.

## Migration to an organization

Keep app IDs, protocol names, and data-directory identities stable unless planning an explicit data migration. Configure the destination repository, protected default branch, `release` environment/reviewers, trusted runners, and security reporting ownership. The workflow uses the repository that owns the run; do not add a personal access token or upstream deployment secret.

The staged-payload SBOM detects installed packages and recognizable binaries. It is not a complete inventory of code bundled into JavaScript, Chromium, Rust, or external provider CLIs. Retain the lockfiles, commit SHA, build logs, and native dependency manifests alongside release evidence. Review licenses as well as vulnerability matches.
