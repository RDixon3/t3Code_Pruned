# Connect and link Jira

Use this guide to connect an Atlassian account, link a CoCo project, and make Jira tools available to chat.

These are three separate operations:

- **Account connection:** gives this desktop access to the sites and tools that your Atlassian account permits.
- **Project link:** identifies the Jira site and project for one CoCo project.
- **Chat tools:** let a supported agent use Jira through the desktop connection.

CoCo uses Atlassian Rovo MCP at `https://mcp.atlassian.com/v1/mcp`. MCP means Model Context Protocol, the connection format that supplies tools to an agent.

The account connection applies to all projects on this desktop. The project link applies across Pursue, Manage, and Build.

## Before you start

These items are necessary:

- The CoCo desktop app on Windows or macOS.
- An Atlassian account with access to the required Jira Cloud site and project.
- Permission from your organization to use Atlassian Rovo MCP.
- Access to your organization's single sign-on (SSO) service, if required.
- A CoCo project for the project-link step.

The development web client cannot establish this desktop connection. An account with access to one site does not necessarily have access to another site.

## Connect with SSO

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Select **Connect with SSO**.
3. Complete the Atlassian sign-in steps in your browser.
4. If Atlassian requests authorization, authorize the required account access.
5. Return to CoCo.
6. Read the connection status.

**Connected · MCP checks passed** means the connection completed its current verification. **Signed in · connection not yet verified** means credentials exist, but current verification has not completed.

To cancel an incomplete sign-in, select **Cancel sign-in** in CoCo. To start authorization again, select **Reconnect with SSO**.

CoCo encrypts saved credentials on this desktop. A new machine requires its own sign-in. A saved sign-in does not prove that current network access works.

## Test an existing connection

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Select **Test connection**.
3. Wait for the connection status to replace **Testing connection…**.
4. If the test fails, use [Diagnose connection failures](#diagnose-connection-failures).

The test starts an MCP session, discovers advertised tools, and tests read-only resource discovery when available. It does not change Jira issues.

A successful test does not prove that every advertised tool works. An individual tool can still fail because of account permissions, site configuration, or an Atlassian service error.

## Link your CoCo project

A project link tells CoCo where to find project work. It does not create a Jira project or change account permissions.

1. Open [Settings → Projects](/settings/projects).
2. Select the intended CoCo project.
3. In **Jira project**, open **Link Jira project** or the saved Jira key.
4. Select the required Jira site.
5. Select the required Jira project.
6. Confirm that the saved Jira key identifies the intended project.

If only one site is accessible, CoCo shows its projects directly. Project names identify the choices; project keys distinguish projects with similar names.

The link saves when you select the project. If the save fails, CoCo keeps the previous link and shows an error.

You can also open **Link Jira project** beneath the project name in Manage. After a link exists, this control shows the project key and site.

### Find a missing project

1. Open the Jira project picker.
2. If the wrong site is open, select **Back to Jira sites**.
3. Select the required site.
4. Select **Refresh** to obtain its current project list.
5. If **Load more** is available, select it for additional projects.

**No accessible projects in this site** means this connection returned no projects for that site. It does not prove that the site contains no projects.

If the project remains absent, confirm account access with your Jira administrator. Then reconnect or test the connection in Settings.

### Change or remove a link

To change the link:

1. Open the Jira project picker for the intended CoCo project.
2. If necessary, select **Back to Jira sites**.
3. Select the required site.
4. Select the replacement project.
5. Confirm the saved selection after the picker closes.

To remove the link:

1. Open the same project's Jira picker.
2. Select **None**.
3. Confirm that the control shows **Link Jira project**.

**None** removes the project reference. It does not disconnect the Atlassian account or delete Jira data.

New agent turns use the thread's own project link. They do not use a different project selected elsewhere in the sidebar. See [Project context](projects.md).

## Jira connected but chat cannot use it

Jira account access and Jira chat tools have separate status messages in Settings. **Jira chat tools ready** means the local agent connection can supply the discovered tools.

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Confirm that **Jira chat tools ready** appears.
3. Return to the intended project.
4. Start a new chat with Codex, Claude, or Cursor.
5. Ask the agent to use Jira tools for the required task.

For example: “Use Jira tools to read the current status of KAN-1.” Replace the example key with an issue from your project.

If an existing chat cannot find Jira tools, start a new chat after the ready message appears. The project link alone does not supply tools or credentials.

If **Connecting Jira chat tools…** persists, select **Test connection**.

If **Jira chat tools unavailable** remains, close other CoCo windows as the message recommends. Then test the connection again.

Keep the local desktop open while the agent uses these tools. CoCo does not supply this connection to Windows Subsystem for Linux (WSL) environments.

Browser control is not required for Jira MCP tools. The agent's Jira operations use your account permissions; the project link is guidance, not an access restriction.

## Diagnose connection failures

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Select **Test connection**.
3. Expand **Connection diagnostics**.
4. Select **Copy diagnostics**.
5. Include the report and the app version when you report the problem.

If the copy fails, select the report text. Copy the selected text manually. The displayed log path identifies the saved report on this desktop.

The report identifies the latest Connect or Test run. It can include the failed stage, HTTP status, request identifiers, and tool-discovery results.

CoCo omits tokens, authorization codes, and raw issue content. Retain the exact error and stage in your report.

- **`initialize`:** the initial connection failed. This can happen before OAuth sign-in, because of network, proxy, or certificate problems.
- **`tools/list`:** the connection could not obtain the tool list.
- **`tools/call`:** an individual tool failed after the connection started. Successful sign-in does not rule out this failure.
- **Signed in, but not verified:** credentials exist, but a current test has not succeeded.

For network and certificate failures, use [Troubleshooting](troubleshooting.md). Do not repeat a Jira write after an uncertain result until you examine the issue in Jira.

## Disconnect

1. Open [Settings → Integrations → Jira](/settings/integrations#jira).
2. Select **Disconnect**.
3. Confirm that the status shows **Not connected**.

Disconnect removes the saved local connection. Project links remain references, but they cannot supply account access by themselves.

To revoke account-side authorization, remove the application's access in Atlassian. To use Jira again in CoCo, reconnect. Then test the connection.

After you link a project, use [Manage](manage.md) to read work and risks.
