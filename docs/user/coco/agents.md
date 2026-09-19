# Agents and skills

A **CoCo agent** gives a chat a saved set of instructions. A **skill** is a package of reusable instructions and optional support files that a provider can discover.

A **provider** is the runtime that operates the agent, such as Codex, Claude, or Cursor. It is also called a harness.

Agent instructions and skills serve different purposes:

- The agent defines the chat's role and instructions.
- A skill supplies a reusable procedure when it is relevant to the task.
- The provider supplies the model, tools, and session behavior.
- Integration settings supply connections such as Jira; an agent selection does not supply credentials.

Use [Settings → Agents & Skills](/settings/agents) to examine available agents, control native skill installation, and save a future content source.

## Choose an agent for a new chat

1. Select the intended project.
2. Select **Manage** or **Build**.
3. Start a new chat.
4. Open the agent picker beside the model picker.
5. Select the intended agent or **Default**.
6. Read its name in the picker before you send the first message.

New Manage chats default to the **Manage** agent. New Build chats default to the **Build** agent. You can select **Pursuit** explicitly.

**Default** uses the provider without a CoCo agent definition. It does not remove the provider's normal instructions, project instructions, or available tools.

The bundled **Build**, **Manage**, and **Pursuit** definitions contain basic instructions. They do not yet define specialized workflows or recommend bundled skills.

An agent name describes the selected instruction set. It does not guarantee expertise, Jira access, or a particular tool.

### Read agent instructions

1. Open [Settings → Agents & Skills](/settings/agents).
2. Find the intended agent.
3. Expand **View instructions**.
4. Read the instruction text and any listed skills.

These are the definitions available for new chats in this environment. The page is read-only; it has no agent editor.

### Use different instructions in an existing chat

The first submitted message fixes the chat's agent instructions. A later tab change, project selection, or app update does not replace those saved instructions.

1. Open the agent picker in the existing chat.
2. Select **Start a new chat**.
3. Select the required agent before the first message.

The provider is also fixed for an existing chat. To use another provider, start a new chat. Available model choices can still depend on the provider.

When a definition changes, existing chats keep their earlier instruction snapshot. Start a new chat to use the revised definition.

## Install CoCo skills into your providers

Native installation places CoCo skills in the locations that Codex, Claude, and Cursor use for skill discovery. The skills are also available outside CoCo.

Settings applies this action to the primary environment. If you use several environments, confirm which environment you intend to change.

### Enable installation

1. Open [Settings → Agents & Skills](/settings/agents).
2. Find **Native skills**.
3. Expand **Installation locations**.
4. Confirm that the destinations belong to the intended environment and provider accounts.
5. Select **Enable installation**.
6. Read the synchronization status and installed-copy count.
7. If an error appears, use [Resolve installation problems](#resolve-installation-problems).

An installed copy means one skill package at one destination. It is not a count of unique skills across all providers.

The current bundled library contains no specialized skills. A result of **0 installed copies** is therefore expected with this library.

**Enable installation** prepares the environment for bundled skills when they become available. It does not download a skill collection from an external repository.

### Understand synchronization

When synchronization is enabled, CoCo synchronizes bundled skills at environment startup. Changes to configured provider destinations can also cause synchronization.

**Resync bundled skills** repeats the synchronization without an app restart. It uses the bundled library, not the saved Azure DevOps repository.

Installed skills are not frozen with the chat's saved agent instructions. Each provider discovers skills according to its own behavior.

If an active chat does not discover a newly installed skill, start a new chat. Do not assume that every active provider session immediately reloads changed files.

The listed destinations reflect the environment and provider home settings. Use **Installation locations** to identify the correct directories for your providers.

## Disable or remove installed skills

### Stop synchronization

1. Open [Settings → Agents & Skills](/settings/agents).
2. Under **Native skills**, select **Disable synchronization**.
3. Confirm that the status shows synchronization disabled.

This stops automatic synchronization. It leaves installed skills available to their providers.

To resume synchronization, select **Enable installation**. CoCo then synchronizes the bundled library again.

### Remove CoCo-managed copies

1. Open [Settings → Agents & Skills](/settings/agents).
2. Select **Remove CoCo skills…**.
3. Read the confirmation message.
4. Select **Remove**.
5. Read the final status and any error.

Select **Cancel** to keep the installed copies. Removal also disables synchronization.

CoCo removes only installations that it manages. It leaves unrelated skills in place.

Do not remove a provider's entire skills directory to remove CoCo skills. Other tools can use the unrelated packages in that directory.

## Resolve installation problems

### The agent library cannot load

1. Confirm that the primary environment is connected.
2. Open [Settings → Agents & Skills](/settings/agents).
3. Select **Retry** beside the library error.
4. If the error remains, retain its text and the app version.

An unavailable agent cannot supply its instructions to a new chat. You can select another available agent or **Default** if that choice fits the task.

### A skill cannot synchronize

1. Read the error under **Native skills**.
2. Expand **Installation locations**.
3. Confirm the affected destination and its account.
4. Resolve the reported access or file conflict.
5. Select **Resync bundled skills**.

If synchronization is disabled, select **Enable installation** instead. After the action completes, read the error state as well as the installed-copy count.

CoCo refuses to overwrite an unrelated skill with the same managed name. Keep unrelated packages when you resolve that conflict.

Do not edit an installed CoCo-managed copy as a permanent customization. Later synchronization can replace managed content.

## Define the future content repository

**Content repository** stores the intended Azure DevOps source for agents and skills. This version saves the definition only.

Repository authentication, access verification, and update downloads are not available yet. The app continues to use its bundled agents and skills.

### Save a repository definition

1. Open [Settings → Agents & Skills](/settings/agents).
2. In **Content repository**, enter the **Repository URL**.
3. Enter the **Approved branch**.
4. Select **Save repository**.
5. Confirm that **Repository saved** appears.

Use an HTTPS Azure DevOps repository URL, such as:

`https://dev.azure.com/organization/project/_git/repository`

Replace the example organization, project, and repository with your source. Do not include a password, access token, query parameter, or fragment.

**Approved branch** is the branch your team intends to use. Save does not establish that the branch exists or that your account can read it.

If Save reports an invalid URL or branch, correct the entry before you retry. If Save reports a connection error, restore the environment connection first.

### Change or clear the definition

1. Open **Content repository**.
2. To change the source, edit the URL or approved branch.
3. Select **Save repository**.
4. To remove the saved definition, select **Clear repository**.

**Clear repository** does not remove bundled agents or installed skills. **Resync bundled skills** never fetches this repository.

Use [Updates and compatibility](updates.md) to distinguish app updates, SDK updates, and the future content-update path.
