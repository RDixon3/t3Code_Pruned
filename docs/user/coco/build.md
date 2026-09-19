# Build and chat

Use Build for agent-assisted work in a project folder. The provider runs the agent through its own account and capabilities.

A thread is a saved conversation. A turn starts when you send a request and ends when the agent stops or completes that request.

## Start with the right project and provider

1. Select the project in the sidebar.
2. Select **Build**.
3. Select **New thread**.
4. Make sure that the header shows the intended project.
5. Examine the workspace and branch near the composer.
6. Select the provider and model.

Use **New thread in...** in the command palette to select another project directly. Use [Projects and context](projects.md) for folder and worktree choices.

Before you send the first request:

1. Select the CoCo agent instructions for the chat.
2. Examine the model's available effort options.
3. Select the required access mode.
4. Examine the **SDK** selection, if the task uses ServiceNow.
5. Describe the required result and its constraints.
6. Select **Send message**.

| Selection                 | What it controls                                                          |
| ------------------------- | ------------------------------------------------------------------------- |
| Provider                  | The runtime, such as Codex, Claude, or Cursor, that executes the request. |
| Model                     | The model available through that provider account.                        |
| Effort or service options | Provider-specific options that affect the response, speed, or usage.      |
| CoCo agent                | Saved instructions for the chat, such as Build or Manage.                 |
| Access                    | When the provider requests permission for actions.                        |
| SDK                       | The ServiceNow auth profile selected for the project that owns the chat.  |

The Build mode supplies the Build agent as the initial choice for a new chat. An explicit agent choice replaces that default before the chat starts.

A saved conversation retains its provider and saved CoCo agent. A change between Manage and Build does not replace them.

Start a new chat to use another provider or CoCo agent. If the provider locks model changes after the first message, use a new chat for another model.

If a provider is unavailable, open [Settings → Providers](/settings/providers). Examine its status on the environment that owns the project.

## Give the agent useful context

A good request states the outcome, scope, and completion conditions. Include the relevant files or records instead of an unrelated project history.

For example:

> Update the portal error message. Use the attached screenshot. Preserve the current layout. Run the relevant tests. Report the changed files and results.

The project's Jira link and SDK selection apply automatically to ordinary turns. They do not load all Jira issues or grant tools that are unavailable.

Use [Give chat useful context](chat-context.md) for these tasks:

- Attach an issue or risk as a reference chip.
- Add a project path, uploaded file, or image.
- Attach terminal output or a preview annotation.
- Select a native skill or command.
- Save and restore an unsent prompt with **Stash**.

## Choose how the agent can act

Open the access picker beside the model controls.

| Mode                  | Expected behavior                                                                 |
| --------------------- | --------------------------------------------------------------------------------- |
| **Supervised**        | The provider asks before commands and file changes.                               |
| **Auto-accept edits** | The provider can approve edits automatically. Other actions can require approval. |
| **Auto**              | A supported provider can approve routine actions. Other providers still ask.      |

The provider determines the exact approval behavior. A mode name does not grant access that the account or operating system prevents.

**Auto** is the default. Use **Supervised** when you want to examine each proposed action. Previously saved Full Access selections now use Auto.

Project selections give the agent a target. They do not authorize a deployment or restrict the account to that target.

### Answer an approval request

1. Read the requested action in the conversation.
2. Examine its target folder, command, or external system.
3. Select the available approval or rejection option.
4. Wait for the conversation to continue.

The available choices depend on the provider. A rejection does not reverse actions that completed before the request.

If **Always allow this session** is available, it grants a wider approval than **Approve**. Read any provider warning before that selection.

### Answer a question

1. Read the current question.
2. Select an answer, or enter the requested text.
3. If more questions remain, select **Next question**.
4. Use **Previous** if you must correct an earlier answer.
5. Select **Submit answer** or **Submit answers** when the answers are complete.

A draft request does not answer a pending approval automatically. Use the controls for the active approval or question.

## Plan before changes

When the provider supports plan mode, the composer has a **Plan** or **Build** control. This control differs from the top-level Build workspace mode.

1. Select **Plan** in the composer.
2. Describe the result you want and the constraints.
3. Send the request.
4. Read the proposed plan.

When **Plan ready** appears:

- To change the plan, enter the correction and select **Refine**.
- To execute the plan in this conversation, leave the prompt empty and select **Implement**.
- To use another conversation, open **Implementation actions** and select **Implement in a new thread**.

A refinement continues plan work. **Implement** submits the plan for execution in normal mode.

Native `/plan` and `/default` entries can also select an interaction mode when CoCo offers them. Use the available controls for the selected provider.

## Continue, stop, or resume work

### Send another instruction

On desktop, **Enter** sends the current prompt. **Shift+Enter** inserts a new line.

While the agent works, you can send a correction from the composer. The provider determines whether it steers the active turn or processes a queued message.

A sent correction is an instruction, not an undo action. Make the changed requirement explicit.

For example:

> Stop work on the report export. Complete only the error message and its tests.

To retain an idea for later, leave it in the draft or use **Stash**.

### Start a new chat in the background

For an unsent new chat, **Ctrl+Enter** on Windows or **Command+Enter** on macOS starts the task in the background.

CoCo shows a confirmation when the task starts. Use its **Open** action or the sidebar conversation to return to the task.

This shortcut starts work immediately. It does not create a reminder or a schedule.

### Stop a turn

1. Select **Stop generation** in the composer.
2. Wait for the active work to stop.
3. Examine the final output and any changed files.

If a **Background work**, **Monitoring**, or active-agent banner remains, use that banner's **Stop** control to stop the unfinished work.

A stop request does not undo file edits, commits, or external changes that already completed. Examine the final state before another request.

### Resume a conversation

1. Select the project that owns the conversation in the sidebar.
2. Open the saved conversation.
3. Read its last response and any error.
4. Make sure that its environment and provider are available.
5. Send a new instruction that states what remains to be done.

An unsent draft remains attached to its conversation when you navigate elsewhere. Drafts do not have a shared copy across computers.

If a send fails, examine the restored draft before you retry. CoCo retains newer draft content. It does not replace that content with an older failed submission.

If **Resume with less context** is available, read its explanation before you use it. Compaction changes provider context; it is separate from project selection.

## Review and continue work

### Examine changes

1. Open the conversation's diff panel from its file changes.
2. Select the required diff scope.
3. Read each changed file.
4. Run or request the relevant tests.
5. Compare the test results with the requested outcome.

| Diff scope         | What to examine                                  |
| ------------------ | ------------------------------------------------ |
| **Latest turn**    | Changes recorded for the most recent turn.       |
| **Turn**           | Changes recorded for a selected earlier turn.    |
| **Working tree**   | The current uncommitted file changes.            |
| **Branch changes** | Differences against the selected base reference. |

Use **Split diff view** for side-by-side comparison. Use **Stacked diff view** when a narrow panel makes side-by-side text difficult to read.

A turn diff is a recorded result. Use **Working tree** to examine the current files after later edits.

If you add a review comment to the composer, send it with the requested correction. A draft comment does not instruct the agent until submission.

### Use files, an editor, or the terminal

The command palette includes **Go to file** and **Search project contents**. Use a path search for a known file and a content search for text inside files.

The editor control opens the active workspace in an available editor. For a worktree chat, the active workspace is the worktree folder.

The terminal panel runs commands on the conversation's environment. Confirm its path before a command that changes files.

To discuss terminal output:

1. Select the relevant output text.
2. Select **Add to chat**.
3. Enter the question about that output.
4. Send the message.

A project action can run a saved command from the header. Read the action's definition in project settings before you use an unfamiliar action.

### Commit or push reviewed work

Git actions appear in Build when the project has a repository. The main action changes with the repository state.

1. Open **Git action options**.
2. Select the required action.
3. Examine the branch and included files in the confirmation.
4. If necessary, use **Edit** to change the included files.
5. Enter or examine the commit message.
6. Confirm the action.

**Commit** records selected changes locally. **Push** sends commits to the remote repository. **Commit & push** performs both operations.

Source-control authentication is separate from the provider account. If push fails, examine the Git error and [Source Control settings](settings.md#set-up-source-control).

A clean or successful diff does not prove that the application works. Use the project's required verification before you publish changes.

### Revert a conversation checkpoint

Use **Revert to this message** only when the provider supports conversation rollback. Stop the active turn first.

1. Find the earlier user message.
2. Select **Revert to this message**.
3. Read the destructive-action confirmation.
4. Confirm only if the checkpoint is the intended target.

This operation discards newer messages and turn diffs. The action cannot be undone through CoCo.

It is not a rollback for Jira changes, ServiceNow actions, or other external side effects. Examine those systems separately.

## Organize conversations

Use the conversation's sidebar context menu for available actions. The connected environment determines which actions appear.

| Action             | Result                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Rename thread**  | Changes the conversation title for easier retrieval.                                                 |
| **Pin thread**     | Keeps the conversation in the pinned group. Use **Unpin thread** to remove the pin.                  |
| **Settle thread**  | Moves completed work to the **Settled** group. Use **Un-settle thread** to return it to active work. |
| **Snooze**         | Hides the conversation until the selected time. Use **Wake thread** to return early.                 |
| **Archive thread** | Removes the conversation from the active list but retains its history.                               |
| **Delete**         | Removes the conversation and its history. Read the confirmation before use.                          |

Use [Settings → Archive](/settings/archived) to find and restore an archived conversation. Project removal also removes archived history for that project.

If a thread appears stuck or a tool is unavailable, use [Find and fix a problem](troubleshooting.md).
