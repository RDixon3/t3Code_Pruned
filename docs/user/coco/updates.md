# Keep CoCo and its tools current

CoCo, provider tools, the ServiceNow SDK, and skills have separate versions. An update to one component does not update the other components.

## Select the correct update

| Component                     | Where to start                                            | What changes                                                                                          |
| ----------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| CoCo desktop app              | Your team's CoCo release source                           | The application and its included local server                                                         |
| Codex, Claude Code, or Cursor | **Settings → Providers**                                  | The selected provider installation on its environment                                                 |
| ServiceNow SDK                | **Settings → Integrations → ServiceNow → ServiceNow SDK** | The global SDK installation on this desktop                                                           |
| Bundled skills                | **Settings → Agents & Skills**                            | The managed skill files for the enabled providers                                                     |
| Content repository            | **Settings → Agents & Skills**                            | At this time, only the saved repository definition changes. Remote content updates are not available. |

Install CoCo releases from your team's distribution channel. Provider and SDK updates have their own controls in Settings.

## Prepare for an update

1. Identify the component and machine in the update notice.
2. Save unsent chat text with **Stash**.
3. Wait for active agent tasks and terminal commands to finish.
4. If a task cannot finish, use **Stop** in that chat.
5. Save file changes in any external editor.
6. Read the release instructions for the component.

An update can restart a process or interrupt its connection. A saved chat is not a guarantee that every active command can resume.

**Settings → General → Continue threads after restarts** is off by default. It controls automatic recovery for supported threads on your local environments.
It does not start CoCo when the computer starts. Terminal commands and threads without saved provider state can still require manual recovery.

Refer to [Settings walkthrough](settings.md) for the recovery setting and **Apply to all**.

## Update the CoCo desktop app

When your team configures an application update source, CoCo can notify you about available updates and offer download and restart actions. Current pilot releases use manual installers for Apple Silicon macOS and Windows x64.
The development app does not install production updates.

Use the CoCo release supplied by your team.

1. Open **Settings → General → About**.
2. Record the installed application version.
3. Open your team's CoCo release source.
4. Select a release for your operating system and processor.
5. Download its installer.
6. Quit CoCo.
7. Install the release as specified by your team.
8. Open CoCo.
9. Open **Settings → General → About** again.
10. Make sure that the version agrees with the release.
11. Open an existing project.
12. Make sure that its chats and settings are available.

For the Apple Silicon DMG, put **CoCo.app** in **Applications**. If macOS requests a replacement, make sure that the target is your existing CoCo application.

For Windows x64, run the EXE installer for the new release. Use the same CoCo installation location.

Keep the CoCo data directory. An application replacement does not require deletion of chats, project folders, or credentials.

If the operating system blocks installation or startup, use [Launch problems](troubleshooting.md#the-app-does-not-start).

## Update a provider

Provider updates apply to the environment that owns the installation. A Windows update does not update a provider installed inside WSL.

1. Open [Providers](/settings/providers).
2. Select the environment that runs the affected chat, if an environment selector is present.
3. Open the provider installation named in the update notice.
4. Read its installed version.
5. If an update indicator appears, select **Update available — view details** beside the version.
6. Read the available update details.
7. If **Update now** is available, select it.
8. Wait for the update result.
9. Make sure that the provider reports the expected version and a usable status.
10. Start a new chat to use new provider capabilities.

If **Update now** is absent, use that provider's supported installation procedure on the correct machine.
Refer to [Providers and models](providers.md) for installation, sign-in, and executable-path problems.

**Settings → General → Provider update checks** controls provider update checks. It is separate from app updates and SDK update checks.
A dismissed notice does not install an update. You can still use the available action in Providers.

An updated provider can change its available models, commands, or skill behavior. An existing chat can retain its current provider session.

## Update the ServiceNow SDK

The desktop does one SDK update check per window launch. Project changes and tab changes do not start more launch checks.

If a newer version is available, the notice offers **Update** and **Settings**. Dismissal suppresses that notice; it does not update the SDK.

Use this procedure for a manual check and update:

1. Stop active SDK commands.
2. Finish or cancel any SDK profile sign-in.
3. Open [Integrations](/settings/integrations#servicenow-sdk).
4. Find **ServiceNow SDK** below **Instance connection**.
5. Select **Check for updates**.
6. Wait for the installed version and latest published version.
7. Read the **Global packages** path.
8. Make sure that this path identifies the npm environment you intend to update.
9. If an update is available, select **Update to v…**.
10. Wait for **Installed globally** and the new version.

CoCo installs the displayed version. It then makes sure that the global package path and installed version agree with the request.
The update action does not permit a downgrade. It does not change the saved project profile selection.

| Control               | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| **Check again**       | Read the SDK installation in the current global npm environment.    |
| **Check for updates** | Read the installation and request the latest published SDK version. |
| **Install SDK**       | Install the SDK when it is absent from that global environment.     |
| **Update to v…**      | Install the newer version shown in the panel.                       |

If the global package path changes before the update, CoCo rejects the outdated update request. Repeat **Check for updates** in the intended environment.

Refer to [ServiceNow SDK and profiles](servicenow.md) for SDK installation and account setup.

## Synchronize agents and skills

The agent library comes with CoCo. At this time, a saved repository URL does not supply agent or skill content.

1. Open [Agents & Skills](/settings/agents).
2. In **Native skills**, read the synchronization status and installed-copy count.
3. Expand **Installation locations**.
4. Make sure that the destinations belong to the intended environment and provider accounts.
5. If synchronization is disabled, select **Enable installation**.
6. If synchronization is enabled, select **Resync bundled skills**.
7. Read the updated installed-copy count and any error.
8. If the provider requires a new session to find changed skills, start a new chat.

The current bundle has no task-specific skill packages. Synchronization cannot install content that the bundle does not contain.

An existing chat retains its saved agent instructions. Shared skill files can change independently of those instructions.
Refer to [Agents and native skills](agents.md) before you change provider destinations or remove managed files.

## Update the included server

The desktop installer includes its local server. Install the new CoCo release and restart the app to use both together.

For a source checkout, update the checkout and follow [Development setup](development.md). Reloading a browser page does not replace a running development server.

## If an update fails

| Result                                                   | Next action                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| App updates are unavailable in the development app       | Update the checkout, then restart its development processes.                                                        |
| A provider has no update action                          | Use its supported installation method on the named environment.                                                     |
| npm cannot start                                         | Make sure that Node.js and npm are available to the desktop process. Restart CoCo after a PATH change.              |
| The SDK registry check fails                             | Record the network or registry error. Use **Check again** to examine the installed package separately.              |
| An SDK update fails                                      | Read the error and final installed version. CoCo attempts a new installation check after failure.                   |
| An update notice disappears but the version is unchanged | The notice can be dismissed without an installation. Open the component's settings to examine its status.           |
| The local connection does not return                     | Quit and reopen CoCo. If the problem continues, record the startup error and consult [Connections](connections.md). |
| A new skill is absent                                    | Examine the bundled-library status and provider destination. A saved repository URL alone does not download skills. |

For a support request, include the CoCo version, the affected tool's version, and the exact failure text. Refer to [Collect useful evidence](troubleshooting.md#collect-useful-evidence).
