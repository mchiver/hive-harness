# HiveJS: Empowering AI with Structured Action

## What is HiveJS?
HiveJS is a lightweight, plugin-based runtime for Node.js that transforms your project folders into intelligent, AI-ready workspaces. It provides the essential infrastructure for AI agents to discover, understand, and execute tools with precision and security.

## Core Features

### Plugin-Driven Architecture
Extend HiveJS effortlessly. Plugins provide the tools that AI agents use to interact with the world. From SQL databases and KeyStores to Web Search and Workspace manipulation, every capability is a modular plugin.

### Per-Project Isolation (The Hive)
Stop worrying about data leakage. HiveJS uses a "Hive" model where each project folder gets its own isolated `.hive/` data directory. Your AI agent's state for one project never touches another.

### Built-in Security & Auth
Enterprises demand control. HiveJS includes user authentication and role-based access, ensuring that tools are only executed by authorized users.

### AI-Native Design
Tools aren't just functions; they are defined by JSON Schemas. This means LLMs can automatically discover available tools, understand the required parameters, and validate the output without manual prompt engineering.

## Key Benefits

- **Security by Default:** No more raw shell access. Agents use structured tools with defined boundaries.
- **Seamless Scalability:** Add new capabilities to your AI agent by simply installing a new plugin.
- **Project-Centric State:** Configuration and data live with the project, making your AI's context portable and consistent.
- **Developer Velocity:** Turn complex Node.js logic into an AI-executable tool in minutes.

## Use Cases
- **AI Coding Assistants:** Automate refactoring and file management across multiple repositories.
- **Local Data Analysts:** Give your AI the ability to query local SQL stores and summarize project data.
- **Workflow Automation:** Build complex, multi-step AI workflows that interact with your local file system securely.
