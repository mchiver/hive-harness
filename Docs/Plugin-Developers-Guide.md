# Plugin Developer Guide


## Overview

A plugin is a named unit that provides tools and optionally manages entities.
Plugins are registered in a Registry and loaded into Hives at runtime.
Each plugin consists of a factory file and zero or more tool files.


## Concepts

**Plugin** - A container for metadata, configuration, and tools.
Defined by a factory file that sets properties on the Plugin object during initialization.

**Tool** - An executable function attached to a plugin.
Each tool declares its parameters and return value using JSON Schema, making it self-describing for AI consumers.

**Entity** - A managed data instance belonging to a plugin.
Plugins that declare an `EntitySchema` get automatic CRUD tools (ListEntities, ConfigEntity, DeleteEntity, RenameEntity, ShareEntity, UnshareEntity).
Entities are owned by the user who creates them and stored in a per-user subfolder, with an opt-in path to share them with other users.


## Directory Structure

Plugins live in the Registry's `Plugins/` folder:

```
<RegistryPath>/
    Plugins/
        <PluginName>/
            <PluginName>.factory.js      # Plugin factory (required)
            Tools/
                <ToolName>/
                    <ToolName>.js         # Tool definition
                <AnotherTool>/
                    <AnotherTool>.js
```

At runtime, each Hive stores plugin and entity data in its `.hive/` directory:

```
<HiveRoot>/
    .hive/
        Plugins/
            <PluginName>/
                <PluginName>.plugin.json                 # Plugin config (per-hive)
        Entities/
            .shared/
                <PluginName>/
                    <EntityName>/
                        <EntityName>.entity.json         # Entity config
                        <EntityName>.security.json       # Access control sidecar
                        <EntityName>.data.json           # Entity data (plugin-managed)
            <sanitized-username>/
                <PluginName>/
                    <EntityName>/
                        <EntityName>.entity.json
                        <EntityName>.security.json
                        <EntityName>.data.json
```

- Plugin-level config lives under `.hive/Plugins/<PluginName>/`.
- Entities live either in `.hive/Entities/.shared/` (visible to all users, subject to access rules) or in `.hive/Entities/<sanitized-username>/` (private to the creator).
- Usernames are sanitized into folder names: lowercased, non-alphanumeric runs collapsed to `-`, edges trimmed. Example: `My@Email.com` → `my-email-com`.


## Plugin Redirection

A plugin folder can contain a `plugin.link.json` file instead of (or alongside) source files.
This redirects loading to a different path, useful for development or shared plugin libraries:

```json
{
    "Path": "/absolute/path/to/plugin/source"
}
```


## Suppressed Names

Files and folders starting with `~`, `_`, or `.` are excluded from plugin and tool loading.
Use the `~` prefix for plugins or tools under development that should not be loaded.


## Creating a Plugin

### The Factory File

The factory is a class with a static `Initialize` method.
It receives the Registry and a blank Plugin object to configure:

```js
// MyPlugin.factory.js

class Factory
{
    static Initialize( Registry, Plugin )
    {
        Plugin.Description = 'A brief description of this plugin.';
        Plugin.RequiredRole = 'user';

        // Add plugin-level methods or state here.

        return Plugin;
    }
}

module.exports = Factory;
```

**Plugin Properties:**

| Property | Type | Description |
|---|---|---|
| `PluginName` | string | Set automatically from the folder name. |
| `Description` | string | Human-readable description. |
| `RequiredRole` | string | Minimum role required (default: `'guest'`). |
| `ConfigSchema` | object | JSON Schema for plugin-level configuration. |
| `EntitySchema` | object | JSON Schema for entity instances. |
| `Tools` | object | Map of tool name to Tool object (populated during loading). |


### Creating a Tool

Each tool is a separate file that exports a function.
The function receives a blank Tool object and must configure and return it:

```js
// Tools/SayHello/SayHello.js

module.exports = function ( Tool )
{
    Tool.ToolName = 'SayHello';
    Tool.Description = 'Returns a greeting for the given name.';

    Tool.Parameters = {
        type: 'object',
        properties: {
            Name: { type: 'string', description: 'The name to greet' },
        },
        required: [ 'Name' ],
    };

    Tool.Returns = {
        type: 'object',
        properties: {
            Message: { type: 'string', description: 'The greeting message' },
        },
    };

    Tool.Execute = async function ( Hive, Plugin, Arguments )
    {
        return { Message: 'Hello, ' + Arguments.Name + '!' };
    };

    return Tool;
};
```

**Tool.Execute signature:**

| Parameter | Description |
|---|---|
| `Hive` | The active Hive instance. Provides `DataPath`, `Helpers`, and `UserName`/`UserRole`. |
| `Plugin` | The parent Plugin object. Access plugin methods and properties here. |
| `Arguments` | The arguments passed by the caller, matching `Tool.Parameters`. |

`Execute` can be sync or async. The Hive awaits the result in either case.

**Available Helpers** (via `Hive.Helpers`):

| Helper | Description |
|---|---|
| `FileUtils` | Async file and folder operations (read, write, find, delete, etc.). |
| `Logger` | Console logging with timestamps, colorization, and severity levels. |


### Entity-Type Plugins

To make a plugin manage named entity instances, set `EntitySchema` in the factory:

```js
static Initialize( Registry, Plugin )
{
    Plugin.Description = 'Key-value storage for persistent data.';
    Plugin.EntitySchema = {
        type: 'object',
        properties: {
            Name: { type: 'string' },
            Description: { type: 'string', default: '' },
        },
        required: [ 'Name' ],
    };

    return Plugin;
}
```

This automatically generates six tools on the plugin:

| Tool | MinimumRole | Description |
|---|---|---|
| `ListEntities` | (none) | Lists all entity instances visible to the caller (user folder + shared). Each item includes `Location: 'user' \| 'shared'`. |
| `ConfigEntity` | `admin` | Read, create, or update an entity's configuration. New entities are created in the caller's user folder with the caller as owner. (Role check is skipped when creating a new entity.) |
| `DeleteEntity` | `owner` | Delete an entity and its data folder. |
| `RenameEntity` | `owner` | Rename an entity (stays in the same location). |
| `ShareEntity` | `owner` | Promote a user-owned entity to the shared space (`.hive/Entities/.shared/`). |
| `UnshareEntity` | `owner` | Return a shared entity to its owner's user folder. |

To find the folder for an entity in a plugin tool, always go through the Hive:

```js
var folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
```

`GetEntityDataPath` resolves the entity by checking the caller's user folder first, then `.shared`. If the entity does not exist, it returns the prospective path in the user folder so create-flows still work.


### Working with Entity Data

Plugin-level helper methods are a good pattern for encapsulating data access.
Define them in the factory and use them from your tools:

```js
static Initialize( Registry, Plugin )
{
    // ...

    Plugin.LoadData = async function ( Hive, EntityName )
    {
        var entity_folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
        var data_path = PATH.join( entity_folder, EntityName + '.data.json' );
        if ( !await Hive.Helpers.FileUtils.FileExists( data_path ) )
        {
            throw new Error( `Entity [${EntityName}] does not exist.` );
        }
        return await Hive.Helpers.FileUtils.ReadJson( data_path );
    };

    Plugin.SaveData = async function ( Hive, EntityName, Data )
    {
        var entity_folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
        await Hive.Helpers.FileUtils.EnsureFolder( entity_folder );
        var data_path = PATH.join( entity_folder, EntityName + '.data.json' );
        await Hive.Helpers.FileUtils.WriteJson( data_path, Data );
        return true;
    };

    return Plugin;
}
```

Then in a tool:

```js
Tool.Execute = async function ( Hive, Plugin, Arguments )
{
    var data = await Plugin.LoadData( Hive, Arguments.EntityName );
    // ... work with data ...
    await Plugin.SaveData( Hive, Arguments.EntityName, data );
    return { Success: true };
};
```


## Entity Security

Every entity carries a `<EntityName>.security.json` sidecar in its folder.
It records the owner, explicit grantees, and a fallback level for anyone else:

```json
{
    "owner": "alice",
    "admins": [ "bob" ],
    "users": [ "eve" ],
    "guest_access": "user"
}
```

**Access levels** (high to low): `owner` > `admin` > `user` > `none`.

When the caller is not the owner and is not listed in `admins` or `users`,
their effective level is `guest_access`. Setting `guest_access: 'none'`
makes the entity invisible to anyone else in `ListEntities` and blocks all
tool calls that require at least `user`.

### Declaring access on tools

Tools opt into per-entity enforcement by setting `Tool.MinimumRole` to the
minimum level required (`'user'`, `'admin'`, or `'owner'`). The check runs
in `CommandProcessor.Invoke` before `Execute`:

```js
module.exports = function ( Tool )
{
    Tool.ToolName = 'DeleteNote';
    Tool.MinimumRole = 'admin';   // caller must have admin on the entity

    Tool.Parameters = {
        type: 'object',
        properties: {
            EntityName: { type: 'string' },
            NoteID: { type: 'string' },
        },
        required: [ 'EntityName', 'NoteID' ],
    };

    Tool.Execute = async function ( Hive, Plugin, Arguments )
    {
        // Enforcement already happened — we can trust the caller's level here.
        // ...
    };

    return Tool;
};
```

- The entity's name must be passed in the `EntityName` argument — the
  enforcement hook always reads `Arguments.EntityName`.
- `MinimumRole` defaults to `'none'`, which disables the check. Plugin
  authors set it explicitly on entity-scoped tools.
- For `ConfigEntity`, the check is skipped automatically when the entity
  does not yet exist, so creating a brand-new entity is always allowed.
- For `ShareEntity` / `UnshareEntity`, the level is `owner`, so only the
  creator can move an entity between the user folder and `.shared/`.

### Resolving an entity's folder

When a tool needs to reach entity data, use `Hive.GetEntityDataPath(...)`:

```js
var folder = await Hive.GetEntityDataPath( Plugin.PluginName, Arguments.EntityName );
```

This searches the caller's user folder first, then `.shared/`. If the
entity does not exist yet, it returns the prospective user-folder path so
create-flows work. Never hard-code `<DataPath>/<PluginName>/<EntityName>`
— that layout is gone.


## Complete Example

A minimal plugin with one entity type and one custom tool:

```
Plugins/
    Notes/
        Notes.factory.js
        Tools/
            AddNote/
                AddNote.js
```

**Notes.factory.js:**
```js
const PATH = require( 'path' );

class Factory
{
    static Initialize( Registry, Plugin )
    {
        Plugin.Description = 'Simple note-taking plugin.';
        Plugin.RequiredRole = 'user';
        Plugin.EntitySchema = {
            type: 'object',
            properties: {
                Name: { type: 'string' },
                Description: { type: 'string', default: '' },
            },
            required: [ 'Name' ],
        };

        Plugin.LoadNotes = async function ( Hive, EntityName )
        {
            var folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
            var path = PATH.join( folder, EntityName + '.data.json' );
            if ( !await Hive.Helpers.FileUtils.FileExists( path ) ) { return { Notes: [] }; }
            return await Hive.Helpers.FileUtils.ReadJson( path );
        };

        Plugin.SaveNotes = async function ( Hive, EntityName, Data )
        {
            var folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
            await Hive.Helpers.FileUtils.EnsureFolder( folder );
            await Hive.Helpers.FileUtils.WriteJson(
                PATH.join( folder, EntityName + '.data.json' ), Data );
            return true;
        };

        return Plugin;
    }
}

module.exports = Factory;
```

**Tools/AddNote/AddNote.js:**
```js
module.exports = function ( Tool )
{
    Tool.ToolName = 'AddNote';
    Tool.Description = 'Adds a note to a notebook.';

    Tool.MinimumRole = 'user';

    Tool.Parameters = {
        type: 'object',
        properties: {
            EntityName: { type: 'string', description: 'Name of the notebook entity' },
            Text: { type: 'string', description: 'The note text' },
        },
        required: [ 'EntityName', 'Text' ],
    };

    Tool.Returns = {
        type: 'object',
        properties: {
            Success: { type: 'boolean' },
            Count: { type: 'number', description: 'Total notes in notebook' },
        },
    };

    Tool.Execute = async function ( Hive, Plugin, Arguments )
    {
        var data = await Plugin.LoadNotes( Hive, Arguments.EntityName );
        data.Notes.push( {
            Text: Arguments.Text,
            CreatedAt: new Date().toISOString(),
        } );
        await Plugin.SaveNotes( Hive, Arguments.EntityName, data );
        return { Success: true, Count: data.Notes.length };
    };

    return Tool;
};
```
