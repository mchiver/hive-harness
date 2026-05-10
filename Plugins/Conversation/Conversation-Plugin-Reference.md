# Conversation Plugin Reference


## Summary

The Conversation plugin ties together a user, topics, and an LLM model into a prompt-response pipeline with chat history, context retrieval, and tool calling. Conversations are the workhorses of an AI harness, combining prompt engineering, context engineering, conversation memory, and tool use.

Data is stored per-entity in the Hive's `.hive/Entities/<owner>/Conversation/<EntityName>/` directory.


## Use Cases

- **AI chat sessions** — Persistent conversations with context from knowledgebases.
- **Channel sessions** — Channels use conversations for persistent session mechanics.
- **Multi-topic context** — Combine multiple Topic entities into a single conversation's context window.
- **Tool-augmented AI** — LLM can invoke Hive tools during conversation processing.


## Session Mechanics

A conversation serves as a session for channels:
- Channel obtains a username from the system or from the user.
- If a password/token is provided, the username is authenticated.
- Channel can be configured with a persistent `ChannelName` or use a default (e.g. 'cli', 'discord').
- Channel locates the most recent conversation shared with the user via `GetLastConversation`.


## Entity Management

Entity tools are provided automatically by the framework for any entity-type plugin.

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a Conversation entity configuration. |
| `ListEntities()` | Lists all Conversation entities in the current Hive. |
| `DeleteEntity( EntityName )` | Deletes a Conversation entity and all of its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a Conversation entity, preserving all data. |

### ConfigEntity

Read, create, or update a Conversation entity configuration.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The entity name. |
| `Settings` | object | no | Configuration settings to merge into the entity. |

**Settings Fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `Description` | string | `''` | Human-readable description. |
| `Username` | string | `''` | Name of the user using the chat. |
| `ChannelName` | string | `''` | Name of the channel the user is using. |
| `Topics` | array | `[]` | Array of Topic entity names to search for context. |
| `Instructions` | array | `[]` | Array of instruction text strings for the prompt. |
| `ChatLlm` | string | `''` | Name of the Llm entity to use for chat. |

**Returns:** `object` — The full entity configuration after merging.

**Usage:**
```js
await hive.InvokeTool( 'Conversation.ConfigEntity', {
    EntityName: 'my-chat',
    Settings: {
        Description: 'Development assistant',
        Username: 'alice',
        ChannelName: 'cli',
        Topics: [ 'project-docs', 'api-reference' ],
        Instructions: [ 'You are a helpful development assistant.' ],
        ChatLlm: 'local-llama',
    },
} );
```


## Conversation Tools

| Signature | Description |
|---|---|
| `ListConversations( Username, [ChannelName] )` | List conversations for a user. |
| `GetLastConversation( Username, [ChannelName] )` | Get most recently used conversation. |
| `Chat( EntityName, Text )` | Send text to the LLM with full context pipeline. |
| `Search( EntityName, Text, [MinScore], [MaxResults] )` | Search all conversation topics. |
| `GetHistory( EntityName, [MaxItems] )` | Get recent history entries. |
| `ClearHistory( EntityName )` | Clear conversation history. |

### ListConversations

Lists conversations matching a Username and optional ChannelName (glob pattern supported).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Username` | string | yes | The username to filter by. |
| `ChannelName` | string | no | Channel name or glob pattern. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Conversations` | array | Array of `{ ConversationName, Description, ChannelName, UsedAt }`. Sorted by UsedAt descending. |
| `Count` | number | Number of conversations found. |
| `Error` | string | Error message on failure. |

### GetLastConversation

Returns the most recently used conversation matching the criteria.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Username` | string | yes | The username to filter by. |
| `ChannelName` | string | no | Channel name or glob pattern. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `ConversationName` | string | Name of the most recent conversation. |
| `Description` | string | Description. |
| `ChannelName` | string | Channel name. |
| `UsedAt` | string | Timestamp of last use. |
| `Error` | string | Error message on failure. |

### Chat

Sends text to the conversation's LLM through the full context pipeline:
1. Records user message in history.
2. Searches configured Topics for relevant context.
3. Retrieves chat history.
4. Assembles the prompt with context, history, instructions, and task.
5. Submits to the LLM.
6. Handles tool calls in a loop (max 10 iterations).
7. Records LLM response in history.

**Tool Call Format:** The LLM may include tool calls in its response using:
```xml
<tool-call>
{ "Tool": "PluginName.ToolName", "Arguments": { ... } }
</tool-call>
```

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Conversation entity. |
| `Text` | string | yes | The user text to send. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Response` | string | The final LLM response text. |
| `ToolCalls` | array | Array of `{ Tool, Arguments, Success, Result, Error }` for each tool call made. |
| `Error` | string | Error message on failure. |

### Search

Searches all Topics attached to the conversation for text similar to the query.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Conversation entity. |
| `Text` | string | yes | The text to search for. |
| `MinScore` | number | no | Minimum similarity score (default 0.3). |
| `MaxResults` | number | no | Maximum results (0 or omitted for all). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Results` | array | Array of `{ TopicName, SourceName, Text, Score }`. |
| `Count` | number | Number of results. |
| `Error` | string | Error message on failure. |

### GetHistory

Returns the most recent chat history entries.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Conversation entity. |
| `MaxItems` | number | no | Maximum entries to return (default: all). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `History` | array | Array of `{ CreatedAt, Source, Content, Tokens }`. |
| `Count` | number | Number of entries. |
| `Error` | string | Error message on failure. |

### ClearHistory

Clears all history entries for a conversation.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Conversation entity. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RowsRemoved` | number | Number of entries removed. |
| `Error` | string | Error message on failure. |


## Prompt Construction

The `Chat` tool builds the final prompt as:

```xml
<conversation>
    <name>ConversationName</name>
</conversation>

<history>
[source] content
...
</history>

<context>
[score:0.85] relevant text chunk
...
</context>

<instructions-1>
instruction text
</instructions-1>

<task>
User supplied question or prompt text.
</task>
```


## Chat History Storage

Each conversation stores chat history in a SQLite database at `.hive/Entities/<owner>/Conversation/<EntityName>/history.db`.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK) | Auto-incrementing row ID. |
| `CreatedAt` | TEXT | ISO 8601 timestamp. |
| `Source` | TEXT | One of `user`, `llm`, or `tool`. |
| `Content` | TEXT | The message content. |
| `Tokens` | INTEGER | Estimated token count (`Content.length / 4`). |


## Data Storage

Each Conversation entity stores its data at:

```
.hive/Entities/<owner>/Conversation/<EntityName>/<EntityName>.entity.json    # Entity configuration
.hive/Entities/<owner>/Conversation/<EntityName>/history.db                  # SQLite chat history
```
