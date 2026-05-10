# Llm Plugin Reference


## Summary

The Llm plugin provides LLM chat and embedding capabilities within a Hive.
Each Llm entity represents a single model on a specific platform (Ollama, OpenAI, Anthropic, etc.).
Tools delegate to platform-specific adapters that handle API differences.

Entities are configured with a platform, model name, and optional settings like temperature and API key.
Data is stored per-entity in the Hive's `.hive/Entities/<owner>/Llm/<EntityName>/` directory.


## Use Cases

- **AI agent backends** — Configure LLM entities that agents use for reasoning and generation.
- **Multi-model workflows** — Set up different entities for different tasks (e.g. a fast model for classification, a large model for generation).
- **Embedding pipelines** — Use embedding-capable entities to vectorize text for search or clustering.
- **Local and remote models** — Mix Ollama (local) and OpenAI/Anthropic (remote) entities in the same Hive.


## Supported Platforms

| Platform | Chat | Embedding | Notes |
|---|---|---|---|
| `ollama` | yes | yes | Local models. Default endpoint: `http://localhost:11434` |
| `openai` | yes | yes | Requires `ApiKey`. |
| `anthropic` | yes | no | Requires `ApiKey`. No embedding API available. |


## Entity Management

Entity tools are provided automatically by the framework for any entity-type plugin.

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update an LLM entity configuration. |
| `ListEntities()` | Lists all Llm entities in the current Hive. |
| `DeleteEntity( EntityName )` | Deletes an LLM entity and all of its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames an LLM entity, preserving all data. |

### ConfigEntity

Read, create, or update an LLM entity configuration.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The entity name. |
| `Settings` | object | no | Configuration settings to merge into the entity. |

**Settings Fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `Description` | string | `''` | Human-readable description. |
| `Platform` | string | `''` | Platform adapter: `'ollama'`, `'openai'`, `'anthropic'`. |
| `ModelName` | string | `''` | Model identifier (e.g. `'llama3'`, `'gpt-4o'`, `'claude-sonnet-4-6'`). |
| `ModelTemperature` | number | `0` | Sampling temperature. |
| `ContextSize` | number | `8192` | Maximum context size in tokens. Used to validate prompt length. |
| `CanEmbed` | boolean | `false` | Whether this entity supports the `EmbedText` tool. |
| `ApiKey` | string | `''` | API key for remote platforms. |
| `PlatformSettings` | object | `{}` | Platform-specific overrides (e.g. `{ ChatUrl: '...' }`). |

**Returns:** `object` — The full entity configuration after merging.

**Usage:**
```js
// Create an Ollama entity
await hive.InvokeTool( 'Llm.ConfigEntity', {
    EntityName: 'local-llama',
    Settings: {
        Description: 'Local Llama 3 via Ollama',
        Platform: 'ollama',
        ModelName: 'llama3',
        ModelTemperature: 0.7,
        ContextSize: 8192,
    },
} );

// Create an Anthropic entity
await hive.InvokeTool( 'Llm.ConfigEntity', {
    EntityName: 'claude',
    Settings: {
        Description: 'Claude Sonnet via Anthropic API',
        Platform: 'anthropic',
        ModelName: 'claude-sonnet-4-6',
        ApiKey: 'sk-ant-...',
        ContextSize: 200000,
    },
} );

// Create an Ollama embedding entity
await hive.InvokeTool( 'Llm.ConfigEntity', {
    EntityName: 'local-embedder',
    Settings: {
        Description: 'Nomic Embed via Ollama',
        Platform: 'ollama',
        ModelName: 'nomic-embed-text',
        CanEmbed: true,
    },
} );
```


## LLM Tools

| Signature | Description |
|---|---|
| `SubmitPrompt( EntityName, Prompt )` | Submit a prompt to an LLM and receive its response. |
| `EmbedText( EntityName, Text )` | Embed text using an LLM and return the embedding vector. |

### SubmitPrompt

Submits a prompt verbatim to the configured LLM and returns the response.
Validates prompt length against `ContextSize` before sending.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Llm entity. |
| `Prompt` | string | yes | The prompt text to send. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Response` | string | The LLM response text. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Llm.SubmitPrompt', {
    EntityName: 'local-llama',
    Prompt: 'What is the capital of France?',
} );
// result.Result = { Response: 'The capital of France is Paris.' }
```

### EmbedText

Embeds text using an LLM entity that supports embeddings.
Returns an error if the entity has `CanEmbed: false` or the platform lacks embedding support.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the Llm entity. |
| `Text` | string | yes | The text to embed. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Vector` | array | The embedding vector (array of numbers). |
| `Error` | string | Error message on failure. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Llm.EmbedText', {
    EntityName: 'local-embedder',
    Text: 'The quick brown fox jumps over the lazy dog.',
} );
// result.Result = { Vector: [ 0.123, -0.456, 0.789, ... ] }
```


## Platform Settings Overrides

Each platform has default URLs. Use `PlatformSettings` in entity config to override them.

### Ollama

| Setting | Default | Description |
|---|---|---|
| `ChatUrl` | `http://localhost:11434/api/chat` | Chat completions endpoint. |
| `EmbedUrl` | `http://localhost:11434/api/embed` | Embeddings endpoint. |

### OpenAI

| Setting | Default | Description |
|---|---|---|
| `ChatUrl` | `https://api.openai.com/v1/chat/completions` | Chat completions endpoint. |
| `EmbedUrl` | `https://api.openai.com/v1/embeddings` | Embeddings endpoint. |

### Anthropic

| Setting | Default | Description |
|---|---|---|
| `ChatUrl` | `https://api.anthropic.com/v1/messages` | Messages endpoint. |
| `ApiVersion` | `2023-06-01` | Anthropic API version header. |
| `MaxTokens` | `4096` | Maximum tokens in the response. |


## Data Storage

Each Llm entity stores its configuration at:

```
.hive/Entities/<owner>/Llm/<EntityName>/<EntityName>.entity.json    # Entity configuration
```
