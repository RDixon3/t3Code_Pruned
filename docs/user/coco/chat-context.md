# Give chat useful context

Use context to identify the files, records, or output that the agent must use. State the required action in the prompt.

A context chip is a compact reference above the chat input. Select the chip to examine its contents before you send it.

## Select the right kind of context

| Context              | What the agent receives                                                      | Use                                                 |
| -------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| Project path mention | A reference to a file or folder in the workspace                             | Ask the agent to examine current project files.     |
| Uploaded file        | A file supplied to the conversation's environment                            | Supply a document or file outside the workspace.    |
| Image                | The attached image, subject to provider support                              | Show appearance, an error, or a visual requirement. |
| Jira issue or risk   | A saved snapshot of selected issue fields and its source identity            | Ask about specific project work.                    |
| Terminal selection   | The selected output and its terminal context                                 | Explain a command result or error.                  |
| Preview annotation   | Selected page elements, regions, or marks, with available screenshot context | Identify a specific part of a page.                 |
| Assistant citation   | A selected passage from an earlier response                                  | Correct or expand a specific statement.             |

An attachment does not authorize a change. For example, add a Jira risk and state whether the agent must explain it or update it.

## Add a Jira issue or risk

First select a CoCo project with a [Jira link](jira.md). Manage must have loaded the relevant issue.

Work cards have **Add to chat draft** in the three-dot menu. Risks have **Add to chat** beside the risk details.

1. Open **Manage**.
2. Find the issue or risk.
3. Select its chat action.
4. Select the new chip above the chat input.
5. Examine the record key, title, and snapshot.
6. Enter the instruction for that record.

For example:

> Explain this risk in one paragraph. Read its current Jira details before you make a recommendation. Do not change the issue.

The action adds a reference to the current project chat. It does not send a message or replace current prompt text.

The Jira snapshot includes the issue key, title, type, status, and assignee. It does not contain the full description, comments, or every Jira field.

The snapshot uses the issue data already loaded in Manage. The attachment action does not request fresh Jira data.

### Update or remove a pending reference

- To remove a reference from the unsent draft, select its **×** control.
- To update the snapshot, refresh the board and add the same issue again.
- To open the original issue, select the chip and then **Open in Jira**.

When you add the same issue from the same Jira site again, CoCo replaces its pending snapshot. It does not add a duplicate chip.

Removal changes the draft only. It does not delete the Jira issue or revoke Jira access.

A draft can contain up to 20 source references. If the limit is reached, remove unnecessary references or split the request.

## Understand a sent reference

After submission, the message shows the reference as a chip. Select it to examine the snapshot that accompanied that message.

The sent snapshot does not refresh when Jira changes. Ask the agent to retrieve current details when freshness matters.

The agent receives the snapshot as part of the message context. Its provider can retain that context in native history or logs.

A Jira chip does not prove that Jira tools are ready in the chat. Use [Connect Jira to your project](jira.md) if the agent cannot retrieve details.

The current app has Jira issue and risk attachments. Other external sources can use the same reference format in future versions.

## Mention a project file or folder

1. Type `@` in the composer.
2. Enter part of the path.
3. Select the file or folder from the results.
4. State what the agent must examine or change.

The path belongs to the conversation's environment and workspace. A Windows path is not automatically a valid WSL project path.

Use a folder mention to identify an effort within a larger project. For example, mention `portal` when the task applies only to that subdirectory.

## Attach a file or image

1. Select **Attach files** in the composer.
2. Select the required files.
3. Wait for the attachment previews or upload status.
4. Remove any unwanted attachment with its **×** control.
5. Enter the instruction for the attachments.
6. Send the message after uploads complete.

You can also drop files onto the composer or paste an image from the clipboard.

Files upload to the environment that owns the conversation. The owning Windows or WSL environment must be connected before CoCo can supply those files.

Large pasted images can take time to prepare. Wait for the thumbnail before you send.

### Resolve an attachment problem

| Message or state             | Action                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| Upload is still active       | Wait for completion before submission or stash.               |
| Failed upload                | Use **Retry upload**, or remove the attachment.               |
| File expired                 | Remove the expired entry and attach the original file again.  |
| Original file is unavailable | Attach the file again from disk.                              |
| Unsupported image type       | Export the image to a supported format, then attach it again. |
| Attachment or prompt limit   | Remove unnecessary content or split the request.              |

A file reference in an old draft does not guarantee that its temporary upload still exists. Keep the original file until the task is complete.

## Add terminal output

1. Open the terminal panel for the conversation.
2. Select the relevant output text.
3. Select **Add to chat** from the selection or context menu.
4. Examine the terminal reference in the composer.
5. Enter the question or correction.
6. Send the message.

Select the smallest output range that shows the problem. The whole terminal history can hide the relevant error.

## Add a page annotation or screenshot

When the desktop preview controls are available:

1. Open the page in the preview panel.
2. Select **Annotate preview**.
3. Identify the required element or region.
4. Select **Attach** in the annotation controls.
5. Examine the attached context before submission.

**Enter** attaches an annotation. **Ctrl+Enter** on Windows or **Command+Enter** on macOS sends it directly from the annotation input.

An annotation can remain useful if its screenshot capture fails. Read the notification to determine which context CoCo retained.

To attach a plain preview screenshot:

1. Select **Capture screenshot**.
2. Select **Copy image** in the saved-screenshot notification.
3. Paste the image into the composer.
4. Enter the instruction about the screenshot.
5. Send the message.

Screenshot capture saves an artifact. It does not send that artifact to the agent automatically.

## Cite an assistant response

1. Select the relevant text in an assistant response.
2. Select **Cite in composer**.
3. Enter the correction or question beside the citation.
4. Send the message.

Use a citation when the task depends on the exact earlier text. This gives the agent a precise passage instead of an ambiguous reference.

## Select skills and commands

Type `$` in the composer to select an available native skill. The selected provider and its installed skills determine the results.

Type `/` to examine available commands. Select the offered command. Do not assume that every provider supports the same command name.

Native commands must start the message. CoCo does not append source-reference snapshots to a message that starts with `/`.

Pending Jira reference chips remain in the draft after that command. Submit an ordinary message when you want to send those references.

For installation and agent scope, use [Agents and native skills](agents.md).

## Preserve an unsent draft

The composer retains unsent text and context when you change conversations or open Help. Return to the same conversation to continue that draft.

The draft is local to this app or browser. It is not a shared draft across computers.

A reload can require attachment verification or a new file upload. Read any attachment warning before submission.

## Save a prompt with Stash

Use **Stash** to set aside a prompt and use the composer for another request. A stash can also move a prompt to another chat.

### Save

1. Finish the prompt text and pending references.
2. Wait for file uploads to complete.
3. Press **Ctrl+S** on Windows or **Command+S** on macOS while the composer has focus.
4. Make sure that the **Stash** count increases.
5. Read any notification about unsaved or dropped attachments.

The saved entry includes prompt text, source references, and supported attachments. Terminal, preview, and review context remain in the original composer.

A saved prompt does not preserve the current provider, model, agent, or project integration selections.

The stash holds 20 prompts. If you exceed this limit, CoCo removes the oldest entry and shows a notification.

### Restore

1. Open the intended destination conversation.
2. Select **Stash** above the composer.
3. Select the prompt to restore.
4. Examine the restored text and references.
5. Examine the destination project's model, agent, and integration selections.
6. Send the prompt only when the combined context is correct.

Restore appends the saved prompt to current draft text. It merges source references and removes the restored entry from the stash.

If the composer is empty and only one prompt is stashed, the stash shortcut restores that prompt directly.

Stashed files belong to their upload environment. Restore them there, or attach the original files in the other environment.

Temporary file uploads for a stash last 24 hours. If a file expired, attach it again.

Stashed images can be reduced in size or omitted because of storage limits. A notification identifies images that were not saved.

If browser storage is unavailable, CoCo can retain the stash only for the current session. Do not rely on it after a reload.

### Delete

1. Open **Stash**.
2. Select **Delete stashed prompt** beside the unwanted entry.

Deletion removes that saved prompt. It does not delete any source record or original file.

## Recall earlier prompt text

With an empty composer, use **Up Arrow** and **Down Arrow** to move through prompt history.

Prompt history recalls the text. It does not restore old Jira snapshots as new pending attachments.

Use **Stash** when you want to retain a prepared prompt with its supported attachments.
