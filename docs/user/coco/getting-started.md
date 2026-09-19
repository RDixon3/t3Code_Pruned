# Start with CoCo

CoCo puts project work and agent conversations in one desktop app. You supply the project folder and the provider account.

Use this guide to install CoCo and complete a first chat. Jira and ServiceNow connections are optional for ordinary chats.

## Before you start

Make sure that these items are available:

- A Windows x64 computer or an Apple Silicon Mac.
- Your team's CoCo installer, or access to the CoCo source repository.
- A local folder for the project.
- An account that can use Codex, Claude Code, or Cursor.
- Network access to that provider's services.

The provider account is separate from CoCo. Your provider account determines available models, usage limits, and charges.

A CLI is a command-line program. CoCo uses the provider's CLI or runtime to perform work on the selected computer.

Git is necessary for branches, commits, and worktrees. A folder without Git can still be a CoCo project.

## Install and open CoCo

Get the approved CoCo release from your team's software distribution channel.

CoCo releases include an Apple Silicon DMG and a Windows x64 EXE installer. Select the installer that matches your computer.

For an Apple Silicon Mac:

1. Download the DMG from the approved release.
2. Open the DMG.
3. Drag CoCo to **Applications**.
4. Open CoCo from **Applications**.

The macOS app uses an ad-hoc signature and has no Apple notarization. If macOS blocks the app, use your organization's approved installation process.

For Windows x64:

1. Download the EXE installer from the approved release.
2. Open the installer.
3. Complete its installation steps.
4. Open CoCo.

The Windows installer is unsigned. If Windows or company policy blocks it, use your organization's approved installation process.

For source-based tests, use [Development setup](development.md). A browser development session does not have every desktop integration.

For a replacement installation, use [Keep CoCo and its tools current](updates.md). Preserve your saved CoCo data.

## Complete the first setup

The first setup shows local environments, provider setup, and saved projects. On Windows, a configured WSL backend can appear alongside the desktop backend.

1. Select the local environment where your project will run.
2. Open the **Your agents** step.
3. Examine the status of the provider you want to use.
4. If **Install** is available, select it.
5. Read the command in the terminal.
6. Press **Enter** to run the command.

For Codex and Claude Code, the setup can open an embedded terminal for installation or sign-in. The command does not run until you press **Enter**.

If **Sign in** is available:

1. Select **Sign in**.
2. Run the displayed command in the terminal.
3. Complete the provider's authentication steps.
4. Return to CoCo.
5. Close the setup terminal after the command completes.
6. Make sure that the provider status is **Ready**.

Use **Continue** to advance through the setup. If CoCo finds saved provider projects, select only the projects you want to import.

If you do not want to import projects, select **Do not import projects**. You can add a folder later.

If you use Cursor, install and authenticate its CLI with your team's approved procedure. The first setup does not have every provider's installer.

## Start your first chat

1. Select **New project** beside the sidebar project picker.
2. If a computer choice appears, select the intended computer.
3. Select **Local folder**.
4. Browse to your project folder.
5. Select **Add**.
6. Select **Build**.
7. Open **New thread** for that project.

If the workspace is empty, **Add project** opens the same project flow. For folder selection details, use [Projects and context](projects.md).

Before the first message:

1. Make sure that the header shows the correct project.
2. Select a provider and model in the composer.
3. Examine the CoCo agent selection.
4. Select **Supervised** in the access picker for this first test.
5. Enter: "Explain the project structure. Do not change files."
6. Select **Send message**.

The response appears in the conversation. The sidebar retains the conversation under its project.

If no provider is available, open [Settings → Providers](/settings/providers). Examine its installation, authentication, and error status on the correct computer.

For a provider that is absent or signed out, complete its CLI setup on that computer. Then refresh provider status in CoCo.

## Choose a workspace mode

| Mode       | Use                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **Manage** | Examine linked Jira work, risks, and the executive briefing. Use project chat beside the work view. |
| **Build**  | Work with the agent, project files, terminal, and Git controls.                                     |
| **Pursue** | This view currently shows **Coming soon**. Pursuit table data is not available.                     |

Manage and Build share the sidebar project selection. A conversation keeps its own project when you change views.

The selected mode supplies the default CoCo agent for a new chat. It does not replace a saved chat's agent instructions.

## Return after Help

1. Open **Settings**.
2. Select **Help** below **Archive**.
3. Search for your task or the error text.
4. Open the guide for your task.
5. Select **Back to Settings** when you are ready to return.

Help also opens from the command palette through **Open Help**. From a workspace, the return control is **Back to workspace**.

An unsent chat draft remains available when you return.

## Continue with your task

- [Projects and context](projects.md): folders, worktrees, and project scope.
- [Build and chat](build.md): access, plans, active turns, and file review.
- [Give chat useful context](chat-context.md): references, files, images, and saved prompts.
- [Connect Jira to your project](jira.md): SSO and the project link.
- [ServiceNow SDK and profiles](servicenow.md): SDK installation and account selection.
- [Find and fix a problem](troubleshooting.md): setup, connection, and execution errors.
