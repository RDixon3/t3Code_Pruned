# Settings and preferences

Use Settings to control app behavior, provider configuration, project defaults, and connections. This guide explains the General, Keybindings, Source Control, and Archive pages.

Separate guides explain [Appearance](appearance.md), [Providers](providers.md), [Connections](connections.md), and [SnapShots](snapshots.md).

## Find and change a setting

1. Select **Settings** at the bottom of the sidebar.
2. Enter the setting name or its purpose in the Settings search box.
3. Select a result.
4. Change the setting.
5. If the form shows **Save**, select **Save**.
6. Make sure the change saves without an error.

Settings opens the applicable page and section. Most switches and selections save automatically. Text forms with a **Save** action require that action.

If a save error appears, keep the form open until you correct it. An open Help article does not save an incomplete Settings form.

Some controls appear only in the desktop app or on a supported environment. A disabled control can show the reason in its description.

## Understand which setting changes which device

An **environment** is a running CoCo server with its own folders, provider installations, credentials, and chat history.

The **client** is the desktop app or local development web browser. Environments run on this computer: the desktop backend and, on Windows, an optional WSL backend.

| Scope                          | What it controls                                                    | Examples                                                                                         |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| This client                    | Display and interaction on this device or browser.                  | Appearance, time format, diff layout, confirmation preferences, model favorites.                 |
| One environment                | Configuration on the machine that runs the agent.                   | Provider paths, background activity, global SDK installation, project directories.               |
| Shared environment preferences | Preferences that CoCo applies to compatible connected environments. | Automatic settlement, restart continuation, text generation model, source control writing style. |
| One project                    | Defaults and context for that project.                              | Jira link, SDK profile, default model, workspace choices.                                        |
| One thread                     | Choices for a conversation.                                         | Current model, access mode, agent, pending context items.                                        |

The primary environment supplies most server settings outside pages with a device selector. On **Providers**, select the device before you change its configuration.

If **Settings differ on…** appears, compare the named environments before you select **Apply to all**. That action copies the primary environment's shared preferences.

A project selection does not change the desktop Jira account. It does not install a provider on another machine.

## General organization

Open [Settings → General](/settings/general).

**Project grouping** combines matching repositories from different environments in the sidebar. Turn it off to keep each environment's project separate. This changes grouping, not files.

**Auto-settle merged threads** moves a thread to the settled section after its pull request merges. The default is on. Closed pull requests still cause automatic settlement.

**Auto-settle inactive threads** moves inactive threads to the settled section. The default interval is three days.

1. Turn on **Auto-settle inactive threads**.
2. Set **Days of inactivity before auto-settle**.

New activity returns a settled thread to the active section. Settlement preserves the conversation. It is different from Archive and Delete.

Automatic settlement controls appear only when the environment supports this function. CoCo has no separate Pull Requests sidebar in this version.

## General display and interaction

These controls are in **General → Behavior**.

| Control                         | Use and result                                                                                                                         | Default         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Time format**                 | Select **System default**, **12-hour**, or **24-hour** for timestamps. System default uses the browser or operating system preference. | System default. |
| **Hide whitespace changes**     | Ignore edits that change only spaces, tabs, or line endings in the diff panel. Turn it off to see those edits.                         | On.             |
| **Diff layout**                 | Select **Stacked** for one combined view, or **Split** for the old and new text side by side.                                          | Stacked.        |
| **Proactive panels**            | Open related panels when the agent finds a linked pull request or changes files. Turn it off for manual panel control.                 | Off.            |
| **Show skills in slash menu**   | Include skills when you type `/`. Skills also appear when you type `$`.                                                                | On.             |
| **Collapse composer on scroll** | Reduce the input area to one line when you scroll an existing conversation. Select the input or type to expand it.                     | On.             |

The diff toolbar can also change **Diff layout**. That selection changes the same preference.

The skill menu only lists available skills. To install CoCo skills, use [Agents and native skills](agents.md).

## General updates and restart behavior

**Provider update checks** looks for newer versions of installed provider command-line tools. The default is on. Detection does not install an update automatically.

Use [Updates](updates.md) for the provider update action, ServiceNow SDK updates, and app releases.

**Continue threads after restarts** automatically resumes interrupted work after an app update, crash, or machine restart. The default is off.

1. Finish work that must not resume automatically.
2. Turn on **Continue threads after restarts**.
3. Use a current CoCo release before you enable this function.

The setting applies to connected environments that support restart continuation. It does not start completed threads again.

## General background activity

**Background activity** controls automatic status refreshes on the environment. It does not change a model's reasoning setting.

| Profile           | Behavior                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Balanced**      | Pauses background status requests when clients are idle, the host is locked, or low power mode is active. |
| **Performance**   | Permits background status requests while a subscribed client remains connected.                           |
| **Battery saver** | Also pauses background status requests when the host or client uses battery power.                        |
| **Advanced**      | Uses the shared policy and individual intervals that you set.                                             |

For normal use, select **Balanced**. For a device with limited battery power, select **Battery saver**.

To set individual intervals:

1. Select **Advanced**.
2. Select the configuration button beside the profile.
3. Select a **Shared policy**.
4. Set the applicable interval values in seconds.
5. Set the applicable pause switches.
6. Select **Done**.

| Advanced control              | Purpose                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Git fetch interval**        | Refreshes remote branch status. Zero disables automatic fetch.                                                            |
| **Provider health interval**  | Refreshes provider availability, versions, authentication status, and model information. Zero disables automatic refresh. |
| **Host power monitor**        | Reads host power status while clients are active. The minimum is five seconds.                                            |
| **Idle host monitor**         | Reads host power status when no client is in the foreground. The minimum is five seconds.                                 |
| **Pause when host is locked** | Pauses applicable background work when the environment's machine is locked.                                               |
| **Pause on host low power**   | Pauses applicable background work when that machine uses low power mode.                                                  |
| **Pause on client low power** | Pauses applicable background work when the connected client uses low power mode.                                          |
| **Pause on battery**          | Pauses applicable background work when the host or client uses battery power.                                             |

The shared policy can pause work even when an interval is not zero. A longer interval reduces refresh frequency and can leave status information older.

**Reset all** in this dialog restores the background activity defaults. It does not reset other Settings pages.

## General project and thread defaults

**New threads** opens project defaults. Use [Projects and context](projects.md) to set the default model, workspace, project actions, and project links.

**Start from origin** creates new worktrees from the latest matching branch on `origin`. The default is on.

A **worktree** is a separate working directory for a Git repository. It permits work on another branch without changes to the original working directory.

Turn off **Start from origin** to use the local branch as the starting point. The setting does not replace an existing worktree.

**Add project starts in** sets the initial folder in the Add Project browser.

1. Enter a directory on the environment's machine.
2. Leave the field to save the value.
3. Open Add Project to confirm the starting directory.

Leave this field empty to use `~/`, the user's home directory. This control sets a starting location, not a restriction on permitted project folders.

## General confirmations

| Control                  | Effect                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unpin confirmation**   | Asks before you remove a thread from the pinned section. The default is off.                                                                            |
| **Archive confirmation** | Requires a second click on the inline archive action. The default is off.                                                                               |
| **Delete confirmation**  | Asks before you delete a thread and its chat history. The default is on.                                                                                |
| **Quit shortcut**        | Controls the desktop quit shortcut. **Direct** quits immediately. **Hold** requires a hold or two quick presses. **Double press** requires two presses. |

The default **Quit shortcut** is **Hold**. This setting is available only in the desktop app.

**Unpin** and **Archive** preserve chat history. **Delete** removes chat history; do not use it to temporarily hide a thread.

## General text generation model

**Text generation model** is separate from the model in a chat. CoCo uses it for thread titles and other generated app text, including the executive briefing.

1. Open **General → Text generation**.
2. Open the model picker.
3. Select an available provider instance.
4. Select its model.
5. Set the available reasoning or other model options.
6. Return to the function that failed.
7. Try generation again.

The selected provider must be available on the environment that performs generation. A different chat model does not repair this setting.

If **No text generation providers available** appears, install or authenticate a supported provider. Then refresh its status in [Providers](providers.md).

Source control can use a separate writer model. That override does not change the executive briefing model.

## General version and diagnostics

**About** shows the current app version.

Install newer CoCo versions through your team's distribution channel. See [Updates](updates.md) for the procedure.

Select **View diagnostics** to read environment diagnostics. Use [Troubleshooting](troubleshooting.md) for the applicable failure and information to collect.

## General legacy features

Expand **Legacy features** only if a previous workflow is necessary.

| Control                               | Result                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Plan mode (legacy)**                | Restores the composer Build/Plan control, `/plan`, `/default`, and Shift+Tab. Without it, the composer uses build mode. |
| **Context window indicator (legacy)** | Shows a circular context usage indicator in the composer.                                                               |
| **Stream token by token (legacy)**    | Displays individual output tokens. This can make output slower and harder to read.                                      |
| **Sidebar (legacy)**                  | Uses a separate thread tree for each project instead of the default flat sidebar.                                       |

All four controls default to off. The legacy composer **Build/Plan** control is different from CoCo's **Pursue | Manage | Build** navigation.

## Change a keyboard shortcut

Keybindings are keyboard shortcuts assigned to commands. The **When** condition limits where a shortcut applies.

1. Open [Settings → Keybindings](/settings/keybindings).
2. Use the page search to find the command.
3. Select its current shortcut.
4. Press the new key combination.
5. If necessary, edit **When**.
6. Select **Save**.
7. Open the applicable app view.
8. Test the shortcut there.

To add a new shortcut:

1. Select **Add keybinding**.
2. Select **Command**.
3. Record the shortcut.
4. If necessary, set **When**.
5. Select **Save**.

**Always** applies without a condition. The condition editor supports individual conditions and AND/OR groups. Keep a condition if the command applies only in one view.

A conflict indicator identifies another command with the same shortcut in an overlapping context. Change the shortcut or condition before you rely on it.

Use a row's action menu to **Reset to default** or **Remove** a custom binding. Default bindings do not have a Remove action.

Select **Open keybindings.json** for direct editing in the configured editor. These bindings belong to the primary environment.

The browser can intercept a shortcut before CoCo receives it. If the shortcut fails only in a browser, use another combination or the desktop app.

## Set up source control

[Settings → Source Control](/settings/source-control) reports tools and credentials on the environment's machine. It does not install them through the availability switches.

1. Open **Source Control**.
2. Read the Git installation status.
3. Read the authentication status for the required hosting service.
4. If a tool or login is missing, complete the action in the status message on that machine.
5. Select **Rescan Git and hosting integrations**.

The expected result is an available Git installation and authenticated hosting service. The availability switches are status indicators; they are not configuration controls.

CoCo displays Git, GitHub, and Azure DevOps when the environment reports them. Jujutsu, GitLab, and Bitbucket are hidden in this version.

A successful provider login for Codex, Claude, or Cursor is separate from Git hosting authentication.

Expand the Git row to set **Git fetch interval**. Set zero to disable automatic fetch. Background activity policy can pause nonzero intervals.

If authentication succeeds but a repository action fails, make sure the account has access to that repository. Then read the action's error.

## Set source control writing preferences

These controls affect generated source control text, not your manually entered text.

| Control                             | Selection and effect                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source control writing style**    | **Repository conventions** uses recent change descriptions and request titles. **Conventional Commits** uses conventional prefixes. **Custom instructions** uses your text across projects. |
| **Follow change request templates** | Uses the repository's template when a change request description is generated.                                                                                                              |
| **Source control writer model**     | Turn on the override to select a separate model for generated descriptions, titles, and branch names. Off uses **Text generation model**.                                                   |

For custom instructions:

1. Select **Custom instructions**.
2. Enter the required style in the text area.
3. Leave the text area to save the instructions.

For a writer model override:

1. Turn on **Source control writer model**.
2. Select an available provider instance.
3. Select its model.

Writing style is a shared environment preference. The writer model override belongs to the primary environment.

## Restore an archived thread

1. Open [Settings → Archive](/settings/archived).
2. Find the thread under its project.
3. Select **Unarchive**.
4. Return to the sidebar.

The thread returns with its saved conversation. Archive lists threads from connected environments; an offline environment can prevent its history from loading.

The thread's context menu also contains **Unarchive** and **Delete**. Delete removes chat history. It is not an alternative way to restore a thread.

If **Could not load archived threads** appears, restore the environment connection before you try again.

## Restore settings defaults

Use the reset action beside one changed setting when only that value is incorrect.

For a wider reset:

1. Open **General**.
2. Select **Restore defaults**.
3. Read the list of settings in the confirmation.
4. Confirm only if those changes are correct.

The reset changes the listed preferences. It is not a complete app reset, credential deletion, or chat deletion.

The list can include theme choices and agent browser access. A reset can therefore change more than the currently visible General section.

## Continue with other Settings pages

| Task                                                | Guide                                 |
| --------------------------------------------------- | ------------------------------------- |
| Change themes, fonts, contrast, or animation        | [Appearance](appearance.md)           |
| Set project defaults, Jira links, or SDK selections | [Projects and context](projects.md)   |
| Install a provider or configure another account     | [Providers](providers.md)             |
| Configure agent instructions and skills             | [Agents and native skills](agents.md) |
| Connect Jira                                        | [Jira](jira.md)                       |
| Set up ServiceNow connections and SDK profiles      | [ServiceNow](servicenow.md)           |
| Capture another app for a chat                      | [SnapShots](snapshots.md)             |
| Check the local connection or configure WSL         | [Connections](connections.md)         |
