# System Plugin Reference


## Summary

The System plugin provides introspection tools for the hive. It exposes information about the hive
itself, the loaded plugins, and the available tools. This plugin is not an entity-type plugin.


## Use Cases

- **Discovery** — Enumerate available plugins and tools at runtime.
- **Self-description** — AI agents can inspect tool schemas to understand what operations are available.
- **Diagnostics** — Verify the hive is configured correctly with the expected plugins and user session.


## Tools

| Signature | Description |
|---|---|
| `Info()` | Returns basic information about the hive. |
| `ListPlugins()` | Returns a list of loaded plugins. |
| `ListTools( [PluginName] )` | Returns a list of available tools. |
| `GetPluginDocumentation( PluginName )` | Returns the reference documentation for a plugin. |
| `RunTools( ToolCalls )` | Executes multiple tool calls sequentially and returns an array of results. |

### Info

Returns basic information about the hive, including the workspace root, authenticated user, and version.

**Parameters:** None.

**Returns:**

| Field | Type | Description |
|---|---|---|
| `HiveRoot` | string | The workspace root path. |
| `UserName` | string | The authenticated user. |
| `UserRole` | string | The user's role. |
| `Version` | string | HiveJS version (from `package.json`). |

**Usage:**
```js
var result = await hive.InvokeTool( 'System.Info', {} );
// result.Result = { HiveRoot: '/path/to/project', UserName: 'alice', UserRole: 'admin', Version: '0.0.1' }
```

### ListPlugins

Returns a list of all loaded plugins with their descriptions and tool counts.

**Parameters:** None.

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Plugins` | array | Array of plugin entries. |
| `Plugins[].PluginName` | string | The plugin name. |
| `Plugins[].Description` | string | The plugin description. |
| `Plugins[].RequiredRole` | string | Minimum role required to use the plugin. |
| `Plugins[].ToolCount` | number | Number of tools in the plugin. |

**Usage:**
```js
var result = await hive.InvokeTool( 'System.ListPlugins', {} );
// result.Result = { Plugins: [
//     { PluginName: 'System', Description: '...', RequiredRole: 'user', ToolCount: 3 },
//     { PluginName: 'Workspace', Description: '...', RequiredRole: 'user', ToolCount: 17 },
//     ...
// ] }
```

### ListTools

Returns a list of available tools with their full parameter and return schemas.
Optionally filtered to a single plugin.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `PluginName` | string | no | Filter to tools from this plugin only. Returns empty array if the plugin does not exist. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Tools` | array | Array of tool entries. |
| `Tools[].PluginName` | string | The plugin name. |
| `Tools[].ToolName` | string | The tool name. |
| `Tools[].Description` | string | The tool description. |
| `Tools[].Parameters` | object | Parameter JSON Schema. |
| `Tools[].Returns` | object | Return value JSON Schema. |

**Usage:**
```js
// List all tools
var result = await hive.InvokeTool( 'System.ListTools', {} );

// List tools for a specific plugin
var result = await hive.InvokeTool( 'System.ListTools', { PluginName: 'Workspace' } );
// result.Result = { Tools: [
//     { PluginName: 'Workspace', ToolName: 'ReadFile', Description: '...', Parameters: {...}, Returns: {...} },
//     ...
// ] }
```

### GetPluginDocumentation

Returns the reference documentation markdown for a plugin. Each plugin maintains a
`<PluginName>-Plugin-Reference.md` file alongside its source code.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `PluginName` | string | yes | The plugin to get documentation for. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Content` | string | The reference documentation markdown. |

Throws an error if the plugin does not exist or has no reference documentation file.

**Usage:**
```js
var result = await hive.InvokeTool( 'System.GetPluginDocumentation', { PluginName: 'Workspace' } );
// result.Result = { Content: '# Workspace Plugin Reference\n\n...' }
```

### RunTools

Executes multiple tool calls sequentially and returns an array of results. Useful for batch
operations where multiple tools need to be invoked in a single request.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `ToolCalls` | array | yes | Array of tool call objects. |

Each element in `ToolCalls`:

| Field | Type | Required | Description |
|---|---|---|---|
| `PluginName` | string | yes | The plugin to invoke. |
| `ToolName` | string | yes | The tool to invoke. |
| `Arguments` | object | no | Arguments to pass to the tool (default `{}`). |
| `ExitOnError` | boolean | no | If true, stop processing and return immediately on error (default `false`). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Results` | array | Array of result objects, one per executed call. |

Each element in `Results`:

| Field | Type | Description |
|---|---|---|
| `PluginName` | string | The plugin that was called. |
| `ToolName` | string | The tool that was called. |
| `Success` | boolean | Whether the call succeeded. |
| `Error` | string/null | Error message if failed, null otherwise. |
| `Result` | any | The tool's return value if successful. |

When `ExitOnError` is true on a call that fails, processing stops and the `Results` array
contains only the calls that were executed (up to and including the failed one).

**Usage:**
```js
// Run multiple tools in sequence
var result = await hive.InvokeTool( 'System.RunTools', {
    ToolCalls: [
        { PluginName: 'System', ToolName: 'Info', Arguments: {} },
        { PluginName: 'Workspace', ToolName: 'ReadFile', Arguments: { Path: 'README.md' } },
    ]
} );
// result.Result = { Results: [
//     { PluginName: 'System', ToolName: 'Info', Success: true, Error: null, Result: { HiveRoot: '...', ... } },
//     { PluginName: 'Workspace', ToolName: 'ReadFile', Success: true, Error: null, Result: { Content: '...' } },
// ] }

// Stop on first error
var result = await hive.InvokeTool( 'System.RunTools', {
    ToolCalls: [
        { PluginName: 'Workspace', ToolName: 'ReadFile', Arguments: { Path: 'missing.txt' }, ExitOnError: true },
        { PluginName: 'System', ToolName: 'Info', Arguments: {} },  // skipped if first fails
    ]
} );
```
