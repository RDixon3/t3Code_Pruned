# Technical reference

Use this guide to identify the machine, process, or data store that controls a result. These distinctions are important for support and administration.

## Terms used in CoCo

| Term             | Meaning in this guide                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Client           | The desktop or web interface that you use.                                                                       |
| Environment      | A CoCo server and the machine, files, accounts, and tools that it can use.                                       |
| Project          | An environment record for a workspace folder. A project contains chats and project defaults.                     |
| Thread or chat   | One saved conversation in a project. The interface uses both terms.                                              |
| Turn             | One request to the agent and its response or actions.                                                            |
| Provider         | The tool that runs the agent, such as Codex, Claude Code, or Cursor. This tool is also called a harness.         |
| Model            | The language model selected through a provider.                                                                  |
| CoCo agent       | A named set of instructions for a chat. It is separate from the provider and model.                              |
| Skill            | A package of instructions that a provider can find and use.                                                      |
| Current checkout | The project folder and Git branch already on the environment.                                                    |
| Worktree         | Another folder for work on the same Git repository. It can use a separate branch.                                |
| Context          | Information supplied with a request, such as project references or attached records.                             |
| Snapshot         | The record fields captured when you attach an item. A snapshot does not update itself.                           |
| MCP              | Model Context Protocol. A connection that exposes named tools to a client or provider.                           |
| SDK              | Software development kit. In CoCo, the ServiceNow SDK is a separate command-line tool.                           |
| SSO              | Single sign-on. A sign-in process controlled by your organization or account service.                            |
| OAuth            | An authorization process that grants application access. The application does not receive your account password. |
| CLI              | Command-line interface. A program that accepts text commands, such as a provider tool or npm.                    |
| PATH             | The operating-system list of directories used to find executable programs.                                       |
| DNS              | Domain Name System. It converts a host name into a network address.                                              |
| HTTP             | Hypertext Transfer Protocol. Web services use it for requests and responses.                                     |
| TLS              | Transport Layer Security. It protects network traffic and confirms that the server's certificate is valid.       |

## Where does the agent run?

| Component        | Responsibility                                          | Which machine matters?                                              |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| Desktop client   | Display the interface and supply desktop-only functions | The desktop computer                                                |
| Web client       | Display the interface and connect to an environment     | Its browser stores local interface state; its server runs commands. |
| CoCo server      | Store projects and chats; start providers and terminals | The environment's machine                                           |
| Provider process | Run the selected provider and its tools                 | The environment's machine and provider account                      |
| External service | Enforce Jira, ServiceNow, or source-control permissions | The service and the authenticated account                           |

The desktop starts its included local server. On Windows it can also run a backend inside a local WSL distribution.
The web development client does not run a coding provider inside the browser.

A WSL project uses its Linux folder and provider installation. Windows files and credentials are separate.
Refer to [Local connections and WSL](connections.md) before changing a backend or executable path.

## How context reaches a chat

CoCo supplies different types of context at different times. A change to one type does not replace every other type.

| Context                  | Source                                             | When it applies                                                      |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------------------- |
| Agent instructions       | The CoCo agent selected for the new chat           | The chat retains its saved instructions.                             |
| Jira project reference   | The chat owner's project settings                  | CoCo reads current settings when it prepares the next ordinary turn. |
| SDK profile selection    | The chat owner's project settings                  | CoCo reads the alias and instance for the next ordinary turn.        |
| Attached Jira record     | The fields visible when you select **Add to chat** | The submitted message contains that captured snapshot.               |
| File or terminal context | The attachment or selection in the draft           | The submitted turn receives the supported content.                   |
| Native skill             | The provider's installed skill files               | The provider determines when it reads or reloads the files.          |

Project context comes from the project that owns the chat. It does not come from an unrelated project selected in the sidebar.
Worktree chats inherit their project's selections.

A cleared Jira or SDK selection explicitly means that no target is selected. It replaces the earlier CoCo project selection on the next applicable turn.
CoCo does not enrich native slash commands with these project references.

Project context stays outside CoCo's saved user-message text. It can appear in provider history or logs.
Attached record snapshots are different: CoCo stores their content with the submitted message and displays them as compact chips.

Neither type is an access restriction or deployment approval. The provider and external service still control available actions and permissions.

Refer to [Projects and context](projects.md) and [Give chat useful context](chat-context.md) for user procedures.

## Desktop integration boundaries

| Capability                             | Current boundary                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Jira SSO and Manage requests           | The local desktop connection                                                     |
| Jira chat tools                        | Supported local desktop chats with Codex, Claude Code, or Cursor                 |
| SDK installation and profile discovery | The desktop's current global npm environment                                     |
| SDK profile choice                     | A project selection; it does not install the SDK on another environment          |
| ServiceNow pursuit-data connection     | A separate desktop authorization; table access is not configured in this version |
| Native skills                          | The provider destinations reported in **Agents & Skills**                        |

Windows Subsystem for Linux (WSL) environments do not receive the desktop Jira connection or SDK profile discovery.
A visible project reference does not prove that WSL has the required tool or account.

If a capability is unavailable, identify the environment that owns it before you change the configuration.

## Who owns credentials and stored data?

The packaged CoCo app normally uses `.coco/userdata` below your home directory. Development and custom launches can use different locations.
Use the path reported by the active application instead of a guessed folder.

| Data                                | Storage or owner                                                 | Practical result                                                                      |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Saved projects and chats            | The environment database, `state.sqlite`                         | Another client sees them when it connects to that environment.                        |
| Project context and server defaults | The environment's `settings.json`                                | The environment supplies these values to the applicable chats.                        |
| Desktop preferences                 | Files such as `desktop-settings.json` and `client-settings.json` | They belong to that desktop installation.                                             |
| Drafts and saved prompts            | Client storage                                                   | Another device does not automatically receive an unsent draft or Stash entry.         |
| Executive briefing cache            | Client storage                                                   | A colleague can have a different briefing and refresh time.                           |
| Provider credentials                | The provider's account and configuration storage                 | CoCo does not replace the provider sign-in process.                                   |
| SDK credentials                     | ServiceNow SDK storage                                           | CoCo saves the selected alias and instance reference, not the SDK password or tokens. |
| Jira OAuth credentials              | Encrypted desktop file, `jira-credentials.enc`                   | A copy of the file is not a portable sign-in procedure.                               |
| Jira diagnostic report              | `logs/jira-v1-diagnostics.log`                                   | The Jira Settings panel reports its actual path.                                      |
| Server and provider logs            | The environment's `logs` folder                                  | Logs can contain paths, task text, and tool output.                                   |
| Project files                       | The workspace and worktree folders                               | A copy of app data alone is not a project-file backup.                                |

The Jira **Disconnect** action removes its saved desktop credentials. Revocation of service access is a separate account action.
Deletion of an SDK profile affects the global SDK profile on that desktop, not only one chat.

Client storage and environment data are separate. Electron stores desktop client data in its application-data location, which can differ from `.coco/userdata`.
The web client uses browser storage for drafts and briefings. Removal of that storage can remove these local records, but it does not remove server-side chats.

## Preserve data before maintenance

CoCo has no complete backup wizard. Database copies require a consistent state.
An ordinary copy of an active SQLite database can omit recent data or produce an unusable copy.

Use this procedure with the environment owner:

1. Record the CoCo version and actual data directory.
2. Save important drafts and file changes.
3. Stop active agent tasks and terminal commands.
4. Quit the desktop client.
5. Make sure that the server which owns the database is stopped.
6. Copy the complete data directory to an approved backup location.
7. Back up project and worktree folders separately.
8. Keep the copy separate from any environment used for tests.

This data-directory copy does not necessarily include client drafts, provider credentials, or SDK profiles. Identify their separate locations before you plan a complete machine backup.
Keep a separate copy of important unsent text. Do not treat a Stash entry on the same client as an independent backup.

If the server must stay active, ask its administrator for a SQLite-consistent backup. Do not copy only `state.sqlite` from an active environment.

For restoration, use a compatible CoCo version and a stopped destination server. Restore the complete backup before you start the server.
Do not merge database files by hand. A different machine can require new provider, Jira, and SDK authorization.

## Corporate networking

Desktop Jira requests use Electron's network service. That service uses system proxy and certificate configuration.
Provider command-line tools and npm can use different network settings.

The Jira integration uses `https://mcp.atlassian.com/v1/mcp`. OAuth can also contact authorization services and return through a local callback.
SDK authorization uses the selected ServiceNow instance. The pursuit-data connection can use a different instance.

If only one component reports a network error, test that component's path. A successful browser visit does not prove that npm or a provider can connect.

For a certificate error, give IT the component name, destination, error code, and connection stage.
Do not disable certificate verification to make a connection succeed.

Refer to [Find and fix a problem](troubleshooting.md) for specific network and diagnostic procedures.

## Development and release work

Use [Development setup](development.md) for a source checkout, isolated data, local launch, and build prerequisites.
Use [Updates](updates.md) to distinguish an application release from a provider, SDK, or skill update.

The Help articles ship with the application version. A provider or SDK update does not update these articles.
