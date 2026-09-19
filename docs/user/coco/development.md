# Development setup

Use this guide to run CoCo from a source checkout on Windows or macOS. A source checkout does not require a packaged installer.

These procedures are for developers and technical support staff. For an installed release, use [Start with CoCo](getting-started.md).

## Before you start

Make sure that these items are available:

- Access to your team's CoCo Git repository.
- Git on the development machine.
- Node.js with the version required by the checkout's `package.json`.
- Vite+, which supplies the `vp` command.
- Access to the package registry for dependency installation.
- A separate directory for development data.

This checkout requires Node.js `^24.21.0`. A later checkout can change that requirement.
Use the checked-out file as the authority for your branch.

The desktop and its providers use executable paths visible to the desktop process. A command that works in one terminal can be absent from another process.

## Install the development tools

1. Install the required Node.js version through your team's supported method.
2. Open a new terminal.
3. Run `node --version`.
4. Make sure that the result satisfies the checkout's Node.js requirement.
5. Install Vite+ with the applicable command below.
6. Open another terminal if the installer changes PATH.
7. Run `vp --version`.

For macOS:

```sh
curl -fsSL https://vite.plus | bash
```

For Windows PowerShell:

```powershell
irm https://vite.plus/ps1 | iex
```

These are the Vite+ installation commands supplied in this checkout's README. Use your company's software process if it controls tool installation.

If a native component requires compilation, install the applicable build tools:

| Platform | Native build requirements                                                           |
| -------- | ----------------------------------------------------------------------------------- |
| macOS    | Xcode Command Line Tools and Rust                                                   |
| Windows  | Rust, Python 3, and Visual Studio Build Tools with **Desktop development with C++** |

For Windows installer builds, include the Windows SDK, MSVC tools, and required Spectre-mitigated libraries.
For Apple Silicon builds, use the `aarch64-apple-darwin` Rust target.
For Windows x64 builds, use `x86_64-pc-windows-msvc`.

## Prepare the checkout

1. Clone the team's CoCo repository to a development folder.
2. Select the branch that you intend to test.
3. Open a terminal in the repository root.
4. Make sure that the root contains `package.json` and the `apps` directory.
5. Run the dependency installation command:

```sh
vp i
```

Wait for installation to finish without an error. Do not start the app from a partial dependency installation.

This command installs workspace dependencies. It does not sign in to Jira, ServiceNow, or a coding provider.

If you change branches and dependency files change, run `vp i` again.

## Start the desktop app

Use this command from the repository root:

```sh
vp run dev:desktop --home-dir ./.t3
```

The explicit data directory keeps this test environment separate from an installed CoCo application.
This directory stores runtime data under its `userdata` subdirectory.

The launcher starts the development services and desktop window. Keep its terminal open.
The source desktop window identifies itself as **CoCo (Dev)**. Packaged releases use the same CoCo artwork and a separate application identity and data directory.

Make sure that these results occur:

- The launcher reports its actual ports on the `[dev-runner]` line.
- The desktop window opens.
- The environment connection becomes available.
- The sidebar shows **Pursue**, **Manage**, and **Build**.

If the app opens with separate empty data, complete provider setup and add a project. An isolated environment does not copy installed-app accounts or chats.

## Start the web client for tests

Use this command instead of the desktop command:

```sh
vp run dev --home-dir ./.t3
```

1. Wait for the launcher to report a pairing URL.
2. Open the complete pairing URL in the test browser.
3. Make sure that the client connects to the intended environment.
4. Select or create a project.

The pairing URL contains a one-time token. A bare localhost address does not authenticate a new browser.
If the token expired or was already used, use the recovery procedure below.

The web client can test layout, chat, and supported environment features. Desktop-only SDK and Jira connection controls require the desktop app.

Do not run separate servers against the same data directory at the same time. Stop the previous launcher before you change between these two commands.

### Obtain another pairing URL

Keep the existing launcher active. The pairing command does not start another server.

1. Open a second terminal in the repository root.
2. Run this command for the data directory used above:

```sh
node apps/server/src/bin.ts pair --base-dir ./.t3
```

3. Read the server label and address in the output.
4. Make sure that they identify your development environment.
5. Open the complete new pairing URL in the test browser.

The pairing command uses `--base-dir`, while the launcher uses `--home-dir`. Both values must identify the same data directory.

The new token expires after five minutes by default. It supplies standard client permissions, without the startup URL's administrative permissions.

For local tests that need administrative permissions, use the startup pairing URL.
If the command reports no active server, confirm the launcher's status and data directory before you retry.

## Understand ports and data locations

Do not assume that a previous port is still correct. An occupied port can make the launcher select another port.
Use the actual values in the launcher output.

Without an explicit data directory, a linked Git worktree uses its own `.t3` directory.
The main checkout normally uses development data below the configured T3 home.
An explicit `--home-dir` takes precedence.

Keep `VITE_HTTP_URL` and `VITE_WS_URL` unset in your shell for normal development. The launcher supplies values only where its mode requires them.
In web development, Vite forwards client requests through the same origin.
Hard-coded origins can point a test at the wrong local port or server.

Never point a test server at an installed app's active `.coco/userdata` or `.t3/userdata` directory.
Use [Data maintenance](technical.md#preserve-data-before-maintenance) before you make a copy of real data.

## Restart after a source change

Web interface changes normally reload through the development server. Server startup and desktop process changes can require a restart.

1. Save source changes.
2. Stop active test chats and terminal commands.
3. Quit the development desktop window.
4. Press **Ctrl+C** in the terminal that started the launcher.
5. Wait for that launcher to stop.
6. If dependency files changed, run `vp i`.
7. Start the same command with the same `--home-dir` value.
8. Make sure that the expected source change appears.

Stop the launcher you started. Do not terminate every Node or Electron process on the computer.
Other applications and development environments can use those processes.

## Diagnose a failed launch

| Symptom                                      | Action                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `vp` is not recognized                       | Complete the Vite+ installation. Open a new terminal. Run `vp --version`.                               |
| The Node version is unsupported              | Select the version required by `package.json`. Repeat dependency installation.                          |
| A module or workspace package is missing     | Run `vp i` in the repository root. Read its first failure if installation stops.                        |
| A native module fails to build               | Install the platform build tools listed above. Repeat the failed build step.                            |
| The web page requests authorization          | Use the complete one-time pairing URL from the correct launcher.                                        |
| The client connects to the wrong environment | Compare the launcher ports and data directory with the client connection.                               |
| A second launch reports a locked database    | Stop the previous launcher that owns that data directory.                                               |
| Jira or npm reports a certificate error      | Give IT the component and certificate error. Do not disable TLS verification.                           |
| The desktop retains previous behavior        | Restart both the desktop window and its launcher. A window reload alone does not replace every process. |

Keep the first error and the command that produced it. Later errors can be consequences of that first failure.

## Build an installer

A local installer build is separate from a development launch. It does not publish a GitHub release.
Use the operating system and native build tools for that target.

For macOS Apple Silicon:

```sh
vp run dist:desktop:dmg:arm64
```

For Windows x64:

```powershell
vp run dist:desktop:win:x64
```

These commands build CoCo installers under `release`. They do not publish a release.

The **CoCo Desktop Release** workflow builds, verifies, and optionally publishes the installers.
Its file remains `.github/workflows/coco-macos-release.yml`.
It publishes an Apple Silicon DMG and a Windows x64 NSIS EXE installer in one GitHub release.
The macOS app is ad-hoc signed without notarization. The Windows installer is unsigned; this workflow uses no signing certificates.

Use the repository's release procedure for team distribution. Use [Updates](updates.md) for installation and version verification.
