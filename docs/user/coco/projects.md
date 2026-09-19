# Projects and context

A project is a folder on an environment. An environment is the computer and CoCo server where the agent runs commands.

A conversation belongs to one project. The project's Jira link and SDK profile selection supply context for its conversations.

## Select the right project

To add a folder that already exists:

1. Select **New project** beside the sidebar project picker.
2. If a computer choice appears, select the computer that contains the folder.
3. Select **Local folder**.
4. Enter the folder path, or browse to the folder.
5. Select **Add**.
6. Make sure that the project name appears in the sidebar.

**Add project** in the empty workspace and command palette opens the same flow. The folder browser shows folders on the selected environment.

To open a folder in the browser, select its row. To add the displayed path as a project, use **Add**.

If **Create & Add** appears, the path does not identify a folder on disk. Correct the path to use your current project.

A project can contain subdirectories for separate efforts. For example, one project can contain `portal`, `integration`, and `reports` folders.

In a chat, identify the subdirectory in your request or attach a file reference. A subdirectory does not automatically become a separate CoCo project.

Create separate projects if the efforts require different Jira links or SDK selections. Each project has its own integration context.

### Add a repository

If the repository is not on disk, the same project flow can clone it.

1. Select **New project**.
2. Select the target computer, if prompted.
3. Select **Git URL** or an available repository source.
4. Enter or select the repository.
5. Select the destination folder.
6. Select **Clone** after you examine the repository and destination.

For **Git URL**, use **Continue** after the URL. For a repository source, use **Lookup** to find the repository before its destination.

If **Setup Required** appears, use [Source Control settings](settings.md#set-up-source-control) to configure the account. Provider sign-in does not authenticate Git.

### Change the selected project

1. Open the sidebar project picker.
2. Select the project you want to use.
3. Make sure that the conversation list shows that project's work.
4. Open the required conversation, or select **New thread**.

Manage and Build share this selection. CoCo can return to the project's most recent conversation.

An open conversation remains attached to its project. A mode change does not move its files, integrations, or history to another project.

## Choose the workspace for a new chat

The workspace choice determines which copy of the project files the agent uses. Git projects show this choice near the composer.

| Choice                | Result                                                           | Use it when                                      |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| **Current checkout**  | The chat uses the current project folder and its current files.  | You want to work directly in that folder.        |
| **New worktree**      | CoCo prepares another Git worktree when the chat starts.         | You want separate files for a parallel effort.   |
| **Previous worktree** | The chat uses the most recently used available project worktree. | You want a new conversation about that worktree. |

A worktree is another folder for a Git branch. It does not supply a separate machine, account, or set of credentials.

Before the first message:

1. Open the workspace selector.
2. Select the required workspace choice.
3. If you selected **New worktree**, select its base branch.
4. Examine the displayed branch or **From** reference.
5. Send the first request.
6. Wait for **Preparing worktree** to complete, if shown.

Project and machine defaults can select the initial workspace choice. The branch reference can use `origin` when that default is enabled.

If Git is unavailable or the folder has no repository, use the current folder. **Initialize Git** creates a repository when you require Git features.

Chats in **Current checkout** share the same files. A branch change in another tool can affect all chats that use that checkout.

If CoCo reports a branch mismatch, examine the current branch before you continue. **Restore branch** returns to the thread's saved branch after confirmation.

## Set project defaults

1. Open [Settings → Projects](/settings/projects).
2. Select the intended project scope.
3. Select the intended machine scope.
4. Examine whether each value is inherited or overridden.
5. Change only the defaults that this project requires.
6. Start a new chat to confirm the new defaults.

The **All projects** scope shows machine defaults. A named project shows that project's overrides.

For machine defaults, changes apply only to connected machines in the selected scope. Offline machines retain their current defaults.

If a model is unavailable on one selected machine, select that machine separately. Choose a model that its provider can use.

### Choose a project value

| Setting                  | Purpose and effect                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Name**                 | The shared project name in the sidebar and conversation lists. Press **Enter** or leave the field to save.                 |
| **Project icon**         | Use **Choose icon** for an icon or emoji. Use **Choose file** for an image. Reset restores the automatic icon.             |
| **Jira project**         | The saved Jira site and project link. Use the procedure below to set or clear it.                                          |
| **Default merge method** | The initial merge method for this project's pull requests. **Last selected** uses the previous selection.                  |
| **Model**                | The default provider model for new chats. It does not replace the model in a saved chat.                                   |
| **Workspace**            | The initial **Current checkout** or **New worktree** choice. Reset uses the checkout's `t3.json` value or machine default. |
| **Automatically pull**   | Keeps the default branch current when the checkout has no local changes or commits.                                        |
| **Agent browser access** | Controls agent access to the preview browser. A project override applies when the agent session starts next.               |

Use **Inherit defaults** for browser access when the machine's policy is sufficient. Use **On** or **Off** for an explicit project override.

An automatic pull does not resolve local changes or merge conflicts. Examine the repository state if it cannot update.

Some controls apply to several grouped checkouts.

If the page shows mixed values, a new selection can update all selected checkouts. Select one checkout first for a change to that checkout only.

Use the reset control to return an overridden value to its inherited default. This differs from an explicit **None** integration selection.

### Set checkout grouping

1. In the **Checkout** section, select the intended checkout, if a selector appears.
2. Open **Project grouping**.
3. Select the required grouping rule.

The available rules group by repository, group by repository and path, or keep checkouts separate. **Use global default** removes the checkout override.

A grouping change can move the checkout to a different sidebar group. It does not move its files on disk.

### Add a project action

A project action is a saved command, such as a test or local application start command. Actions belong to the selected checkout.

1. In **Checkout**, select the intended checkout.
2. In **Actions**, select **Add action**.
3. Enter the action name.
4. Enter the command.
5. Set optional shortcut, preview, and automatic-run options.
6. Select **Save action**.

| Option                                               | When to use it                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Shortcut                                             | Run a frequent action from a key combination.                                       |
| **Preview URL (optional)**                           | Associate an application address with the action. The preview is a desktop feature. |
| **Run automatically on worktree creation**           | Run project setup when CoCo creates a worktree.                                     |
| **Open preview automatically when this action runs** | Open the supplied preview URL when the command starts.                              |

Read the command before you enable automatic execution. A saved action runs a command; it is not a request for the agent to explain it.

To change an action, use its edit control and select **Save changes**. To remove it, select **Delete** in the editor and confirm.

If **Import scripts** is available, it lists actions from the checkout's `t3.json`. Select an entry to add it to project actions.

Actions can inherit machine defaults. Use the reset control to remove the checkout override and return to those defaults.

If a save error appears, correct the connection problem before you repeat the change. Do not assume that every selected machine saved the value.

## Link a Jira project

First [connect Jira on the desktop](jira.md). The connection supplies account access; the project link identifies the Jira work for this CoCo project.

1. Open this project's settings.
2. Open **Jira project**.
3. Select the Jira site, if more than one site appears.
4. Select the Jira project.
5. Make sure that the saved link shows the expected project key and site.

If only one site is available, the picker opens its project list directly. You can also open **Link Jira project** in Manage.

The picker saves the selection immediately. If an error appears, the new link is not confirmed.

The link applies to this project across CoCo. It also applies to Build chat. It does not apply only to Manage.

To remove the link, open the same picker and select **None**. This does not sign out of Jira or change any Jira issue.

## Choose an SDK target

The SDK target is a ServiceNow SDK auth profile. It is separate from the ServiceNow connection that supplies pursuit data.

1. Open a chat for the intended project in the local desktop app.
2. Open **SDK** to the right of the access picker.
3. Select the required profile.
4. Make sure that the picker shows the saved alias.

The help text states **Applies to this project**. Other conversations in the same project use the same selection.

The picker remains visible without a project. Select a project before you assign a profile.

To clear the selection, choose **None**. To create or delete a profile, use [ServiceNow SDK and profiles](servicenow.md).

CoCo saves the alias and instance URL only. The SDK retains its credentials. If the saved profile is absent, CoCo does not silently select another profile.

## Understand what reaches the agent

When CoCo prepares a turn, it adds the project's current integration references to provider input. SDK guidance identifies the selected alias.

| Context                     | Source                                   | When it applies                          |
| --------------------------- | ---------------------------------------- | ---------------------------------------- |
| Jira site and project       | This project's saved Jira link           | The next turn that CoCo prepares         |
| SDK alias and instance      | This project's saved SDK selection       | The next turn that CoCo prepares         |
| Jira issue or risk snapshot | A reference that you add to the composer | The message that includes that reference |
| CoCo agent instructions     | The agent selected for this chat         | The chat's saved agent configuration     |

Project context stays out of CoCo's visible user message. It can appear in the provider's own history or logs.

Issue attachments remain visible as chips in CoCo. Their saved snapshots differ from the current project configuration.

Changes apply to the next prepared turn. This also applies to queued work. They do not change a turn that CoCo already sent.

Native slash commands remain unchanged. An explicit **None** selection tells subsequent ordinary turns that no integration target is selected.

Worktrees inherit their project's integration selections. The sidebar's current selection does not replace the project that owns a conversation.

These references give the agent guidance. They do not grant tool access, restrict account permissions, or authorize deployment.

## Remove a project

Use project removal only when you want to remove its CoCo conversations.

1. Open the intended project's settings.
2. Examine the project and machine scope.
3. Select **Remove project**, or the displayed checkout removal control.
4. Read the confirmation and its conversation count.
5. Confirm only if you want to remove that history.

Removal leaves project files on disk. It permanently removes the selected project's conversation history. This also removes archived conversations.

For a conversation that you want to retain, use **Archive thread** instead. See [Organize conversations](build.md#organize-conversations).
