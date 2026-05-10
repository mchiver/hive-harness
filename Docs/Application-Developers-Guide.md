# Application Developer Guide


## Overview

Applications use HiveJS as its backend to provide essential services to the applciation.
This includes AI agent runners, CLI tools, web servers, or TUI applications.

The application is responsible for:
- Opening a Registry and Hive.
- Authenticating users.
- Invoking tools on behalf of the user or an AI agent.
- Presenting tool schemas to AI models for tool-use integration.


## Concepts

**Registry** - The global configuration layer.
Contains plugin definitions, user accounts, and registry-level settings.
A Registry is opened from a filesystem path (e.g. `~/.hives`).

**Hive** - A per-folder workspace.
Opened against a Registry with user credentials.
Provides authenticated access to plugins and tools, with data isolated to the folder's `.hive/` directory.

**Tool Invocation** - Tools are called by name using `<PluginName>.<ToolName>` notation.
Each call returns a result envelope with `Success`, `Error`, and `Result` fields.


## Getting Started

### Installation

```
npm install
```

The only external dependency is `jsonwebtoken` (for auth tokens) and `bcrypt` (for password hashing).


### Opening a Registry

```js
const Registry = require( './Source/Registry.js' );

var registry = await Registry.Open( '/path/to/registry' );
```

`Registry.Open()` reads the registry config and returns a ready-to-use Registry instance.
The constructor (`new Registry(path)`) only sets up properties; `Open()` performs async initialization.


### Opening a Hive

```js
const Hive = require( './Source/Hive.js' );

var hive = await Hive.Open( registry, '/path/to/project', 'username', 'password' );
```

`Hive.Open()` authenticates the user, loads plugins, and ensures the `.hive/` data directory exists.
After opening, the Hive is ready for tool invocation.

**Hive Properties:**

| Property | Type | Description |
|---|---|---|
| `HiveRoot` | string | The folder this Hive operates on. |
| `DataPath` | string | Path to `.hive/` within the folder. |
| `UserName` | string | Authenticated username. |
| `UserRole` | string | User's role (e.g. `'admin'`, `'user'`, `'guest'`). |
| `Token` | string | JWT token for the session. |
| `Plugins` | object | Map of plugin name to Plugin object. |
| `SanitizedUserName` | string | Filesystem-safe form of `UserName`, used to scope per-user entity folders. |
| `Helpers` | object | Shared utilities (`FileUtils`, `Logger`, `EventBus`, `Fetch`, `Humanize`, `Strings`, `CommandProcessor`). |

`HiveRoot`, `DataPath`, `Plugins`, `Helpers`, `Registry`, and `Events` are
exposed as getters that delegate to the underlying `HiveRuntime` — reading
them works as shown above, but assigning to them has no effect. The
runtime is shared across every `Hive.ForUser()` wrapper built from it.


### Invoking Tools

```js
var result = await hive.InvokeTool( 'KeyStore.SetKey', {
    EntityName: 'my-store',
    Key: 'color',
    Value: 'blue',
} );
```

Tool names follow the format `<PluginName>.<ToolName>`.

**Result Envelope:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` if the tool executed without throwing. |
| `Error` | string or null | Error message if the tool threw an exception. |
| `Result` | any | The value returned by the tool's `Execute` function. |

`InvokeTool` catches exceptions from tools and returns them in the `Error` field.
Invalid plugin or tool names throw directly (not caught in the envelope).

Tools may be sync or async. `InvokeTool` awaits the result in either case.


## Authentication

### Password Authentication

Users are defined as JSON files in `<RegistryPath>/Users/<username>.json`:

```json
{
    "Name": "Alice",
    "Description": "Project lead",
    "Role": "admin",
    "PasswordHash": "$2b$10$..."
}
```

Passwords are verified using bcrypt. The hash is generated with a cost factor of 10.

### Token Authentication

After password authentication, the returned `Token` (JWT) can be used for subsequent sessions:

```js
// First login with password
var login = await registry.Authenticate( 'alice', 'her-password' );

// Later, reuse the token
var hive = await Hive.Open( registry, folder_path, 'alice', login.Token );
```

Tokens expire after 24 hours.


## Discovering Tools

Plugins and their tools are available on the Hive after opening.
This is useful for presenting available tools to an AI model:

```js
var hive = await Hive.Open( registry, folder_path, 'username', 'password' );

for ( var plugin_name in hive.Plugins )
{
    var plugin = hive.Plugins[ plugin_name ];
    console.log( 'Plugin:', plugin.PluginName, '-', plugin.Description );

    for ( var tool_name in plugin.Tools )
    {
        var tool = plugin.Tools[ tool_name ];
        console.log( '  Tool:', tool.ToolName, '-', tool.Description );
        console.log( '    Parameters:', JSON.stringify( tool.Parameters ) );
        console.log( '    Returns:', JSON.stringify( tool.Returns ) );
    }
}
```

Tool `Parameters` and `Returns` use JSON Schema, which maps directly to the tool-use schema format used by AI models like Claude.


## Registry Structure

```
<RegistryPath>/
    registry.config.json                     # Registry-level settings
    Users/
        <username>.json                      # User accounts
    Plugins/
        <PluginName>/
            <PluginName>.factory.js          # Plugin source (or plugin.link.json)
            Tools/
                <ToolName>/
                    <ToolName>.js
```


## Hive Data Structure

Each folder that opens a Hive gets a `.hive/` directory:

```
<HiveRoot>/
    .hive/
        Plugins/
            <PluginName>/
                <PluginName>.plugin.json     # Per-hive plugin config
        Entities/
            .shared/
                <PluginName>/
                    <EntityName>/
                        <EntityName>.entity.json   # Entity configuration
                        <EntityName>.data.json     # Entity data (plugin-managed)
            <sanitized-username>/
                <PluginName>/
                    <EntityName>/
                        <EntityName>.entity.json
                        <EntityName>.data.json
```

Two layers of isolation:

- **Per-folder.** Two folders that open against the same Registry share
  plugin definitions and user accounts but keep completely separate
  `.hive/` data.
- **Per-user.** Within a Hive, entities default to the calling user's
  namespace under `Entities/<sanitized-username>/`. Entities in
  `Entities/.shared/` are visible to every user of that Hive (used for
  shared infrastructure or explicitly shared entities).

`Hive.FindEntity( PluginName, EntityName )` resolves an entity by
checking the user's namespace first and falling back to `.shared/`,
which is what most plugin tools rely on for read access.


## Helpers

The Hive exposes shared utilities through `hive.Helpers`.
These are also available to plugins during tool execution.

### FileUtils

All methods are async. Commonly used operations:

| Method | Description |
|---|---|
| `ReadFile( path )` | Read a file as UTF-8 string. |
| `ReadJson( path )` | Read and parse a JSON file. |
| `WriteFile( path, content )` | Write a UTF-8 string to a file. |
| `WriteJson( path, data )` | Serialize and write JSON to a file. |
| `FileExists( path )` | Check if a file exists. |
| `FolderExists( path )` | Check if a folder exists. |
| `EnsureFolder( path )` | Create a folder if it doesn't exist. |
| `Find( path, glob, recurse )` | Find entries matching a glob pattern. |
| `FindFiles( path, glob, recurse )` | Find files matching a glob pattern. |
| `FindFolders( path, glob, recurse )` | Find folders matching a glob pattern. |
| `DeleteFile( path )` | Delete a file. |
| `DeleteFolder( path, force )` | Delete a folder (optionally non-empty). |

### Logger

Create a logger instance for structured console output:

```js
var Logger = hive.Helpers.Logger;
var log = Logger.CreateLogger( { Silent: false, MaxLength: 200 } );

log.Info( 'Hive opened successfully' );
log.Warn( 'Missing configuration' );
log.Error( 'Something went wrong' );
```

Severity levels: `Trace`, `Debug`, `Info`, `Warn`, `Error`.


## Multi-User Pattern (Web Servers, Long-Running Hosts)

`Hive.Open()` is convenient for CLIs and single-user processes, but it
re-loads the Registry and re-runs plugin discovery on every call. For
servers that handle many users against the same folder, use the
`HiveRuntime` + per-user wrapper pattern instead.

```js
const Registry = require( './Source/Registry.js' );
const HiveModule = require( './Source/Hive.js' );
const HiveRuntime = HiveModule.HiveRuntime;

// One-time setup at server startup.
var registry = await Registry.Open( '/home/user/.hives' );
var runtime  = await HiveRuntime.OpenRuntime( registry, process.cwd() );

// Per request: authenticate and produce a user-scoped Hive wrapper.
async function handle( username, password )
{
    var user = await registry.Authenticate( username, password );
    var hive = HiveModule.ForUser( runtime, {
        UserName: user.Username || username,
        UserRole: user.Role || 'user',
        Token: '',
    } );
    // hive behaves like a Hive.Open() result, but shares the underlying
    // Runtime (loaded plugins, .hive/ filesystem) with every other request.
    return await hive.InvokeTool( 'KeyStore.ListKeys', { EntityName: 'app-state' } );
}
```

**Why this matters:**

- The `HiveRuntime` is loaded once. Plugin discovery, tool registration,
  and `.hive/` setup are not repeated per request.
- `HiveModule.ForUser()` is cheap. It returns a thin wrapper that carries
  the user's identity into every tool invocation, so plugins can scope
  per-user entity namespaces (under `<sanitized-username>/`).
- Per-user data isolation comes from the Hive layer; the application
  doesn't have to enforce it in tool calls.

A typical Express middleware:

```js
app.use( '/api', async function ( req, res, next )
{
    try
    {
        var user = await registry.Authenticate( req.username, req.password );
        req.User = { UserName: user.Username || req.username, UserRole: user.Role || 'user' };
        req.Hive = HiveModule.ForUser( runtime, { ...req.User, Token: '' } );
        next();
    }
    catch ( e ) { res.status( 401 ).send( 'unauthorized' ); }
} );
```


## Complete Example

A minimal application that opens a Hive and runs a tool:

```js
const Registry = require( './Source/Registry.js' );
const Hive = require( './Source/Hive.js' );

async function main()
{
    var registry = await Registry.Open( '/home/user/.hives' );
    var hive = await Hive.Open( registry, process.cwd(), 'admin', 'password' );

    // Create a store entity
    var result = await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'app-state' } );
    console.log( 'Created store:', result.Result.Name );

    // Set a value
    await hive.InvokeTool( 'KeyStore.SetKey', {
        EntityName: 'app-state',
        Key: 'version',
        Value: '1.0.0',
    } );

    // Read it back
    var get_result = await hive.InvokeTool( 'KeyStore.GetKey', {
        EntityName: 'app-state',
        Key: 'version',
    } );
    console.log( 'Version:', get_result.Result.Value );
}

main().catch( console.error );
```
