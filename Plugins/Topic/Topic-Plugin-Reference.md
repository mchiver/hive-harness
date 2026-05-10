# Topic Plugin Reference


## Summary

The Topic plugin provides a searchable knowledgebase (RAG) within a Hive.
Each Topic entity is backed by a SQLite database that stores text chunks alongside their embedding vectors.
Text is split into overlapping chunks, embedded via a configured Llm entity, and stored for later similarity search.

Data is stored per-entity in the Hive's `.hive/Entities/<owner>/Topic/<EntityName>/` directory.


## Use Cases

- **Knowledge retrieval** — Embed documents and search them by natural language queries.
- **Source management** — Track which documents have been embedded, reconstruct originals, or remove them.
- **Multi-topic organization** — Create separate Topic entities for different knowledge domains.


## Entity Management

Entity tools are provided automatically by the framework for any entity-type plugin.

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a Topic entity configuration. |
| `ListEntities()` | Lists all Topic entities in the current Hive. |
| `DeleteEntity( EntityName )` | Deletes a Topic entity and all of its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a Topic entity, preserving all data. |

### ConfigEntity

Read, create, or update a Topic entity configuration.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The entity name. |
| `Settings` | object | no | Configuration settings to merge into the entity. |

**Settings Fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `Description` | string | `''` | Human-readable description. |
| `EmbeddingLlm` | string | `''` | Name of the Llm entity to use for generating embeddings. Must have `CanEmbed: true`. |
| `SplitChunkSize` | number | `512` | Number of characters per text chunk. |
| `SplitChunkOverlap` | number | `50` | Number of overlapping characters between consecutive chunks. |

**Returns:** `object` — The full entity configuration after merging.

**Usage:**
```js
// Create a Topic entity using a local Ollama embedding model
await hive.InvokeTool( 'Topic.ConfigEntity', {
    EntityName: 'project-docs',
    Settings: {
        Description: 'Project documentation knowledgebase',
        EmbeddingLlm: 'local-embedder',
        SplitChunkSize: 512,
        SplitChunkOverlap: 50,
    },
} );
```


## Topic Tools

| Signature | Description |
|---|---|
| `EmbedText( TopicName, SourceName, Text )` | Embed text into a topic. |
| `Search( TopicName, Text, [SourceName], [MinScore], [MaxResults] )` | Search a topic by similarity. |
| `ListSources( TopicName )` | List all sources in a topic. |
| `GetSource( TopicName, SourceName )` | Reconstruct a source document. |
| `RemoveSource( TopicName, SourceName )` | Remove all entries for a source. |
| `RemoveAll( TopicName )` | Remove all sources and reset the topic. |

### EmbedText

Splits the input text into chunks (based on `SplitChunkSize` and `SplitChunkOverlap`),
generates an embedding for each chunk via the configured Llm entity, and stores
the chunks with their vectors in the topic database.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |
| `SourceName` | string | yes | Application-defined source name (e.g. filename, URL). |
| `Text` | string | yes | The text to embed. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `ChunksStored` | number | Number of chunks embedded and stored. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Topic.EmbedText', {
    TopicName: 'project-docs',
    SourceName: 'readme.md',
    Text: '... contents of readme.md ...',
} );
// result.Result = { ChunksStored: 5 }
```

### Search

Embeds the query text, then computes cosine similarity against all stored embeddings.
Returns results ranked by similarity score.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |
| `Text` | string | yes | The text to search for. |
| `SourceName` | string | no | Source name filter. Supports `*` and `?` glob patterns. Empty for all sources. |
| `MinScore` | number | no | Minimum similarity score. Default `0.3`. |
| `MaxResults` | number | no | Maximum number of results. `0` or omitted returns all matches. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Results` | array | Array of `{ EmbeddingID, SourceName, ChunkText, Score }`. |
| `Count` | number | Number of results returned. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Topic.Search', {
    TopicName: 'project-docs',
    Text: 'How do I configure logging?',
    MinScore: 0.4,
    MaxResults: 5,
} );
// result.Result = { Results: [ { EmbeddingID: '...', SourceName: 'readme.md', ChunkText: '...', Score: 0.82 }, ... ], Count: 3 }
```

### ListSources

Lists all distinct sources that have been embedded into the topic.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Sources` | array | Array of `{ SourceName, ChunkCount }`. |
| `Count` | number | Number of sources. |
| `Error` | string | Error message on failure. |

### GetSource

Reconstructs the original document by concatenating chunks in chronological order,
removing overlap between consecutive chunks.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |
| `SourceName` | string | yes | Name of the source to retrieve. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `SourceName` | string | The source name. |
| `Text` | string | The reconstructed source text. |
| `ChunkCount` | number | Number of chunks used. |
| `Error` | string | Error message on failure. |

### RemoveSource

Removes all embedding entries for a specific source.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |
| `SourceName` | string | yes | Name of the source to remove. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RowsRemoved` | number | Number of embedding rows removed. |
| `Error` | string | Error message on failure. |

### RemoveAll

Removes all sources and embeddings from the topic, resetting it to empty.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `TopicName` | string | yes | Name of the Topic entity. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RowsRemoved` | number | Number of embedding rows removed. |
| `Error` | string | Error message on failure. |


## Embeddings Storage Schema

Each row in the SQLite `Embeddings` table:

| Column | Type | Description |
|---|---|---|
| `EmbeddingID` | TEXT (PK) | UUID identifying this chunk. |
| `SourceName` | TEXT | Application-defined source name. |
| `EmbeddedAt` | TEXT | ISO 8601 timestamp of when the chunk was embedded. |
| `ChunkText` | TEXT | The original text of this chunk. |
| `Embeddings` | TEXT | JSON-encoded embedding vector. |


## Data Storage

Each Topic entity stores its data at:

```
.hive/Entities/<owner>/Topic/<EntityName>/<EntityName>.entity.json    # Entity configuration
.hive/Entities/<owner>/Topic/<EntityName>/<EntityName>.db              # SQLite database with embeddings
```
