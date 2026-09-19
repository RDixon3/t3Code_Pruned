# Development

Use Node 24.21 or a compatible later Node 24 release, and the repository's pinned `vp`/pnpm toolchain. Install dependencies with `vp i` from the repository root.

## Local launch

- `vp run dev` runs the server and web client. Open the complete pairing URL printed by the runner.
- `vp run dev:desktop` runs Electron with the web development renderer.
- `vp run build:desktop` builds the renderer, server, and desktop bundles.

Pass an explicit `--home-dir` when testing a separate checkout, for example `vp run dev:desktop --home-dir .t3/verification`. Never use a live installed app's data directory. Worktrees default to their own `.t3`; the main checkout otherwise uses development state in the user's home directory.

Read the actual ports from the runner output. Development listeners are local only. Leave `VITE_HTTP_URL` and `VITE_WS_URL` unset when using the web development client; Vite proxies the backend through the same origin.

Keep a reference to the process you start and stop only that process. Do not kill processes by matching their names or paths.

## Focused verification

Run `vp test run <files>`, `vp lint <files>`, and `vp run --filter <package> typecheck` for changed behavior. CI owns the full suite and builds on Windows and Apple Silicon. Do not replace behavior checks with static markup assertions.

Run `vp run test:desktop-smoke` after a desktop build. Real-client verification should cover project selection, provider startup, the terminal, Manage, integrations, and preview when those paths change. Use isolated state and read-only integration checks unless a mutation is part of the requested test.

## Desktop installers

Use the [release workflow](release.md) for reproducible Windows x64 and Apple Silicon builds. Local packaging requires Rust and the native platform toolchain: Xcode Command Line Tools on macOS; Python and Visual Studio C++ Build Tools, Windows SDK, and Spectre-mitigated libraries on Windows. WSL additionally uses a Linux x64 node-pty prebuild produced by CI.

Do not remove Linux native dependency variants solely because there is no Linux desktop release: Windows WSL still uses them. Preserve the Electron installer bootstrap rather than adding a separate Python archive extractor.
