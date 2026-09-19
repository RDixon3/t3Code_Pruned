# Providers and model configuration

A **provider** is the agent runtime that CoCo uses, such as Codex, Claude, or Cursor. The provider connects to the model service through its own credentials.

A **provider instance** is a named configuration of that runtime. Two instances can use different accounts, configuration directories, or service endpoints.

CoCo displays Codex, Claude, and Cursor in this version. The installed provider determines which models and options are available.

## Before you start

The environment's machine must have the provider command-line tool, a valid account or API credential, and network access to the provider service.

A CoCo installation does not sign you in to a provider account. A Jira or ServiceNow connection does not authenticate a model provider.

For a WSL project, install and authenticate the provider inside that distribution. A working Windows provider login is not sufficient.

## Install and authenticate a provider

1. Open [Settings → Providers](/settings/providers).
2. Select the device that will run the agent.
3. Select the required provider.
4. Read its installation and authentication status.
5. If the tool is missing, install its command-line version on that device.
6. Run the applicable login command on that device.
7. Complete the provider's sign-in procedure.
8. Return to **Providers**.
9. Turn on the provider if it is disabled.
10. Select **Refresh provider status**.

| Provider | Installation instructions                                           | Normal login command |
| -------- | ------------------------------------------------------------------- | -------------------- |
| Codex    | [Codex CLI installation](https://developers.openai.com/codex/cli)   | `codex login`        |
| Claude   | [Claude Code installation](https://code.claude.com/docs/en/setup)   | `claude auth login`  |
| Cursor   | [Cursor CLI installation](https://cursor.com/docs/cli/installation) | `agent login`        |

Use the installer for the environment's operating system. If the first-run setup offers an installation or login terminal, complete the same steps there.

The expected result is **Authenticated** or **Available**, with models listed for the selected instance. Some providers do not report account details.

Codex and Claude default to enabled. Cursor defaults to disabled until you turn it on.

The current Providers page does not include a general sign-in form for these three providers. Use the provider's login procedure on the environment's machine.

## Run a provider installer

Use an installer only when the required command-line tool is missing. For updates, keep the existing installation method.

1. On the environment's machine, open PowerShell on Windows or Terminal on macOS.
2. Run the installer command for the required provider and operating system.
3. Wait for the installer to finish.
4. Open a new terminal.
5. Run the login command from the preceding table.
6. Complete sign-in in the provider's page or terminal.
7. Return to CoCo.
8. Select **Refresh provider status**.

| Provider | Windows PowerShell                                   | macOS Terminal                                          |
| -------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Codex    | `irm https://chatgpt.com/codex/install.ps1 \| iex`   | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` |
| Claude   | `irm https://claude.ai/install.ps1 \| iex`           | `curl -fsSL https://claude.ai/install.sh \| bash`       |
| Cursor   | `irm 'https://cursor.com/install?win32=true' \| iex` | `curl https://cursor.com/install -fsS \| bash`          |

These commands run each provider's published installer. Alternative installation methods are in the [Codex](https://developers.openai.com/codex/cli), [Claude](https://code.claude.com/docs/en/setup), and [Cursor](https://cursor.com/docs/cli/installation) installation guides.

If your organization manages software installation, use its approved installation method. Do not install a second copy solely because CoCo has an incorrect **Binary path**.

## Resolve installation detection

CoCo normally finds a provider through `PATH`, the operating system's list of executable directories.

If **Not found** appears after installation:

1. Open a new terminal on the environment's machine.
2. Run the provider's version command.
3. If the command succeeds, identify the installed executable's full path.
4. In the provider's **Runtime** section, enter that path in **Binary path**.
5. Select **Refresh provider status**.

Use `codex --version`, `claude --version`, or `cursor-agent --version` for the version command.

Cursor uses `cursor-agent` as CoCo's default executable name. The Cursor login command can use the `agent` alias.

After a new installation changes `PATH`, a desktop app restart can be necessary. An already running app can retain the earlier executable search path.

Do not enter the path to the Codex desktop app, Claude desktop app, or Cursor editor. **Binary path** must identify the command-line agent executable.

## Interpret provider status

| Status                       | Meaning and next action                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Checking provider status** | The server has not returned its status. Wait for the request, then refresh if it fails.                                    |
| **Disabled**                 | CoCo will not use this instance for new sessions. Turn it on if required.                                                  |
| **Not found**                | CoCo cannot find the command-line tool. Make sure **Binary path** identifies the installed executable.                     |
| **Not authenticated**        | The provider has no usable login for this instance. Run its login procedure with the same configuration directory.         |
| **Needs attention**          | The tool exists, but a status request failed or returned incomplete information. Read the detail below the status.         |
| **Unavailable**              | A provider startup test failed. Read the reported error before you change configuration.                                   |
| **Authenticated**            | The provider reports a usable account. Compare the displayed account with the account you intend to use.                   |
| **Available**                | The runtime is available but did not report full account information. This status alone does not indicate a login failure. |

If **Device unavailable** appears, restore that device's connection. If **Limited permissions** appears, the connected session cannot change provider settings.

## Add a separate provider instance

Use another instance for a separate account or configuration. A display name alone does not isolate accounts.

1. Select the applicable device in **Providers**.
2. Select **Add provider**.
3. Select the **Driver**.
4. Select **Next**.
5. Enter an optional **Label**.
6. Enter a unique **Instance ID**.
7. If useful, select an **Accent color**.
8. Select **Next**.
9. Enter the required runtime configuration.
10. Select **Add instance**.
11. Complete authentication for that configuration on the environment's machine.
12. Select **Refresh provider status**.

The Instance ID permits letters, digits, hyphens, and underscores. Threads use this identifier to locate the configuration.

The label and accent color help distinguish instances in the model picker. They do not change authentication or model access.

## Configure Codex runtime fields

| Field                | Purpose                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Binary path**      | Selects the Codex executable. The normal value is `codex`.                                    |
| **CODEX_HOME path**  | Selects the Codex configuration and conversation directory. Empty uses the normal Codex home. |
| **Shadow home path** | Separates account credentials while using conversation state from **CODEX_HOME path**.        |
| **Launch arguments** | Adds command-line arguments when CoCo starts the Codex app-server session.                    |

For independent accounts and conversations, use different **CODEX_HOME path** directories. Authenticate each account with that same directory.

For a separate Codex login on Windows, use a new PowerShell terminal. Replace the example path with the directory entered in **CODEX_HOME path**.

```powershell
$env:CODEX_HOME = "C:\Users\YourName\.codex-work"
codex login
```

On macOS, use the same directory with this command:

```bash
CODEX_HOME="$HOME/.codex-work" codex login
```

Close the login terminal after sign-in. Then refresh the instance's provider status in CoCo.

For account configurations that share Codex conversation state, use one common **CODEX_HOME path** and a separate **Shadow home path** for the second account.

The shadow directory must have its own account login. Do not copy an entire existing Codex home into it.

A shared-home setup requires file-based Codex credentials in the shadow directory. If your organization uses another credential method, use its approved configuration procedure.

An existing thread can only use compatible Codex instances. A separate Codex home does not move a running conversation to another account.

## Configure Claude runtime fields

| Field                      | Purpose                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Binary path**            | Selects the Claude executable. The normal value is `claude`.                                         |
| **CLAUDE_CONFIG_DIR path** | Selects the configuration directory for this instance. Empty uses the normal Claude configuration.   |
| **Auto-compact after**     | Sets a token threshold for conversation summarization. Enter an integer from 100000 through 1000000. |
| **Launch arguments**       | Adds command-line arguments when a session starts.                                                   |

For separate accounts, use a separate **CLAUDE_CONFIG_DIR path** for each instance. Use that same directory when you run `claude auth login`.

For a separate Claude login on Windows, use a new PowerShell terminal. Replace the example path with the directory entered in **CLAUDE_CONFIG_DIR path**.

```powershell
$env:CLAUDE_CONFIG_DIR = "C:\Users\YourName\.claude-work"
claude auth login
```

On macOS, use the same directory with this command:

```bash
CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude auth login
```

Close the login terminal after sign-in. Then refresh the instance's provider status in CoCo.

Do not substitute a changed `HOME` value for **CLAUDE_CONFIG_DIR path**. That can put credentials in a different location from the one the instance uses.

For **Auto-compact after**, `300000` requests summarization at approximately 300,000 tokens. This does not increase the model's context capacity.

Leave **Auto-compact after** empty to use Claude's default. CoCo preserves the conversation display when the provider summarizes its own context.

## Configure Cursor runtime fields

**Binary path** selects the Cursor agent executable. The normal value is `cursor-agent`.

**API endpoint** replaces the normal Cursor service endpoint for this instance. Leave it empty unless your administrator supplies an alternate endpoint.

If model discovery fails, make sure the Cursor command-line agent is installed and enabled. Then refresh provider status after any required sign-in.

## Add environment variables

Environment variables contain per-instance settings, such as an API key or alternate service URL. Use the variable names required by the provider.

1. Open the instance's **Environment → Variables** section.
2. Select **Add variable**.
3. Enter the variable name.
4. Enter its value.
5. For a credential, keep the lock control set to **Sensitive**.
6. Leave the field to save the value.

The environment stores sensitive values separately and does not return them to the app. The replacement field can therefore appear empty after a save.

If the field says **Stored secret, enter a new value to replace**, enter a new value only to replace that secret.

Use the row's remove action to remove an override. This does not revoke a credential at the provider service.

An explicitly empty variable value and a removed variable are different. An empty override can suppress an inherited credential when the provider supports that configuration.

Do not put environment variable assignments in **Launch arguments**. Runtime arguments and environment variables are separate inputs.

Start a new chat to test a changed runtime or account configuration. Do not assume a running provider session has loaded a newly saved value.

## Organize the model picker

Open the instance's **Models** section.

| Action                       | Result                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| Filter models                | Finds a model in a long list.                                      |
| Select the star              | Adds or removes a favorite for this instance.                      |
| Change the visibility switch | Shows or hides the model in the picker.                            |
| Move up or down              | Changes the model order within its group.                          |
| Add custom model             | Adds a model identifier that the provider does not currently list. |

Favorites, visibility, and order are client preferences. A hidden model retains provider access and remains available to threads that already use it.

For a custom model:

1. Select **Add custom model**.
2. Enter the exact model identifier supplied by the provider.
3. Select **Add**.
4. If necessary, open the custom model's edit action.
5. Enter a display name.
6. Configure only options that this provider supports for that model.
7. Select **Save**.

The custom editor can copy options from a built-in model. It supports choice lists and toggles, with an option identifier and display label.

A custom model name does not grant account access to that model. Incorrect model identifiers or unsupported options can cause a turn to fail.

Use the custom model's remove action to remove it from configuration. Built-in models can be hidden instead.

## Select a model and access mode for a chat

Provider settings control availability. The composer controls the model and access mode for the current thread.

1. Open a new chat in the correct project.
2. Open the model picker.
3. Select the provider instance.
4. Select a model.
5. Set any available reasoning or service options.
6. Select an access mode.
7. Enter and send the task.

The provider remains fixed for that conversation. Start a new chat to change between Codex, Claude, and Cursor.

| Access mode           | Behavior                                                                               |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Supervised**        | Requests approval for commands and file changes. Some read-only actions can proceed.   |
| **Auto-accept edits** | Permits file edits automatically. Other actions can still require approval.            |
| **Auto**              | Uses the provider's automatic review for routine actions and asks about other actions. |

The default for new threads is **Auto**. A thread created from another thread inherits its mode. Previously saved Full Access selections now use Auto; Full Access is unavailable for every provider.

Access mode does not supply Jira, ServiceNow, or repository credentials. The agent can still ask a question about your task.

Use [Build and chat](build.md) for message controls, approvals, context items, and review.

## Monitor versions and provider health

An instance can show **Update available** beside its version. Open the update detail to use **Update now** or copy the offered command.

The update action appears only when CoCo recognizes a supported installation method. Use the original installation method if no action is available.

Use [Updates](updates.md) for the complete update procedure and recovery steps.

Under **Advanced**, **Health check interval** controls background provider status refreshes in seconds. Set zero to disable automatic refresh.

You can still select **Refresh provider status** manually. The environment's **Background activity** policy can pause scheduled status requests.

## Add a usage provider

**Usage providers** supports a CLIProxyAPI hub, which reports limits for accounts managed by that hub. This is optional.

Before you add a hub, obtain its URL and management key from its administrator.

1. In **Providers**, select the device that will contact the hub.
2. Under **Usage providers**, select **Add hub**.
3. Enter **Hub URL**.
4. Enter **Management key**.
5. Enter an optional **Label**.
6. Select **Add hub**.

The hub's accounts can then appear in the Limits view. The key remains on the selected server.

A usage provider does not create a chat provider instance. It does not grant more quota or reset an account's limit.

To remove the hub, select **Remove** and confirm **Remove hub**. This deletes its stored management key from that server, not the hub itself.

## Read usage and estimated cost

**Usage** summarizes the supported provider history on selected environments. A **token** is a unit that the model processes as input or output.

Cost and token history currently include Codex and Claude Code. Cursor history does not appear in these totals.

1. Select **Usage** in the sidebar footer.
2. Open the environment selector.
3. Select the environments to include.
4. Select **Cost** or **Tokens**.
5. Select **Past 24h**, **7 days**, **30 days**, or **90 days**.
6. Read the provider totals and chart.
7. Under **Breakdown**, select **Model**, **Hour**, or **Day**.
8. To include recent activity, select **Refresh usage**.

The default view is **Cost** for **30 days**, with all environments selected. The app remembers the metric and period on this client.

**Past 24h** uses hourly results. Other periods use daily results.

**Cost** is an estimated API-equivalent value, not your subscription bill. **Cache savings** is an estimated reduction from cached input pricing.

**Totals** separates **Processed tokens**, **Cached input**, **Uncached input**, and **Output**. Cached input represents input that the provider reused.

The totals depend on available history. They do not measure every interaction with your provider account outside the selected environments.

If totals seem incomplete, open the environment selector. Wait for **Scanning…** or **Refreshing…** to finish before you compare results.

An **Unavailable** environment can leave partial totals. An incompatible older server shows **Update required** and is excluded from totals.

When environments share one history directory, CoCo counts that source once. The environment selector reports this condition.

If recent activity remains absent, restore the affected environment's connection. Then select **Refresh usage** again.

## Set custom model prices

Use a custom price when automatic pricing is unavailable or different rates are necessary. Prices use US dollars per million tokens.

You must have permission to change settings on each destination environment.

1. In **Usage**, open the environment selector.
2. Select **Model prices**.
3. In **Apply to**, select the destination environments.
4. Select **Add model price**.
5. Enter the exact **Model ID**.
6. Enter the **Input** rate.
7. Enter the **Output** rate.
8. If applicable, enter the **Cache read** rate.
9. If applicable, enter the **Cache write** rate.
10. Select **Save changes**.
11. Make sure each destination reports **Saved**.

An empty cache rate uses the input rate. Enter `0` for tokens that have no cost.

Saved prices affect past and future usage on those environments. Other clients connected to those environments use the same prices.

**Mixed** means that selected environments have different rates. An unchanged mixed cell preserves each environment's rate.

To read a single environment's prices, select only that environment before you edit. The destination selector is locked while edits are pending.

To restore automatic pricing, select the model's **Reset to automatic** action. Then select **Save changes**.

Before you save, **Undo reset** cancels that reset. **Discard changes** removes all unsaved edits in the dialog.

If a destination reports **Not saved**, restore its connection or settings access. Select **Retry failed saves** to retry only failed destinations.

If you close the dialog, CoCo does not queue failed changes for later delivery. Successful saves remain applied to their destinations.

## Read account limits

**Limits** shows subscription quota reported by provider accounts and configured usage hubs. A **window** is a quota period with its own reset time.

1. Open **Usage**.
2. Select the applicable environments.
3. Select **Limits**.
4. Read the remaining percentage for the required provider and window.
5. Select an account segment or account row.
6. Read its **Left**, **Resets**, and available account details.
7. To request current data, select **Refresh limits**.

The period selector is disabled in **Limits**. Provider quota windows determine the periods in this view.

For multiple accounts, CoCo groups available quota by provider. Each account contributes an equal share to the combined percentage, regardless of its subscription plan.

This percentage is a summary, not a number of remaining requests. Read the specific account's details before you select it for work.

The same identifiable account appears once across environments and hubs. A missing segment means that the account does not report that window.

The account details can show **Plan**, **Signed in**, **Via**, and **Restores**. **Restores** estimates the share returned to the group at reset.

Select the obscured email address to reveal it. Select it again to hide it.

The pace indicator compares quota use with elapsed time. It does not predict the cost or success of your next task.

If no limits appear, read the displayed notices. API-key accounts and some proxy connections do not report subscription quota.

Missing quota information does not mean unlimited access. Use the provider's account page when its runtime cannot report limits.

In a supported chat, select `/usage-limits` from the command menu to show the current model's limits above the composer.

This command displays available limit data. It does not run an agent turn or refresh data; use **Refresh limits** for a new request.

Dismiss the result or send the next message to close it.

## Use an available account reset

Some Codex accounts report reset credits. A reset consumes one credit and clears eligible account quota windows.

1. In **Usage → Limits**, select the intended account.
2. Read its account identity and available credits.
3. Select **Use reset**.
4. Read the confirmation.
5. To redeem the credit, select **Use credit**.
6. Read the reported result.

Select **Cancel** to keep the credit. Redemption cannot be undone.

**Reset applied** confirms that a reset occurred. A result with no available credit or nothing to reset does not indicate a completed reset.

This action does not purchase credits or change the chat's provider account. If the action fails, read its error before another attempt.

## Disable or remove an instance

Turn off an instance to prevent its use for new sessions. This does not uninstall its command-line tool or delete its provider account.

If you disable the instance for **Text generation model**, CoCo resets that selection. Read **General → Text generation model** before the next briefing or title generation.

Use the delete action to remove an additional instance. Default instances use a reset action instead of deletion.

Before removal, identify threads and defaults that use that instance. Their saved provider selection can become unavailable.

## Resolve common provider problems

| Symptom                             | Action                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The wrong account appears           | Compare the instance's configuration directory and stored login on the selected device.                                    |
| Two instances show the same account | Give each account the correct separate login directory or supported shadow home. A label does not isolate credentials.     |
| A model is missing                  | Refresh provider status. Make sure the model is visible and available to your account.                                     |
| A custom model fails                | Confirm its identifier and options with the provider. A display entry does not establish compatibility.                    |
| Chat works but the briefing fails   | Read **General → Text generation model**. It is separate from the chat model.                                              |
| A usage limit stops work            | Read the provider's reset time or account action. Use the provider account page if CoCo has no complete limit information. |
| A WSL provider fails in CoCo        | Compare the WSL instance's executable path, configuration directory, environment variables, and login.                     |
