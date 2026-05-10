# SqlStore Plugin Reference


## Summary

The SqlStore plugin provides SQLite database storage within a Hive.
Each SqlStore is an entity instance — you can create multiple named databases to organize data by purpose.
Uses `better-sqlite3` under the hood, with a reusable `Helpers/SqlStore.js` class available project-wide.

A single connection is opened and closed for each tool call.
Database files are stored at `.hive/Entities/<owner>/SqlStore/<EntityName>/<EntityName>.db`.


## Use Cases

- **Structured data** — Store relational data with tables, columns, and constraints.
- **Agent knowledge** — Queryable storage for facts, embeddings, or structured context.
- **Log aggregation** — Append-only tables for events, audit trails, or time-series data.
- **Task and workflow state** — Tables tracking progress, assignments, or pipeline stages.
- **Analytics** — Aggregate and query data with SQL.


## Entity Management

Entity tools are provided automatically by the framework for any entity-type plugin.

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a database entity's configuration. |
| `ListEntities()` | Lists all SqlStore instances in the current Hive. |
| `DeleteEntity( EntityName )` | Deletes a database entity and all of its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a database entity, preserving all data. |

### ConfigEntity

Read, create, or update a database entity's configuration.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The database entity name. |
| `Settings` | object | no | Configuration settings to merge (see Entity Settings below). |

**Returns:** `object` — The full entity configuration after merging.

**Usage:**
```js
// Create a new database entity
await hive.InvokeTool( 'SqlStore.ConfigEntity', { EntityName: 'my-db' } );

// Update entity settings
await hive.InvokeTool( 'SqlStore.ConfigEntity', {
    EntityName: 'my-db',
    Settings: { Description: 'Main application database', JournalMode: 'wal' },
} );
```

### Entity Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `Name` | string | (required) | Entity name. |
| `Description` | string | `''` | Human-readable description. |
| `JournalMode` | string | `'wal'` | SQLite journal mode (`wal`, `delete`, `truncate`, `memory`, `off`). |
| `ForeignKeys` | boolean | `true` | Enable or disable foreign key enforcement. |
| `CacheSize` | number | `-2000` | SQLite cache size (negative = KiB, positive = pages). |
| `BusyTimeout` | number | `5000` | Milliseconds to wait when the database is locked. |

### ListEntities

Lists all SqlStore instances in the current Hive.

**Parameters:** None.

**Returns:** `array` of `{ Name, Description }`.

### DeleteEntity

Deletes a database entity and all of its data.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The entity name to delete. |

**Returns:** No return value.

### RenameEntity

Renames a database entity. All data is preserved under the new name.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | The current entity name. |
| `NewEntityName` | string | yes | The new entity name. |

**Returns:** No return value.


## Table Tools

These tools manage tables within a SqlStore database.

| Signature | Description |
|---|---|
| `ListTables( EntityName )` | Lists all user tables in the database. |
| `CreateTable( EntityName, TableName, TableSchema )` | Creates a table from a schema. |
| `DeleteTable( EntityName, TableName )` | Drops a table from the database. |
| `GetTableSchema( EntityName, TableName )` | Returns the column schema for a table. |

### ListTables

Lists all user tables in the database (excludes internal `sqlite_*` tables).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Tables` | array | Array of table name strings. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
var result = await hive.InvokeTool( 'SqlStore.ListTables', { EntityName: 'my-db' } );
// result.Result = { Tables: [ 'users', 'logs' ] }
```

### CreateTable

Creates a table. `TableSchema` accepts either a raw SQL string or a JSON schema object.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |
| `TableName` | string | yes | Name of the table to create. |
| `TableSchema` | string or object | yes | Column definitions (see below). |

**TableSchema as string (raw SQL):**
```js
'id INTEGER PRIMARY KEY, name TEXT NOT NULL, score REAL DEFAULT 0.0'
```

**TableSchema as object (JSON schema):**
```js
{
    Columns: [
        { Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
        { Name: 'name', Type: 'TEXT', NotNull: true },
        { Name: 'score', Type: 'REAL', Default: '0.0' },
    ]
}
```

**Column properties:**

| Property | Type | Description |
|---|---|---|
| `Name` | string | Column name. |
| `Type` | string | SQLite type (`TEXT`, `INTEGER`, `REAL`, `BLOB`, `NUMERIC`). Defaults to `TEXT`. |
| `PrimaryKey` | boolean | Mark as primary key. |
| `AutoIncrement` | boolean | Enable autoincrement (requires `PrimaryKey`). |
| `NotNull` | boolean | Add NOT NULL constraint. |
| `Default` | string | Default value expression (e.g. `'0.0'`, `'CURRENT_TIMESTAMP'`). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
await hive.InvokeTool( 'SqlStore.CreateTable', {
    EntityName: 'my-db',
    TableName: 'users',
    TableSchema: {
        Columns: [
            { Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
            { Name: 'name', Type: 'TEXT', NotNull: true },
            { Name: 'email', Type: 'TEXT' },
        ],
    },
} );
```

### DeleteTable

Drops a table from the database.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |
| `TableName` | string | yes | Name of the table to delete. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |
| `Error` | string | Error message on failure. |

### GetTableSchema

Returns the column schema for a table. The returned format is identical to the JSON schema accepted by `CreateTable`, enabling round-trip table duplication.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |
| `TableName` | string | yes | Name of the table. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Columns` | array | Array of column definitions (see Column properties above). |
| `Error` | string | Error message on failure (e.g. table not found). |

**Usage:**
```js
var result = await hive.InvokeTool( 'SqlStore.GetTableSchema', {
    EntityName: 'my-db',
    TableName: 'users',
} );
// result.Result = { Columns: [ { Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true }, ... ] }

// Round-trip: use output to create a copy
await hive.InvokeTool( 'SqlStore.CreateTable', {
    EntityName: 'my-db',
    TableName: 'users_backup',
    TableSchema: result.Result,
} );
```


## Query Tools

These tools execute SQL against a SqlStore database.

| Signature | Description |
|---|---|
| `QuerySql( EntityName, Sql, [Values], [Options] )` | Executes a query and returns rows. |
| `ExecuteSql( EntityName, Sql, [Values], [Options] )` | Executes a statement and returns status. |

### QuerySql

Executes a SQL query that returns rows (SELECT, etc.).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |
| `Sql` | string | yes | SQL query to execute. |
| `Values` | array or object | no | Bound parameter values. Use `?` placeholders with arrays, or `:name`/`$name`/`@name` with objects. |
| `Options` | object | no | Query options (see below). |

**Options:**

| Option | Type | Description |
|---|---|---|
| `Limit` | number | Maximum number of rows to return. |
| `Offset` | number | Number of rows to skip. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Rows` | array | Array of row objects. |
| `Count` | number | Number of rows returned. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
// Simple query
var result = await hive.InvokeTool( 'SqlStore.QuerySql', {
    EntityName: 'my-db',
    Sql: 'SELECT * FROM users',
} );

// With parameters and paging
var result = await hive.InvokeTool( 'SqlStore.QuerySql', {
    EntityName: 'my-db',
    Sql: 'SELECT * FROM users WHERE score > ?',
    Values: [ 50 ],
    Options: { Limit: 10, Offset: 0 },
} );
```

### ExecuteSql

Executes a SQL statement that modifies data (INSERT, UPDATE, DELETE, CREATE INDEX, etc.).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Name of the SqlStore entity. |
| `Sql` | string | yes | SQL statement to execute. |
| `Values` | array or object | no | Bound parameter values. |
| `Options` | object | no | Reserved for future use. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RowsAffected` | number | Number of rows affected by the statement. |
| `LastInsertId` | number | Row ID of the last inserted row. |
| `Error` | string | Error message on failure. |

**Usage:**
```js
// Insert
var result = await hive.InvokeTool( 'SqlStore.ExecuteSql', {
    EntityName: 'my-db',
    Sql: 'INSERT INTO users ( name, email ) VALUES ( ?, ? )',
    Values: [ 'Alice', 'alice@example.com' ],
} );
// result.Result = { RowsAffected: 1, LastInsertId: 1 }

// Create an index
await hive.InvokeTool( 'SqlStore.ExecuteSql', {
    EntityName: 'my-db',
    Sql: 'CREATE INDEX idx_users_email ON users ( email )',
} );
```


## Data Storage

Each SqlStore entity stores its database at:

```
.hive/Entities/<owner>/SqlStore/<EntityName>/<EntityName>.entity.json    # Entity configuration
.hive/Entities/<owner>/SqlStore/<EntityName>/<EntityName>.db             # SQLite database file
```
