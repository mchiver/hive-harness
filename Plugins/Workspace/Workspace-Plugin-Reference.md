# Workspace Plugin Reference


## Summary

The Workspace plugin provides filesystem tools scoped to the Hive root directory (the "workspace").
All paths are relative to the workspace root. Operations are restricted to prevent access outside the
workspace or into the `.hive` data folder.

This plugin is not an entity-type plugin — it operates directly on the workspace filesystem.


## Use Cases

- **File management** — Read, write, append, delete, and rename files within the workspace.
- **Folder management** — Create, delete, and copy folder trees.
- **Content discovery** — List or search for files and folders by name or glob pattern.
- **JSON data** — Read and write structured JSON files directly.
- **Workspace exploration** — Check existence of files, folders, or paths.


## Path Security

All tools enforce two security constraints on every path argument:

1. **No escape** — Resolved paths must remain within the workspace root. Paths like `../../etc/passwd` are rejected.
2. **No `.hive` access** — Paths that resolve into the `.hive` folder are rejected. This protects Hive internal data.

Paths are resolved relative to the workspace root using `path.resolve`, then normalized. Both checks
are applied after normalization, so traversal tricks (e.g. `subdir/../../.hive/data`) are caught.


## File Tools

| Signature | Description |
|---|---|
| `ReadFile( Path )` | Reads the text contents of a file. |
| `WriteFile( Path, Content )` | Writes text content to a file. |
| `AppendFile( Path, Content )` | Appends text content to a file. |
| `ReadJson( Path )` | Reads and parses a JSON file. |
| `WriteJson( Path, Data )` | Writes data to a JSON file. |
| `DeleteFile( Path )` | Deletes a file. |

### ReadFile

Reads the text contents of a file in the workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the file. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Content` | string | The file contents. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.ReadFile', { Path: 'src/app.js' } );
// result.Result = { Content: '...' }
```

### WriteFile

Writes text content to a file. Creates the file if it does not exist, overwrites if it does.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the file. |
| `Content` | string | yes | The text content to write. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.WriteFile', {
    Path: 'output/report.txt',
    Content: 'Report contents here.',
} );
```

### AppendFile

Appends text content to an existing file.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the file. |
| `Content` | string | yes | The text content to append. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.AppendFile', {
    Path: 'log.txt',
    Content: 'New log entry.\n',
} );
```

### ReadJson

Reads and parses a JSON file, returning the parsed data.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the JSON file. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Data` | any | The parsed JSON data. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.ReadJson', { Path: 'config.json' } );
// result.Result = { Data: { key: 'value', ... } }
```

### WriteJson

Writes data to a JSON file with pretty-printed formatting.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the JSON file. |
| `Data` | any | yes | The data to write as JSON. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.WriteJson', {
    Path: 'state.json',
    Data: { Status: 'ready', Count: 42 },
} );
```

### DeleteFile

Deletes a file from the workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the file. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.DeleteFile', { Path: 'temp/scratch.txt' } );
```


## Folder Tools

| Signature | Description |
|---|---|
| `CreateFolder( Path )` | Creates a folder, including intermediate directories. |
| `DeleteFolder( Path, [Recursive] )` | Deletes a folder. |

### CreateFolder

Creates a folder in the workspace. Creates intermediate directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the folder. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'output/reports/2026' } );
```

### DeleteFolder

Deletes a folder from the workspace. By default only deletes empty folders.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the folder. |
| `Recursive` | boolean | no | Delete non-empty folders recursively (default: `false`). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
// Delete an empty folder
await hive.InvokeTool( 'Workspace.DeleteFolder', { Path: 'temp' } );

// Delete a folder and all its contents
await hive.InvokeTool( 'Workspace.DeleteFolder', { Path: 'build', Recursive: true } );
```


## Path Tools

| Signature | Description |
|---|---|
| `Rename( FromPath, ToPath )` | Renames or moves a file or folder. |
| `CopyBranch( SourcePath, TargetPath )` | Recursively copies a folder tree. |
| `PathExists( Path )` | Checks whether a path exists. |
| `FileExists( Path )` | Checks whether a file exists. |
| `FolderExists( Path )` | Checks whether a folder exists. |

### Rename

Renames or moves a file or folder within the workspace. Both source and destination must be within the workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `FromPath` | string | yes | Relative path of the source. |
| `ToPath` | string | yes | Relative path of the destination. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.Rename', {
    FromPath: 'draft.txt',
    ToPath: 'final.txt',
} );
```

### CopyBranch

Recursively copies a folder and all its contents to a new location within the workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `SourcePath` | string | yes | Relative path of the source folder. |
| `TargetPath` | string | yes | Relative path of the target folder. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Success` | boolean | `true` on success. |

**Usage:**
```js
await hive.InvokeTool( 'Workspace.CopyBranch', {
    SourcePath: 'templates/default',
    TargetPath: 'projects/new-project',
} );
```

### PathExists

Checks whether a path (file or folder) exists in the workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to check. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Exists` | boolean | `true` if the path exists. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.PathExists', { Path: 'config.json' } );
// result.Result = { Exists: true }
```

### FileExists

Checks whether a file exists in the workspace. Returns `false` for folders.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the file. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Exists` | boolean | `true` if the file exists. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.FileExists', { Path: 'readme.md' } );
```

### FolderExists

Checks whether a folder exists in the workspace. Returns `false` for files.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | yes | Relative path to the folder. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Exists` | boolean | `true` if the folder exists. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.FolderExists', { Path: 'src' } );
```


## Editing Tools

| Signature | Description |
|---|---|
| `Sed( Command, Path, [Options] )` | Stream editor: apply sed-like commands to workspace files. |

### Sed

Applies sed-like commands to one or more files. Supports substitution, line deletion, insert-before, and append-after operations. Commands can be chained as an array for multi-step edits in a single call.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Command` | string or array | yes | One or more sed commands (see Command Syntax below). |
| `Path` | string | yes | Relative file path, or glob pattern when `Options.Glob` is `true`. |
| `Options` | object | no | `{ Glob, Recurse, DryRun }` |

**Options:**

| Option | Type | Description |
|---|---|---|
| `Glob` | boolean | Treat `Path` as a glob pattern and operate on all matching files. |
| `Recurse` | boolean | When `Glob` is `true`, search subdirectories recursively. |
| `DryRun` | boolean | Preview changes without writing to disk. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Files` | array | Array of `{ Path, Modified, Changes }` per file processed. |
| `Error` | string | Error message on failure. |

**Command Syntax:**

The delimiter character is the first character after the command letter (commonly `/`, but any character works — use `|` to avoid escaping paths).

| Command | Syntax | Description |
|---|---|---|
| Substitute | `s/pattern/replacement/flags` | Regex search-and-replace. Flags: `g` (global), `i` (case-insensitive). |
| Delete | `d/pattern/` | Delete lines matching the regex pattern. |
| Insert | `i/pattern/text` | Insert text before lines matching the pattern. |
| Append | `a/pattern/text` | Append text after lines matching the pattern. |

**Usage:**
```js
// Simple substitution
await hive.InvokeTool( 'Workspace.Sed', {
    Command: 's/oldName/newName/g',
    Path: 'src/config.js',
} );

// Delete comment lines
await hive.InvokeTool( 'Workspace.Sed', {
    Command: 'd/^\\s*\\/\\//',
    Path: 'src/app.js',
} );

// Insert a header before a function
await hive.InvokeTool( 'Workspace.Sed', {
    Command: 'i/^function main/// --- Entry Point ---',
    Path: 'src/app.js',
} );

// Multiple commands, alternate delimiter
await hive.InvokeTool( 'Workspace.Sed', {
    Command: [ 's|old/path|new/path|g', 'd/^#/' ],
    Path: 'config.txt',
} );

// Glob mode with DryRun
var result = await hive.InvokeTool( 'Workspace.Sed', {
    Command: 's/TODO/DONE/g',
    Path: 'src/*.js',
    Options: { Glob: true, Recurse: true, DryRun: true },
} );
// result.Result = { Files: [ { Path: 'src/app.js', Modified: true, Changes: 3 }, ... ] }
```


## Search Tools

| Signature | Description |
|---|---|
| `FindFiles( [Path], [Glob], [Recurse] )` | Finds files matching an optional glob pattern. |
| `FindFolders( [Path], [Glob], [Recurse] )` | Finds folders matching an optional glob pattern. |
| `ListFiles( [Path] )` | Lists all files in a folder (non-recursive). |
| `ListFolders( [Path] )` | Lists all folders in a folder (non-recursive). |

### FindFiles

Finds files in a workspace folder, optionally filtered by a glob pattern.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | no | Relative path of the folder to search (default: workspace root). |
| `Glob` | string | no | Glob pattern to filter filenames (e.g. `"*.js"`). |
| `Recurse` | boolean | no | Search subdirectories recursively (default: `false`). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Files` | array of string | Relative paths of matching files (relative to the search path). |

**Glob patterns:** `*` matches any sequence of characters, `?` matches a single character. Matching is case-insensitive.

**Usage:**
```js
// Find all JavaScript files recursively
var result = await hive.InvokeTool( 'Workspace.FindFiles', {
    Path: 'src',
    Glob: '*.js',
    Recurse: true,
} );
// result.Result = { Files: [ 'app.js', 'lib/utils.js', ... ] }
```

### FindFolders

Finds folders in a workspace folder, optionally filtered by a glob pattern.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | no | Relative path of the folder to search (default: workspace root). |
| `Glob` | string | no | Glob pattern to filter folder names. |
| `Recurse` | boolean | no | Search subdirectories recursively (default: `false`). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Folders` | array of string | Relative paths of matching folders (relative to the search path). |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.FindFolders', {
    Glob: 'src*',
} );
// result.Result = { Folders: [ 'src', 'src-lib' ] }
```

### ListFiles

Lists all files in a workspace folder (non-recursive).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | no | Relative path of the folder to list (default: workspace root). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Files` | array of string | Filenames in the folder. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.ListFiles', { Path: 'docs' } );
// result.Result = { Files: [ 'readme.md', 'changelog.md' ] }
```

### ListFolders

Lists all folders in a workspace folder (non-recursive).

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `Path` | string | no | Relative path of the folder to list (default: workspace root). |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `Folders` | array of string | Folder names in the folder. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workspace.ListFolders', {} );
// result.Result = { Folders: [ 'src', 'docs', 'tests' ] }
```
