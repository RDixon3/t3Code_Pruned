# Read the executive briefing

**Suggested focus** gives a project manager a short executive briefing in Manage. It describes project status and risk from the available Jira issue fields.

The briefing has three sections:

- **Overall status:** the main supported conclusion about delivery and project exposure.
- **Delivery:** work that has not started, work in progress, and completed work.
- **Risks:** recorded Risk issues, their status, and impacts stated in their summaries.

The briefing is generated text, not an independent assessment of project health. Use the linked issues to confirm important conclusions.

## Before you start

These items are necessary:

- The local CoCo desktop app.
- A verified [Jira connection and project link](jira.md).
- An authenticated Codex, Claude, or Cursor provider.
- A configured **Text generation model** for the environment.

The briefing model is separate from the model selected in the chat. A successful chat does not prove that the selected text-generation provider is ready.

## Generate a briefing

1. Open [Settings → General → Text generation](/settings/general#text-generation).
2. In **Text generation model**, open the model picker.
3. Select an available model from your authenticated provider.
4. Return to the intended project's **Manage** page.
5. In **Suggested focus**, select **Refresh briefing**.
6. Wait for **Refreshing…** to end.
7. Read **Overall status**, **Delivery**, and **Risks**.

CoCo obtains Jira issues before it decides whether another model response is necessary. If the supported input fields changed, the selected model generates a new briefing.

If those fields did not change, CoCo keeps the existing briefing. It updates the time of the successful Jira data retrieval.

The model receives the issue snapshot for this project. This operation does not create a chat turn or make Jira changes.

The same model setting supplies other generated text, such as thread titles. A model change can also affect those tasks.

## Interpret the result

### Understand the evidence

The input contains these issue fields:

- Issue key and summary.
- Issue type.
- Status name and status category.
- Assignee, if available.
- Priority, if available.
- Recognized story points, if populated.

The input excludes descriptions, comments, due dates, project goals, and historical reports. A change to an excluded field does not supply new briefing evidence.

For example, a new issue description alone does not trigger a different briefing. A changed summary or status can trigger one after the next refresh.

The model can summarize outcomes only when the issue summaries describe them. Generic titles such as “Task 1” do not establish a business outcome.

### Understand coverage

CoCo obtains up to 500 issues for the briefing, separately from the board's current pages. The briefing can therefore include issues absent from the visible board.

**Based on a partial issue list** means more issues exist outside the briefing input. Conclusions and counts then apply only to the retrieved subset.

A low issue count in the board does not mean that the briefing used the same count. Read the count beside **Jira checked** for briefing coverage.

Work that has not started can be backlog rather than committed scope. **Done** counts do not establish the percentage of the project that is complete.

Issue counts and story points do not establish delivery speed or schedule performance. A Risk issue does not automatically mean an emergency.

### Understand the times and states

- **Jira checked:** the latest successful retrieval of briefing input.
- **Briefing generated:** the time when the model produced the displayed text.
- **Updates available:** newer retrieved input differs from the input used for the displayed briefing.
- **Based on a partial issue list:** the briefing did not include every issue in the project.
- **Refreshing…:** CoCo retrieves Jira data or waits for a model response.

The two timestamps can differ. A recent **Jira checked** time with an older **Briefing generated** time is normal when the supported input did not change.

An error can appear beside a previous briefing. That previous text remains useful as historical information, but it does not describe unverified changes.

## Automatic refresh after 24 hours

CoCo automatically attempts a refresh when the previous refresh is more than 24 hours old. This applies to linked projects in the local primary environment.

The desktop must remain open and connected. CoCo processes projects one at a time. There is no fixed daily time to configure.

CoCo attempts an initial refresh for a project without a saved briefing. When you reopen CoCo, overdue projects become eligible again.

A tab change or project change does not require a new briefing. An overdue project can refresh while you work elsewhere in the app.

CoCo does not run this refresh while the app is closed. It does not wake a closed app or perform this task on another machine.

A failed attempt also starts a 24-hour wait before the next automatic attempt. Use **Refresh briefing** for a manual retry after you resolve the error.

Briefings and refresh times are local to this device. They are not shared with teammates or copied automatically to another machine.

## Refresh after a Jira change

1. Complete the issue change in Jira.
2. Return to the project's **Manage** page.
3. Select **Refresh briefing**.
4. Read the new **Jira checked** time.
5. If the supported fields changed, read the regenerated briefing.

The board's **Refresh** control and **Refresh briefing** do different work. A board refresh does not immediately regenerate the briefing.

A manual refresh still reuses the existing briefing if its supported input is unchanged. It does not force another model response merely to change the text.

## Discuss or recover

### Discuss a section in chat

1. Select **Discuss in chat** beneath the relevant briefing section.
2. Read the inserted text in the project's chat draft.
3. Add the specific question or task.
4. Send the message when the draft is correct.

This action adds the section, its issue references, and its generation time as draft text. It does not send the message automatically.

Briefing discussion uses text insertion. Issue and risk actions use the reference chips described in [Manage](manage.md#work-with-chat).

If **Updates available** appears, the discussion control is unavailable. Refresh the briefing before you use that control.

### Recover from a Jira error

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Select **Test connection**.
3. If the test fails, resolve the reported connection problem.
4. If the linked site is inaccessible, correct the project's Jira link.
5. Return to Manage.
6. Select **Refresh briefing**.

A failed retrieval does not replace the previous briefing. If the previous result remains visible, use its timestamps to identify its age.

### Recover from a model error

1. Open [Settings → General → Text generation](/settings/general#text-generation).
2. Confirm the selected **Text generation model**.
3. Open the selected provider in [Settings → Providers](/settings/providers).
4. Make sure that the provider is authenticated and its model is available.
5. Return to Manage.
6. Select **Refresh briefing**.

If the generated response has an invalid format or unsupported issue references, CoCo rejects it. Retry once with an available model.

If the error persists, retain the exact message and app version. Use [Troubleshooting](troubleshooting.md) for the next diagnostic step.
