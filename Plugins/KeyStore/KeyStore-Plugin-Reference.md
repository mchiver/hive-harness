# KeyStore Plugin Reference


## Summary

The KeyStore plugin provides persistent key-value storage within a Hive.
Each KeyStore is an entity instance — you can create multiple named stores to organize data by purpose.
Values can be any JSON-serializable type (strings, numbers, booleans, objects, arrays).

Keys are flat strings. Values are stored with `CreatedAt` and `UpdatedAt` timestamps for tracking history.
Data is persisted as JSON files in the Hive's `.hive/Entities/<owner>/KeyStore/<EntityName>/` directory.


## Use Cases

- **Application state** — Persist settings, preferences, or runtime state across sessions.
- **Agent memory** — Store facts, decisions, or context that an AI agent needs to recall later.
- **Task tracking** — Use keys to represent work items, status flags, or progress markers.
- **Configuration management** — Store per-project configuration that varies between Hive folders.
- **Temporary scratch data** — Use glob-based clear to clean up keys matching a pattern (e.g. `temp_*`).


## Entity Management

Entity tools are provided automatically by the framework for any entity-type plugin.

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a store's configuration. |
| `ListEntities()` | Lists all KeyStore instances in the current Hive. |
| `DeleteEntity( EntityName )` | Deletes a store and all of its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a store, preserving all data. |

### ConfigEntity

Read, create, or update a store's entity configuration.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The store name. |
| `Settings` | object | no | Configuration settings to merge into the entity. |

**Returns:** `object` — The full entity configuration after merging.

**Usage:**
```js
// Create a new store
await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'my-store' } );

// Update store settings
await hive.InvokeTool( 'KeyStore.ConfigEntity', {
    EntityName: 'my-store',
    Settings: { Description: 'Application state store' },
} );
```

### ListEntities

Lists all KeyStore instances in the current Hive.

**Parameters:** None.

**Returns:** `array` of `{ Name, Description }`.

**Usage:**
```js
var result = await hive.InvokeTool( 'KeyStore.ListEntities', {} );
// result.Result = [ { Name: 'my-store', Description: '...' }, ... ]
```

### DeleteEntity

Deletes a store and all of its data.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The store name to delete. |

**Returns:** No return value.

**Usage:**
```js
await hive.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: 'old-store' } );
```

### RenameEntity

Renames a store. All data is preserved under the new name.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The current store name. |
| `NewEntityName` | string | yes | The new store name. |

**Returns:** No return value.

**Usage:**
```js
await hive.InvokeTool( 'KeyStore.RenameEntity', { EntityName: 'old-name', NewEntityName: 'new-name' } );
```


## Key-Value Tools

These tools operate on the key-value data within a store.
A store must have a `.data.json` file before these tools can be used.

| Signature | Description |
|---|---|
| `SetKey( EntityName, Key, Value )` | Associates a value with a key in a KeyStore instance. |
| `GetKey( EntityName, Key )` | Retrieves the value and timestamps for a key. |
| `DeleteKey( EntityName, Key )` | Removes a key from the store. |
| `ListKeys( EntityName, [Glob] )` | Lists keys, optionally filtered by a glob pattern. |
| `ClearKeys( EntityName, [Glob] )` | Removes keys, optionally filtered by a glob pattern. |

### SetKey

Sets a value in the store by key. Creates the key if it doesn't exist, updates it if it does.
When updating, `CreatedAt` is preserved and `UpdatedAt` is refreshed.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the store. |
| `Key` | string | yes | Key to set. |
| `Value` | any | yes | Value to store (any JSON-serializable type). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
await hive.InvokeTool( 'KeyStore.SetKey', {
    EntityName: 'my-store',
    Key: 'user_name',
    Value: 'Alice',
} );

// Values can be any JSON type
await hive.InvokeTool( 'KeyStore.SetKey', {
    EntityName: 'my-store',
    Key: 'preferences',
    Value: { theme: 'dark', language: 'en' },
} );
```

### GetKey

Retrieves a value from the store by key.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the store. |
| `Key` | string | yes | Key to retrieve. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Value` | any | The stored value. |
| `CreatedAt` | string (ISO 8601) | When the key was first created. |
| `UpdatedAt` | string (ISO 8601) | When the key was last updated. |
| `Error` | string | `'Key not found'` if the key does not exist. |

**Usage:**
```js
var result = await hive.InvokeTool( 'KeyStore.GetKey', {
    EntityName: 'my-store',
    Key: 'user_name',
} );
// result.Result = { Value: 'Alice', CreatedAt: '...', UpdatedAt: '...' }
```

### DeleteKey

Removes a key from the store.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the store. |
| `Key` | string | yes | Key to remove. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Error` | string | `'Key not found'` if the key does not exist. |

**Usage:**
```js
await hive.InvokeTool( 'KeyStore.DeleteKey', {
    EntityName: 'my-store',
    Key: 'obsolete_setting',
} );
```

### ListKeys

Lists keys in the store, optionally filtered by a glob pattern.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the store. |
| `Glob` | string | no | Glob pattern to filter keys (e.g. `"user_*"`). If omitted, all keys are returned. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Keys` | array | Array of key entries. |
| `Keys[].Key` | string | The key name. |
| `Keys[].CreatedAt` | string (ISO 8601) | When the key was first created. |
| `Keys[].UpdatedAt` | string (ISO 8601) | When the key was last updated. |
| `Error` | string | Error message on failure. |

**Glob patterns:** `*` matches any sequence of characters, `?` matches a single character. Matching is case-insensitive.

**Usage:**
```js
// List all keys
var result = await hive.InvokeTool( 'KeyStore.ListKeys', {
    EntityName: 'my-store',
} );

// List keys matching a pattern
var result = await hive.InvokeTool( 'KeyStore.ListKeys', {
    EntityName: 'my-store',
    Glob: 'user_*',
} );
// result.Result = { Keys: [ { Key: 'user_name', CreatedAt: '...', UpdatedAt: '...' }, ... ] }
```

### ClearKeys

Removes keys from the store. Clears all keys if no glob is provided, or only matching keys if a glob is given.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the store. |
| `Glob` | string | no | Glob pattern to select keys for removal (e.g. `"temp_*"`). If omitted, all keys are cleared. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Count` | number | Number of keys removed. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
// Clear temporary keys
var result = await hive.InvokeTool( 'KeyStore.ClearKeys', {
    EntityName: 'my-store',
    Glob: 'temp_*',
} );
// result.Result = { Success: true, Count: 3 }

// Clear all keys
await hive.InvokeTool( 'KeyStore.ClearKeys', { EntityName: 'my-store' } );
```


## Data Storage

Each KeyStore entity stores its data at:

```
.hive/Entities/<owner>/KeyStore/<EntityName>/<EntityName>.entity.json    # Entity configuration
.hive/Entities/<owner>/KeyStore/<EntityName>/<EntityName>.data.json      # Key-value data
```

The `.data.json` file structure:

```json
{
    "Values": {
        "some_key": {
            "Value": "the stored value",
            "CreatedAt": "2026-04-05T12:00:00.000Z",
            "UpdatedAt": "2026-04-05T14:30:00.000Z"
        }
    }
}
```
