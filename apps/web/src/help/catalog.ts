export const HELP_TOPICS = [
  {
    id: "getting-started",
    title: "Start with CoCo",
    category: "Getting started",
    summary: "Prepare the app, connect a provider, and complete your first chat.",
    aliases: "install mac windows setup first chat onboarding welcome",
  },
  {
    id: "projects",
    title: "Projects and context",
    category: "Projects & context",
    summary:
      "Add a project, set its defaults, and keep chats connected to the correct folder and accounts.",
    aliases:
      "folder worktree effort project selection jira link context clone actions scripts automatic pull checkout grouping",
  },
  {
    id: "jira",
    title: "Connect and link Jira",
    category: "Manage",
    summary: "Connect your account, link a site and project, and test Jira access in chat.",
    aliases:
      "jira connected but chat cannot use it tools missing mcp sso site linking disconnect diagnostics",
  },
  {
    id: "manage",
    title: "Manage project work and risks",
    category: "Manage",
    summary: "Read the board, change issue status, and use risks and estimates in project work.",
    aliases:
      "story points missing points estimates drag drop board risk jira status pagination backlog",
  },
  {
    id: "briefing",
    title: "Read the executive briefing",
    category: "Manage",
    summary: "Generate a project briefing and understand its evidence, limits, and refresh times.",
    aliases: "focus summary stale refresh automatic daily pm status twenty four hours",
  },
  {
    id: "build",
    title: "Build and chat",
    category: "Build & chat",
    summary: "Start a task, respond to approvals, use plans, and review the agent's changes.",
    aliases:
      "codex claude cursor model access permissions terminal git stop resume rollback snooze archive",
  },
  {
    id: "chat-context",
    title: "Give chat useful context",
    category: "Build & chat",
    summary: "Attach records, files, and screenshots. Save drafts and restore stashed prompts.",
    aliases:
      "attachment chip jira risk issue offering snapshot context stash upload screenshot terminal selection browser annotation",
  },
  {
    id: "providers",
    title: "Providers and model configuration",
    category: "Build & chat",
    summary: "Install a provider, select its account and model, and repair detection problems.",
    aliases:
      "codex claude cursor authentication login cli executable path custom model instance api key usage limits",
  },
  {
    id: "servicenow",
    title: "Use the ServiceNow SDK",
    category: "ServiceNow",
    summary:
      "Install the SDK, add an authentication profile, and select the profile for a project.",
    aliases:
      "change servicenow account sdk profile oauth basic password delete update pursuit instance",
  },
  {
    id: "v0",
    title: "Prototype with v0",
    category: "Build & chat",
    summary: "Connect v0 tools to chat, create visual prototypes, and revise them.",
    aliases: "vercel v0 prototype oauth sso sign in reconnect mcp beta diagnostics",
  },
  {
    id: "agents",
    title: "Agents and skills",
    category: "Agents & Skills",
    summary:
      "Select chat instructions, examine native skill status, and define a future content source.",
    aliases:
      "repository saved but no updates ado content repo configured downloading persona prompt resync",
  },
  {
    id: "settings",
    title: "Settings walkthrough",
    category: "Settings & updates",
    summary:
      "Set behavior, defaults, shortcuts, and source control. Understand setting scope and reset actions.",
    aliases:
      "general preferences keybindings archive recovery background activity text generation model reset",
  },
  {
    id: "appearance",
    title: "Appearance and readability",
    category: "Settings & updates",
    summary: "Select themes, adjust contrast, and set interface, chat, code, and terminal text.",
    aliases:
      "theme coco pwc colors light dark system fonts typography contrast glass opacity animations",
  },
  {
    id: "snapshots",
    title: "SnapShots and app capture",
    category: "Settings & updates",
    summary:
      "Set up desktop capture, assign a shortcut, and examine captured content before you send it.",
    aliases:
      "snapshot screen capture screenshot permission accessibility mac windows shortcut retention",
  },
  {
    id: "connections",
    title: "Connections and environments",
    category: "Settings & updates",
    summary:
      "Check the local connection, use WSL on Windows, and recover an unavailable environment.",
    aliases: "local server environment pairing token wsl localhost connection restart",
  },
  {
    id: "updates",
    title: "Keep CoCo and its tools current",
    category: "Settings & updates",
    summary: "Update the app, provider, or SDK. Understand the limits of agent and skill updates.",
    aliases:
      "version release upgrade notification update popup download dmg installer compatibility",
  },
  {
    id: "troubleshooting",
    title: "Find and fix a problem",
    category: "Troubleshooting",
    summary:
      "Identify the failed step, use a specific recovery procedure, and collect useful diagnostics.",
    aliases:
      "error not working timeout initialize fetch failed failed launch sdk npm lag slow missing cannot",
  },
  {
    id: "technical",
    title: "Technical reference",
    category: "Technical reference",
    summary:
      "Identify where commands run, how context reaches chats, and who owns accounts and stored data.",
    aliases:
      "where does the agent run server environment data storage logs corporate proxy certificate glossary backup credentials",
  },
  {
    id: "development",
    title: "Development setup",
    category: "Technical reference",
    summary:
      "Prepare a checkout, run the desktop or web client, and diagnose local launch failures.",
    aliases:
      "dev development source repo clone install dependencies node vp pairing home-dir port build release mac windows",
  },
] as const;
export type HelpArticleId = (typeof HELP_TOPICS)[number]["id"];
export const HELP_CATEGORIES = [...new Set(HELP_TOPICS.map((topic) => topic.category))];
export const findHelpTopic = (id: string) => HELP_TOPICS.find((topic) => topic.id === id);
