# Use the ServiceNow SDK

CoCo has two separate ServiceNow connections:

- **ServiceNow SDK:** the software development kit used by agents for development work.
- **Instance connection:** CoCo's own sign-in for future pursuit data.

An SDK profile stores authentication for an instance. CoCo saves a selected profile alias and instance address for each project.

The pursuit connection does not replace the profile selected in chat. An SDK profile does not configure pursuit tables.

## Before you start

SDK controls apply to the local desktop machine and its current npm environment. Windows Subsystem for Linux (WSL) profiles are not available through this picker.

These items are necessary for SDK tasks:

- The CoCo desktop app.
- Node.js and npm available to the desktop process.
- A global installation of `@servicenow/sdk`, or permission to install it.
- A ServiceNow instance and an account with the required access.

A project-local SDK installation does not satisfy the global-installation test. CoCo uses the global package directory shown in Settings.

## Install or update the SDK

### Install the global SDK

1. Open [Settings → Integrations → ServiceNow](/settings/integrations#servicenow-sdk).
2. Find the **ServiceNow SDK** section below **Instance connection**.
3. Select **Check again** to read the current installation status.
4. If **Not installed globally** appears, select **Install SDK**.
5. Wait for the installation to complete.
6. Confirm that **Installed globally · v…** shows a version.

**Install SDK** runs `npm install --global @servicenow/sdk` in your current npm environment. The operation applies to the machine, not only to the selected project.

**Global packages** identifies the package directory that CoCo examined. If an installation fails, the error appears in this section.

### Update the SDK

1. Finish or cancel any SDK profile sign-in.
2. Open [Settings → Integrations → ServiceNow](/settings/integrations#servicenow-sdk).
3. In **ServiceNow SDK**, select **Check for updates**.
4. If an update exists, select **Update to v…**.
5. Wait for installation and version verification to complete.
6. Confirm the installed version.

CoCo compares the installed and requested versions before it reports success. Updates preserve SDK profiles and CoCo project selections.

**Check again** reads the installed version. **Check for updates** also obtains the latest published version. These controls do not perform the same operation.

CoCo also searches for an SDK update once per desktop window launch. An available update produces a notification with **Update** and **Settings** actions.

If you dismiss a version's notification, you can still update from Settings. CoCo does not install an update without an update action.

### Resolve installation problems

- If npm or Node.js is unavailable, make it available to the desktop process. Then restart CoCo.
- If the package directory changed, select **Check again** before an update.
- If installation fails, retain the displayed npm error before you retry.
- If npm reports an unsupported Node.js version, install a supported version before another update attempt.
- If an update remains available, compare the installed version with the requested version.
- If sign-in is active, finish or cancel it before you update.

Do not assume that a version visible in another terminal is the version CoCo uses. Different npm environments can have different global package directories.

## Add an auth profile

The **SDK** picker is to the right of the access picker in a local desktop chat. It remains visible without a selected project.

You can add or delete machine profiles without a project. Select a project before you choose which profile that project uses.

### Prepare a profile

1. Open the **SDK** picker.
2. Select **Add profile…**.
3. Enter a unique **Profile name**.
4. Enter the **Instance URL**.
5. Select the appropriate **Authentication** method.

The profile name is the SDK alias. Use 1–64 letters, numbers, dots, underscores, or hyphens. The first character must be a letter or number.

Use an HTTPS instance address, such as `https://example.service-now.com`. Do not include credentials, a page path, query parameters, or a fragment.

An existing alias cannot be reused in this dialog. Select a different alias, or delete the old profile if it is no longer required.

### Use OAuth browser sign-in

OAuth delegates sign-in to ServiceNow and its configured identity service. This path can use your organization's SSO.

1. Select **OAuth (browser sign-in)** under **Authentication**.
2. Select **Sign in**.
3. Complete ServiceNow sign-in in the browser.
4. Copy the code that ServiceNow displays.
5. Return to CoCo.
6. Paste the code into **Sign-in code**.
7. Select **Complete sign-in**.
8. Confirm that the new alias appears in the SDK picker.

Use the single-line code, not the browser address. CoCo supplies the code to the installed SDK and confirms that the profile exists afterward.

To stop the attempt, select **Cancel** in CoCo. If the attempt expires or the code fails, start sign-in again.

### Use Basic authentication

Basic authentication uses a username and password. This path does not open a browser.

1. Select **Basic (username and password)** under **Authentication**.
2. Enter the ServiceNow **Username**.
3. Enter the **Password**.
4. Select **Sign in**.
5. Confirm that the new alias appears in the SDK picker.

CoCo passes the credentials to the SDK for sign-in. Credentials remain under the SDK's control; CoCo project settings contain only the alias and instance address.

If sign-in fails, confirm the account credentials and instance access. Then re-enter the password for another attempt.

### Understand the new default

The SDK makes a newly created profile its machine-wide default. CoCo does not automatically select that profile for every project.

After creation, **Use … for this project** can appear in the picker. Select it if the current project must use the new profile.

## Select or delete a profile

### Select a project profile

1. Select the intended CoCo project.
2. Open the **SDK** picker.
3. Read the instance address beneath the intended alias.
4. Select that profile.
5. Confirm that the picker shows **SDK: …** with the intended alias.

The selection saves for that project in its environment. Worktrees inherit their project's selection.

The picker obtains profiles before you open it. Use **Refresh** to obtain changes made outside CoCo.

If the save fails, CoCo shows an error and retains the saved selection. Restore the environment connection before you retry.

### Clear a selection

1. Open the **SDK** picker for the intended project.
2. Select **None**.
3. Confirm that **SDK: None** appears.

**None** clears the CoCo project selection. It does not delete a profile or change the SDK's machine-wide default.

New agent turns receive the project's current selection. This includes an explicit cleared selection. Already-dispatched turns retain the context they received.

The profile is guidance for SDK operations. It does not restrict account access or authorize a deployment. See [Project context](projects.md).

### Delete a machine profile

1. Open the **SDK** picker.
2. Select the red trash icon beside the unwanted profile.
3. Read the alias and instance address in **Delete SDK profile?**.
4. Select **Delete profile** to confirm.
5. Confirm that the alias no longer appears.

Select **Cancel** to keep the profile. Deletion removes its saved SDK credentials from this machine; it does not delete the ServiceNow user or instance.

If the current project uses that profile, CoCo attempts to set its selection to **None**. If that save fails, resolve the displayed error and clear the selection manually.

Other projects can retain references to the deleted alias. Select **None** or a replacement profile in each affected project.

If deletion reports a changed instance, refresh the profile list. Confirm the current alias and instance before another deletion attempt.

To recreate a deleted profile, complete sign-in again. There is no restore command for deleted credentials in CoCo.

### Resolve a missing profile

A missing-profile message can mean that an alias was deleted or refers to a different instance.

1. Open the **SDK** picker.
2. Select **Refresh**.
3. If the profile remains absent, select **None** or a valid replacement.
4. If necessary, use **Add profile…** to authenticate again.

A discovery error does not silently change the saved selection. Ordinary chats remain available, but the missing SDK target requires your attention before SDK work.

## Pursuit instance connection

**Instance connection** is separate from the SDK section. It authenticates CoCo itself for future pursuit data.

Pursuit table access is not configured yet. A successful connection does not populate Pursue or make a table schema available to an agent.

### Obtain administrator details

Ask your ServiceNow administrator for:

- The HTTPS instance address.
- A public OAuth client ID.
- Support for PKCE with the S256 method.
- Registration of the exact redirect URI displayed in CoCo.

PKCE is Proof Key for Code Exchange, a protection for the authorization-code exchange. Do not supply a client secret in the client-ID field.

### Connect the instance

1. Open [Settings → Integrations → Instance connection](/settings/integrations#servicenow-connection).
2. In **Instance connection**, enter the **Instance URL**.
3. Enter the administrator-supplied **OAuth client ID**.
4. Select **Connect with SSO**.
5. Complete sign-in in your browser.
6. Return to CoCo.
7. Confirm that **Connected · authentication verified** appears.

This connection uses the configured browser callback. It does not use the SDK profile dialog's manual code field.

To cancel an incomplete sign-in, select **Cancel sign-in**. CoCo encrypts the saved connection credentials on this desktop.

### Test, change, or disconnect

**Test connection** renews the saved sign-in. It tests authentication, not access to pursuit tables.

To test the connection:

1. Select **Test connection**.
2. Wait for **Testing authentication…** to end.
3. Read the authentication status or error.

To use another instance or client ID:

1. Select **Disconnect**.
2. Enter the replacement **Instance URL**.
3. Enter the replacement **OAuth client ID**.
4. Select **Connect with SSO**.
5. Complete sign-in in your browser.
6. Return to CoCo to confirm the authentication status.

To remove the local connection, select **Disconnect**. Make sure that **Not connected** appears.

The instance and client-ID fields cannot change while the connection remains signed in. Disconnect does not delete ServiceNow records or alter SDK profiles.
