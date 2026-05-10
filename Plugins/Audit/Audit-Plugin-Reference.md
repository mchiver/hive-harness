# Audit Plugin Reference


## Summary

The Audit plugin provides append-only timestamped event logging for the hive.
Events are stored in daily `.jsonl` files under `.hive/Plugins/Audit/`. This is a global (non-entity)
plugin — all events share a single log per hive.

Event types are application-defined strings. When querying, event types can be filtered
using glob patterns (`*` matches any characters, `?` matches a single character, case-insensitive).


## Use Cases

- **Activity tracking** — Log tool calls, user actions, or agent decisions.
- **Error monitoring** — Record errors with structured data for later review.
- **Audit trails** — Maintain a tamper-evident record of operations.
- **Diagnostics** — Query recent events to understand what happened and when.


## Data Storage

Events are stored in daily files at:

```
.hive/Plugins/Audit/audit-YYYY-MM-DD.jsonl
```

Each line is a JSON object:

```json
{"Time":"2026-04-05T14:30:00.000Z","EventType":"Tool Call","EventData":{"ToolName":"Workspace.ReadFile"}}
```


## Tools

| Signature | Description |
|---|---|
| `Append( EventType, [EventData] )` | Appends a timestamped event to the audit log. |
| `Get( [EventType], [MaxEntries] )` | Retrieves entries newest-first. |
| `GetAgo( Duration, [EventType], [MaxEntries] )` | Retrieves entries from a duration ago, oldest-first. |
| `GetSince( Time, [EventType], [MaxEntries] )` | Retrieves entries since a timestamp, oldest-first. |

### Append

Appends a timestamped event to today's audit log file.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EventType` | string | yes | The event type (e.g. `"Tool Call"`, `"Error"`, `"User Login"`). |
| `EventData` | any | no | Application-defined event data (any JSON-serializable value). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Time` | string (ISO 8601) | The timestamp assigned to the entry. |

**Usage:**
```js
await hive.InvokeTool( 'Audit.Append', {
    EventType: 'Tool Call',
    EventData: { ToolName: 'Workspace.ReadFile', Path: 'config.json' },
} );
```

### Get

Retrieves audit entries, newest-first. Returns all entries if no filters are specified.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EventType` | string | no | Glob pattern to filter event types. Empty or omitted returns all types. |
| `MaxEntries` | number | no | Maximum entries to return. `0` or omitted returns all. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Entries` | array | Array of `{ Time, EventType, EventData }`, newest-first. |

**Usage:**
```js
// Get the 10 most recent events
var result = await hive.InvokeTool( 'Audit.Get', { MaxEntries: 10 } );

// Get all errors
var result = await hive.InvokeTool( 'Audit.Get', { EventType: 'Error' } );

// Get all tool-related events
var result = await hive.InvokeTool( 'Audit.Get', { EventType: 'Tool*' } );
```

### GetAgo

Retrieves audit entries from a duration ago until now, oldest-first (chronological).
Uses human-friendly duration strings via `Hive.Helpers.Humanize`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Duration` | string | yes | Human-friendly duration (e.g. `"30m"`, `"2h"`, `"7d"`, `"1h30m"`). |
| `EventType` | string | no | Glob pattern to filter event types. |
| `MaxEntries` | number | no | Maximum entries to return. |

**Supported duration units:** `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks), `y` (years).

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Entries` | array | Array of `{ Time, EventType, EventData }`, oldest-first. |

**Usage:**
```js
// Events from the last 30 minutes
var result = await hive.InvokeTool( 'Audit.GetAgo', { Duration: '30m' } );

// Errors from the last 7 days, max 50
var result = await hive.InvokeTool( 'Audit.GetAgo', {
    Duration: '7d',
    EventType: 'Error',
    MaxEntries: 50,
} );
```

### GetSince

Retrieves audit entries since a specific timestamp, oldest-first (chronological).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Time` | string (ISO 8601) | yes | Timestamp to start from. |
| `EventType` | string | no | Glob pattern to filter event types. |
| `MaxEntries` | number | no | Maximum entries to return. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Entries` | array | Array of `{ Time, EventType, EventData }`, oldest-first. |

**Usage:**
```js
// Everything since a known point in time
var result = await hive.InvokeTool( 'Audit.GetSince', {
    Time: '2026-04-05T12:00:00.000Z',
} );

// Tool calls since a timestamp, max 20
var result = await hive.InvokeTool( 'Audit.GetSince', {
    Time: '2026-04-05T00:00:00.000Z',
    EventType: 'Tool*',
    MaxEntries: 20,
} );
```
