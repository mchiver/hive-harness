# Channel System Implementation Plan


## Context

HiveJS has a full plugin ecosystem (Conversation, Topic, Llm, Workflow, etc.) but no way to interact with it. The Conversation plugin already supports Username + ChannelName session mechanics, and CommandProcessor has SuggestTools/SuggestEntities for autocomplete. This plan builds the Channel base class and CLI channel as the first user-facing interface.


## Scope

| File | Action | Description |
|---|---|---|
| `Source/Channel.js` | Create | Base class for all channels |
| `Channels/Cli/Cli.js` | Create | CLI channel implementation |
| `Plugins/Conversation/Conversation.factory.js` | Modify | Add ConfigSchema with DefaultChatLlm |
| `Tests/310-Channel.test.js` | Create | Base class tests |
| `Tests/320-Cli-Channel.test.js` | Create | CLI integration tests |
| `package.json` | Modify | Add minimist + moniker dependencies, bin entry |


## New Dependencies

- **minimist** (v1.2.8) — Zero-dependency CLI arg parser.
- **moniker** (v0.1.2) — Name generation. Pattern: verb-adjective-noun (e.g. "running-bold-falcon").


## 1. Conversation Plugin Change

**File:** `Plugins/Conversation/Conversation.factory.js`

Add `ConfigSchema` with `DefaultChatLlm` field. This is loaded automatically by the existing `Hive.Open` code (Hive.js:73-86) from `.hive/Conversation/Conversation.plugin.json` via `Object.assign`.

```js
Plugin.ConfigSchema = {
    type: 'object',
    properties: {
        DefaultChatLlm: { type: 'string', default: '' },
    },
    required: [],
};
```


## 2. Channel Base Class (`Source/Channel.js`)


### Properties

| Property | Type | Description |
|---|---|---|
| `ChannelName` | string | Set by subclass (e.g. 'cli', 'discord') |
| `Registry` | object | Registry instance |
| `Hive` | object | Hive instance |
| `UserName` | string | Resolved username |
| `ConversationName` | string | Active conversation entity name |
| `IsInteractive` | boolean | Whether channel supports interactive input |
| `Options` | object | Parsed CLI args (minimist output) |


### Boot Sequence — `Channel.Run( ChannelClass )`

Static entry point for all channels:

1. Instantiate ChannelClass.
2. Parse `process.argv` via minimist.
3. Set `IsInteractive` = (no positional args && `process.stdin.isTTY`).
4. If `--help` → `ShowHelp()` and exit.
5. Call `Initialize()` — opens Registry + Hive only.
6. Call `ResolveConversation()` — finds or creates conversation.
7. If `--test` → `RunTest()` and exit.
8. If positional args → one-shot: `ProcessInput( text )`, `Stop()`.
9. Else → interactive: `Start()`.

Key: `ResolveConversation` is separate from `Initialize` so that `IsInteractive` is set correctly before any user prompting may occur.


### Initialize()

1. Resolve registry path: `--registry` or `os.homedir()/.hives`. Error if folder missing.
2. `Registry.Open( registry_path )`.
3. Resolve username: `--username` or `os.userInfo().username`.
4. Resolve hive path: `--path` or `process.cwd()`.
5. `Hive.Open( registry, hive_path, username, password_or_null )`.


### ResolveConversation()

1. If `--conversation` provided → verify entity exists, use it.
2. Else → `Conversation.GetLastConversation( Username, ChannelName )`.
3. If found → use it.
4. Else → `CreateNewConversation()`.


### CreateNewConversation( Name )

1. Generate name via moniker if not provided: `generator( [verb, adjective, noun] ).choose()`.
2. Resolve ChatLlm via `ResolveChatLlm()`.
3. Create entity via `Conversation.ConfigEntity` with Username, ChannelName, ChatLlm.


### ResolveChatLlm()

Priority chain:

1. `--llm` flag.
2. `hive.Plugins.Conversation.DefaultChatLlm` (from plugin config).
3. If interactive → `PromptChoice()` showing available Llm entities.
4. If non-interactive → throw error with guidance.


### ProcessInput( InputText )

Unified input routing pipeline:

1. Starts with `/` → `HandleCommand()`.
2. First token exactly matches a loaded `Plugin.Tool` (via Parse + Validate) → execute tool call, Output result.
3. Otherwise → `Conversation.Chat( ConversationName, Text )`, Output response.


### HandleCommand( CommandText )

Parse command name and dispatch:

| Command | Description |
|---|---|
| `/Help` | Call `ShowHelp()` |
| `/Login <username> [password]` | Reopen Hive with new credentials, re-resolve conversation |
| `/Conversation [name]` | Switch conversation or list conversations for user+channel |
| `/NewConversation [name]` | Create new conversation (moniker name if none given) |


### GetSuggestions( InputText ) — async

Returns suggestion array based on input state:

| Input State | Suggestions |
|---|---|
| Empty or starts with `/` | Channel commands matching prefix |
| No space yet (typing tool name) | `SuggestTools( Hive, partial )` |
| Space present (tool name complete) | `SuggestEntities( Hive, PluginName, partial )` for entity params |


### RunTest() — Dry Run

Runs full setup (auth, conversation resolution, tool validation) but skips Execute/Chat. Outputs JSON report with all resolved state.


### Abstract Hooks

| Method | Description |
|---|---|
| `Output( Message, Type )` | Display output. Type: 'text', 'json', 'table', 'error' |
| `async Prompt()` | Read one line of user input |
| `async PromptChoice( Message, Items )` | Present numbered choice list, return selection |
| `async Start()` | Begin interactive loop |
| `async Stop()` | Clean up and exit |
| `ShowHelp()` | Display help text |


## 3. CLI Channel (`Channels/Cli/Cli.js`)

Shebang: `#!/usr/bin/env node`

- `ChannelName = 'cli'`
- Uses Node.js `readline` module.
- Async completer wired to `GetSuggestions()` for tab-completion.
- Output: pretty-print JSON, red errors on TTY, `console.table()` for arrays.
- PromptChoice: numbered list, read selection via `Prompt()`.


## 4. CLI Arguments

| Flag | Description | Default |
|---|---|---|
| `--registry <path>` | Registry path | `~/.hives` (error if missing) |
| `--path <path>` | Hive workspace path | `process.cwd()` |
| `--username <name>` | Username | `os.userInfo().username` |
| `--password <pass>` | Auth password | none (guest) |
| `--conversation <name>` | Resume named conversation | GetLastConversation or new |
| `--llm <name>` | ChatLlm override | Plugin DefaultChatLlm |
| `--test` | Dry run report | — |
| `--help` | Show help | — |

Positional args joined as input text for one-shot mode.


## 5. Test Strategy

### Tests/310-Channel.test.js — Base Class

TestChannel subclass captures output, returns canned input. Tests:

- Initialize opens Registry and Hive
- Initialize throws on missing registry
- ResolveConversation with --conversation flag
- ResolveConversation creates new when none found
- ResolveChatLlm priority chain
- ProcessInput routing (commands, tools, chat)
- HandleCommand dispatch
- GetSuggestions for each input state
- RunTest output structure

### Tests/320-Cli-Channel.test.js — Integration

Use `child_process.execFile` to test:

- One-shot tool execution
- `--help` output
- `--test` report
- Missing registry error
- Interactive tests skipped (require PTY)


## 6. Implementation Order

1. `package.json` — Add minimist + moniker.
2. `Plugins/Conversation/Conversation.factory.js` — Add ConfigSchema.
3. `Source/Channel.js` — Full base class.
4. `Tests/310-Channel.test.js` — Validate base class.
5. `Channels/Cli/Cli.js` — CLI implementation.
6. `Tests/320-Cli-Channel.test.js` — Integration tests.
7. Full test suite verification.


## 7. Verification

```bash
npm install
npm test
node Channels/Cli/Cli.js --help
node Channels/Cli/Cli.js --test --registry Tests/.test-data/Registry --path Tests/.test-data/Data --username testuser --password test123
node Channels/Cli/Cli.js --registry Tests/.test-data/Registry --path Tests/.test-data/Data --username testuser --password test123 "System.Info"
```
