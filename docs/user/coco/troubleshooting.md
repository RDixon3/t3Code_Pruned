# Find and fix a problem

Start with the action that failed. A connected account, linked project, usable provider, and available chat tool are separate conditions.

Do not delete account data or reinstall every component as the first response. The error stage usually identifies a smaller problem.

## Identify the affected component

1. Record the exact action that failed.
2. Copy the complete error text.
3. Record the time and your time zone.
4. Identify the selected project and environment.
5. Identify the provider or integration involved.
6. Select the applicable procedure below.

| Problem                                        | Start here                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| Jira works in Manage but not in chat           | [Jira chat tools](#jira-is-connected-but-chat-cannot-use-it)              |
| Jira reports a network, OAuth, or tool failure | [Jira connection errors](#jira-reports-fetch-failed-or-request-timed-out) |
| The wrong Jira project or SDK target appears   | [Project context](#the-chat-uses-the-wrong-project-context)               |
| Story points are absent                        | [Story points](#story-points-are-missing)                                 |
| Suggested focus fails or appears stale         | [Briefing problems](#the-briefing-fails-or-looks-stale)                   |
| SDK installation or a profile is unavailable   | [SDK and profile problems](#the-sdk-or-a-saved-profile-is-unavailable)    |
| A provider cannot send a request               | [Provider and chat problems](#the-provider-cannot-start-or-send)          |
| An attachment blocks Send                      | [Draft and attachment problems](#a-draft-or-attachment-cannot-be-sent)    |
| CoCo does not open                             | [Launch problems](#the-app-does-not-start)                                |
| Navigation is slow or text is hard to read     | [Interface problems](#the-interface-is-slow-or-hard-to-read)              |

## Jira is connected but chat cannot use it

The project link supplies a Jira reference. The desktop connection supplies the account. The chat-tool connection exposes Jira actions to the provider.

1. Open [Integrations](/settings/integrations#jira).
2. Find **Atlassian Rovo MCP**.
3. Select **Test connection**.
4. Wait for a successful result.
5. Make sure that the chat-tool status says **Jira chat tools ready**.
6. Make sure that the chat uses the local desktop environment.
7. Start a new chat with Codex, Claude Code, or Cursor.
8. Ask the agent to read one issue from the linked project through Jira MCP.

Use a read-only request for this test. A request to read an issue does not authorize an issue change.

If the status remains **Connecting Jira chat tools…**, restart the desktop app after active work stops.
Then repeat the connection test. An active development app can retain previous server behavior until its launcher restarts.

WSL environments do not receive this desktop's Jira connection.
If a tool is absent, keep the request within the available capabilities. CoCo's Jira instructions do not permit a browser-automation fallback.

If the agent still reports missing tools, record its provider and the exact missing tool name.
Refer to [Connect Jira](jira.md) for setup and diagnostics.

## Jira reports fetch failed or Request timed out

1. Open **Settings → Integrations → Jira**.
2. Expand **Connection diagnostics**.
3. Select **Copy diagnostics**.
4. Find the first **FAILED** stage.
5. Use the stage table below.

| Stage or error                               | Meaning                                                                            | Next action                                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `initialize` with `TypeError: fetch failed`  | The initial network request failed. The message alone does not identify the cause. | Read the nested cause and error code. Examine network, proxy, DNS, and certificate access.                       |
| `SELF_SIGNED_CERT_IN_CHAIN`                  | The process cannot validate the presented certificate chain.                       | Ask IT to examine corporate certificate trust for the affected process.                                          |
| OAuth or token exchange                      | Authorization did not finish successfully.                                         | Read the sign-in error. Make sure that the intended Atlassian account and site are available.                    |
| `tools/list`                                 | The connection could not obtain the tool list.                                     | Test the connection again. Give support the advertised-tool diagnostics.                                         |
| `tools/call getAccessibleAtlassianResources` | A tool invocation failed after connection setup.                                   | Read the returned tool error. Ask the Atlassian administrator to examine account, site, and organization access. |
| Another `tools/call` failure                 | The named operation failed.                                                        | Record the tool name and service error. Do not assume that successful sign-in proves permission for every tool.  |
| `MCP error -32001: Request timed out`        | The operation did not finish before its time limit.                                | Test the connection after network access returns. Examine the issue before you repeat a write.                   |

Desktop Jira uses system networking. A corporate proxy or certificate rule can affect it differently from npm or a provider CLI.
Do not disable certificate verification.

For a failed read, retry **Test connection** before you refresh Manage again.
For a failed write, open the issue in Jira to determine whether the change occurred. A timeout does not prove that a write failed.

A board refresh failure can leave previously loaded cards visible. Those cards do not prove that the refresh succeeded.
The diagnostic log contains the latest Connect/Test report, not a complete history of every issue request.

## The chat uses the wrong project context

1. Identify the project that owns the open chat.
2. Open that project's settings.
3. Examine its Jira site and project link.
4. Examine the SDK selection in that project's composer.
5. If a target is wrong, select the correct target or **None**.
6. Wait for the setting to save without an error.
7. Send the next ordinary request in that chat.

The next request uses current project settings. A previously dispatched request does not change retroactively.
A sidebar selection for another project does not change the owner of an existing chat.

An attached issue chip contains a snapshot. A new project link does not rewrite a previously attached or submitted snapshot.
Remove an incorrect pending chip before you send the request.

Refer to [Projects and context](projects.md) for selection scope and [Context attachments](chat-context.md) for snapshots.

## Story points are missing

1. Open the issue in Jira.
2. Make sure that estimation is enabled for that project, where applicable.
3. Make sure that the story-point field applies to that issue type.
4. Enter a story-point value.
5. Save the issue in Jira.
6. Return to Manage.
7. Select **Refresh**.

An enabled field can still be empty. CoCo does not assign an estimate automatically.
Jira field names and availability depend on the project configuration.
If the value remains absent, record the issue key, issue type, and field name for support.

Refer to [Project work and risks](manage.md) for the board's estimate display.

## The briefing fails or looks stale

The **Text generation model** is separate from the chat model. Successful chat responses do not prove that the briefing model is usable.

1. Open [General](/settings/general#text-generation).
2. Examine **Text generation model**.
3. Make sure that its provider and model are available on the applicable environment.
4. Return to Manage.
5. Select **Refresh briefing**.
6. Read the result and the displayed times.

| Result                                                       | Explanation or action                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| A model or provider error                                    | Use [Providers](providers.md) to restore that provider's access.                               |
| A Jira data error                                            | Use the Jira diagnostic procedure above.                                                       |
| **Jira checked** changes but **Briefing generated** does not | Unchanged input data can retain the previous generated briefing.                               |
| A board change does not immediately change the briefing      | Board Refresh and briefing Refresh are separate actions.                                       |
| No daily update occurs while CoCo is closed                  | The elapsed-time refresh runs only while the app is open. It is not an external scheduled job. |
| A colleague sees a different briefing                        | Briefing content and refresh state belong to that client.                                      |
| The result omits information from comments or attachments    | The briefing uses its supported issue fields, not every item in Jira.                          |

Read [Executive briefing](briefing.md) for source coverage, the 24-hour rule, and retry behavior.

## The SDK or a saved profile is unavailable

1. Open **Settings → Integrations → ServiceNow**.
2. Select **Check again**.
3. Read the installation status and **Global packages** path.
4. If npm cannot start, make sure that Node.js and npm are available to the desktop process.
5. After a PATH or Node installation change, restart CoCo.
6. If the SDK is absent, select **Install SDK**.
7. Open the composer's SDK picker.
8. Select **Refresh**.

| Result                                              | Next action                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| SDK is installed only in a project                  | Install it globally. The desktop check does not accept a project-only package.                                            |
| Another terminal shows a different SDK version      | Compare its Node/npm environment with **Global packages** in CoCo.                                                        |
| Saved profile is missing or its instance changed    | Select the intended current profile or **None**. CoCo does not silently choose another account.                           |
| Basic authentication fails                          | Make sure that the instance, username, and password are correct. Use the authentication method permitted by the instance. |
| OAuth waits for a code                              | Complete the browser authorization. Paste its returned code into the in-app form when requested.                          |
| The profile list fails to load                      | Keep the saved selection. Resolve the SDK error, then select **Refresh**.                                                 |
| Profile deletion succeeds but selection clear fails | Select **None** again after the settings connection returns.                                                              |
| Controls are unavailable in the web client          | Use the local desktop app for SDK installation and profile management.                                                    |

Refer to [ServiceNow SDK and profiles](servicenow.md) for the complete sign-in and deletion procedures.
The separate pursuit-data instance connection does not select an SDK profile.

## The provider cannot start or send

1. Open [Providers](/settings/providers).
2. Select the chat's environment, if the selector is present.
3. Examine the affected provider's executable and status.
4. Complete any required provider installation or sign-in.
5. Make sure that the selected model belongs to the available provider instance.
6. Start a new chat if the existing session predates the provider change.

For a usage-limit error, examine the provider's reported limits. A ServiceNow SDK update does not change provider usage limits.
For an access request, respond to the approval in the chat. A pending approval does not mean that the model has stalled.

If a file is absent, make sure that the chat uses the environment and folder that contain it.
If a model change is unavailable, read the control's reason. Do not assume that every provider supports the same options.

If a task still cannot continue, preserve the error and use a new chat for a read-only test.
Refer to [Build and chat](build.md) for Stop, resume, approvals, and plan actions.

## A draft or attachment cannot be sent

1. Read the message near **Send** or the affected attachment.
2. Make sure that a project and usable provider are selected.
3. Wait for attachment uploads to finish.
4. If a file requires reattachment, attach that file again.
5. Remove an attachment only if it is not necessary for the request.
6. After the reported problem is resolved, send the request again.

A saved prompt can outlive a temporary uploaded file. If restoration reports an expired upload, supply the original file again.
CoCo can reject additional files or references when the draft exceeds an attachment limit.

If **Could not add context** appears, remove a pending reference before you add another.
If you attach the same source record again, CoCo updates its pending snapshot without a duplicate.

Native slash commands retain pending record references for a later ordinary request.
They do not send those references with an authentication or compaction command.

Use [Give chat useful context](chat-context.md) for supported attachment types, limits, and Stash behavior.

## The app does not start

First identify whether you use a packaged release or a development checkout.

| Situation                                       | Procedure                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| macOS reports an application-trust error        | Read the team's release instructions. The current pilot DMG is ad-hoc signed and is not notarized.                   |
| macOS reports a damaged app                     | Make sure that you downloaded the intended release completely. Ask support to examine its checksum and installation. |
| Windows blocks an unrecognized app or publisher | The Windows installer is unsigned. Use your organization's approved installation process.                            |
| Company policy blocks installation              | Ask IT for the approved installation process. Do not disable operating-system protections globally.                  |
| The app opens from the DMG                      | Put the app in **Applications**. Start that installed copy.                                                          |
| A development command fails                     | Use [Development setup](development.md). Record the first terminal error.                                            |
| A fresh checkout has no chats                   | Make sure that it uses the intended development data directory. Separate data can be empty by design.                |
| The interface opens but no environment connects | Use [Connections](connections.md) to identify the unavailable server.                                                |

Do not delete the data directory as an installation-repair step. That directory can contain the only copy of saved chats and settings.

## The interface is slow or hard to read

1. Open [Appearance](/settings/appearance).
2. Examine the color scheme, theme, contrast, and font settings.
3. Use the CoCo theme for the intended light or dark scheme.
4. To remove panel motion, set the **Panel animations** slider to **0 ms**.
5. Close panels that continuously display unnecessary output.
6. If slowness continues, open **Settings → General → About → View diagnostics**.

Compare live process CPU and memory with the time of the slow action. A busy provider or terminal can be separate from a display problem.
Record the affected menu or panel and whether the problem occurs in a development or installed build.

Do not change unrelated provider accounts to repair theme contrast.
Refer to [Appearance and readability](appearance.md) for the exact display controls.

## Collect useful evidence

Include these items in a support report:

- CoCo version and release or source-branch identity.
- Operating system and processor type.
- Desktop or web client.
- Project and selected environment.
- Provider, model, or integration involved.
- Exact action, expected result, and actual result.
- Exact error text and time zone.
- Whether the failure occurs again after one controlled retry.

To examine general diagnostics:

1. Open **Settings → General → About**.
2. Select **View diagnostics**.
3. Read **Latest Failures** and **Most Common Failures**.
4. Use **Slowest Spans** for a slow request.
5. Expand the applicable message in **Span Logs**.
6. If a trace is relevant, use **Copy trace ID**.
7. If support requests logs, use **Open logs folder** in **Trace Diagnostics**.

A span is a recorded operation with timing and result information. A trace identifier helps support locate related operations.
The diagnostics page reports the selected primary environment; it is not a report for every machine in your account.

For Jira, use **Connection diagnostics → Copy diagnostics** in Integrations as well.
That report omits tokens and raw issue content. General logs can still contain project paths, chat text, and tool output.

Review the report before you share it. Remove passwords, tokens, personal information, and unrelated project content.
Do not send credential files or the complete data directory as a routine support attachment.
