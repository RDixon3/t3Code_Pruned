# Manage project work and risks

Manage shows Jira project work, a separate risk list, an executive briefing, and your project's chat. It uses the same project selection as Build.

The board presents Jira status categories. It does not reproduce a specific Jira board or sprint.

## Before you start

The desktop app, a [connected Jira account](jira.md), and a linked Jira project are necessary. Your account must have permission for each issue operation.

1. Select the intended CoCo project in the sidebar.
2. Select **Manage**.
3. Confirm the Jira key and site beneath the project name.
4. If no link exists, select **Link Jira project**.

Without a CoCo project, Manage asks you to select one. Without a Jira link, Manage asks you to link one.

The development web client can show the layout. It cannot use the desktop connection to load Jira issues or change their status.

## Read the project board

**Project work** contains three columns:

- **To Do:** Jira issues in the new status category.
- **In Progress:** Jira issues in the active status category.
- **Done:** Jira issues in the complete status category.

Jira status names can differ from these category names. For example, an issue with status “In Review” can appear in **In Progress**.

CoCo does not require a sprint, label, or specific board. The list can include backlog issues that your team has not committed to deliver.

### Read a card

A work card shows its issue type, key, assignee, summary, and available priority. A populated story-points field appears to the right of the assignee.

**Unassigned** means Jira did not supply an assignee. The card does not display the full description or comments.

Select the summary to open the issue in Jira. You can also open the card's three-dot menu and select **Open in Jira**.

### Load and refresh issues

The first page contains up to 100 issues, with the most recently updated issues first. Work and risks share this result list.

1. Read the issue count near **Refresh**.
2. If **More available** appears, select **Load more** below the board.
3. Repeat **Load more** until you have the required coverage.
4. To obtain changes made elsewhere, select **Refresh**.

**Refresh** replaces the board with a new first page. After a refresh, use **Load more** again for additional pages.

Counts describe loaded issues, not necessarily all issues in the project. An empty column in a partial result does not prove that no issues have that status category.

If a refresh fails, previously loaded issues remain visible with an error. Treat those cards as earlier information until a refresh succeeds.

## Change status

A status change updates the Jira issue. Jira permissions and workflow rules determine which changes are available.

### Drag a work card

1. Drag the card from an empty part of its surface into the required column.
2. If **Choose a status** appears, select the intended status.
3. Wait for the Jira update and board refresh to complete.
4. Confirm that the card has the intended status.

CoCo obtains the transitions that Jira permits for that issue. If one transition reaches the target category, CoCo uses it. If several transitions apply, CoCo asks you to choose.

Select **Cancel** in the status dialog to send no change. A drop in the current column does not send a change.

A drag changes status only. It does not change issue rank, sprint membership, or the order within a column.

### Use the status menu

1. Open the card's three-dot menu.
2. Open **Change status**.
3. Select one of the available transitions.
4. Wait for the board to refresh.

Use this method when you do not want to drag a card. It also exposes available transitions outside the three-column drop choices.

### Recover from a failed change

- If statuses cannot load, reopen the menu.
- If no transitions are available, examine the issue's permissions and workflow in Jira.
- If a transition requires additional fields, complete it in Jira.
- If Jira accepted the change but the board failed to refresh, select **Refresh** before another change.
- If the result is uncertain, open the issue in Jira before you repeat the operation.

A timeout does not prove that Jira rejected a write. The change can reach Jira before CoCo receives its result.

## Track risks

Issues with the issue type **Risk** appear above the board. A label or the word “risk” in a summary does not place an issue here.

The risk list shows each risk's key, summary, available priority, status, and assignee. It includes closed risks as well as open risks.

To change a risk:

1. Select its status.
2. Select an available transition.
3. Wait for the list to refresh.

Select the risk summary to open its full details in Jira. Use **Add to chat** to attach its current loaded details to the chat draft.

CoCo does not create the **Risk** issue type automatically. Ask your Jira administrator to make this type available if your project lacks it.

Risks share the board's page limit. **No Risk issues in the loaded results** describes partial coverage. Load additional pages before you conclude that the project has no Risk issues.

## Story points missing

CoCo recognizes numeric fields named **Story points** and **Story point estimate**. A blank field does not produce a badge.

The estimate must be zero or greater. Text values and negative numbers do not produce a badge.

1. Open the issue in Jira.
2. Make sure the appropriate estimation field is available for that issue type.
3. Enter a numeric estimate in the recognized field.
4. Save the issue in Jira.
5. Return to Manage.
6. Select **Refresh**.

Jira configuration varies by project type. If the field is unavailable, ask your Jira administrator to enable it for the project or issue type.

CoCo discovers recognized fields again when it loads a fresh first page. It does not recognize other field names automatically.

If recognized fields contain conflicting values, CoCo omits the estimate. Correct the conflicting values in Jira. Then refresh CoCo.

## Work with chat

Manage uses the project's normal chat. You can resize the divider between project work and chat. Narrow windows have **Project work** and **Chat** tabs.

If no chat is open, open an existing project chat or start a new one. The attachment actions require a chat draft.

### Attach an issue or risk

Work cards have **Add to chat draft** in the three-dot menu. Risks have **Add to chat** beside the risk details.

Then complete the request:

1. Select the issue or risk's chat action.
2. Select the new reference chip above the chat input.
3. Read the snapshot in the popup.
4. Enter the task you want the agent to perform.
5. Send the message when its text and references are correct.

A chip is a compact attachment control. The snapshot contains the issue key, summary, type, status, and assignee from the loaded card.

It does not contain the issue's description, comments, priority, or story points. The attachment action does not make another Jira request.

To supply current details, refresh the board before you attach the issue. To examine the source, select **Open in Jira** in the chip popup.

### Remove or reuse references

Select the chip's × to remove a pending reference. This removes the reference from the draft; it does not change Jira.

If you attach the same issue again, CoCo replaces that draft snapshot. It does not add a second chip for the same issue and site.

References remain with their draft when you change views or restart the app. Saved prompts also retain them. A draft supports up to 20 references, subject to text-size limits.

After you send a message, its references remain visible as read-only chips. They preserve the snapshot sent with that message, even if Jira later changes.

Commands that start with `/` do not consume these references. CoCo keeps the pending references for a later normal message.

The agent receives the snapshot as context, not permission to change Jira. Ask it to obtain current details when the task requires current evidence.

Jira tool access requires **Jira chat tools ready** in [Jira Settings](jira.md#jira-connected-but-chat-cannot-use-it). An attachment alone does not establish a tool connection.

## Read the project briefing

**Suggested focus** shows **Overall status**, **Delivery**, and **Risks** above the board. Its refresh and issue coverage are separate from the board.

Use [Read the executive briefing](briefing.md) to select its model, interpret its timestamps, and control manual refreshes.
