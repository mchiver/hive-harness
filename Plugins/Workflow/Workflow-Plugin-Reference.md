# Workflow Plugin Reference


## Summary

The Workflow plugin provides multi-step tool orchestration within a Hive.
Each Workflow is an entity instance — the workflow definition (steps, error handling) is stored in the entity's `.entity.json`, while run history is tracked in a SQLite database.

Workflows execute steps sequentially, passing data between steps via variable interpolation.


## Use Cases

- **Multi-step automation** — Chain tool calls together: read data, transform it, write results.
- **Data pipelines** — Import, validate, and store data in a repeatable sequence.
- **Agent task plans** — Define a plan as a workflow, execute it, and review the results.
- **Repeatable processes** — Define once, run many times with different inputs.


## Entity Management

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a workflow definition. |
| `ListEntities()` | Lists all Workflow instances. |
| `DeleteEntity( EntityName )` | Deletes a workflow and all run history. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a workflow. |

### Entity Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `Name` | string | (required) | Workflow name. |
| `Description` | string | `''` | Human-readable description. |
| `Steps` | array | `[]` | Array of step definitions (see below). |
| `OnError` | string | `'stop'` | Default error handling: `'stop'` or `'continue'`. |

### Step Definition

Each step in the `Steps` array:

| Field | Type | Required | Description |
|---|---|---|---|
| `Name` | string | yes | Unique step name (used for variable references). |
| `Tool` | string | yes | Tool to invoke: `"PluginName.ToolName"`. |
| `Arguments` | object | no | Arguments to pass. Supports variable interpolation. |
| `OnError` | string | no | Override workflow-level error handling for this step. |

### Variable Interpolation

Step arguments can reference:

| Variable | Description |
|---|---|
| `$Input.FieldName` | Workflow input parameter. |
| `$Steps.step-name.FieldName` | Result of a previous step (by step Name). |
| `$Now` | Current ISO 8601 timestamp. |

Variables work as:
- **Exact match** — If the entire argument value is a variable (e.g. `"$Input.Name"`), the resolved value preserves its original type (number, object, etc.).
- **Inline** — Variables embedded in a larger string are replaced with their string representation.

**Example:**
```js
await hive.InvokeTool( 'Workflow.ConfigEntity', {
    EntityName: 'import-data',
    Settings: {
        Steps: [
            {
                Name: 'read-file',
                Tool: 'Workspace.ReadFile',
                Arguments: { Path: '$Input.FilePath' },
            },
            {
                Name: 'store-result',
                Tool: 'KeyStore.SetKey',
                Arguments: {
                    EntityName: 'results',
                    Key: 'last_import',
                    Value: '$Steps.read-file.Content',
                },
            },
        ],
    },
} );
```


## Workflow Tools

| Signature | Description |
|---|---|
| `RunWorkflow( EntityName, [Input] )` | Execute a workflow. |
| `GetWorkflowStatus( EntityName, RunId )` | Get status of a specific run. |
| `ListWorkflowRuns( EntityName, [Status], [Limit] )` | List runs. |

### RunWorkflow

Executes a workflow definition step by step. Each step invokes a tool via `CommandProcessor.Invoke`. Results from earlier steps are available to later steps via `$Steps.step-name.Field` interpolation.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Workflow name. |
| `Input` | object | no | Input parameters accessible via `$Input`. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RunId` | number | ID of the run record. |
| `Status` | string | `'completed'` or `'failed'`. |
| `StepResults` | array | Array of `{ Name, Tool, Success, Error, Result }` per step. |
| `Error` | string | Error message if the workflow failed. |

**Usage:**
```js
var result = await hive.InvokeTool( 'Workflow.RunWorkflow', {
    EntityName: 'import-data',
    Input: { FilePath: 'data/input.txt' },
} );
// result.Result = { RunId: 1, Status: 'completed', StepResults: [...] }
```

### GetWorkflowStatus

Get detailed status and results of a specific workflow run.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Workflow name. |
| `RunId` | number | yes | Run ID. |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `RunId` | number | Run ID. |
| `Status` | string | Run status. |
| `Input` | object | Workflow input parameters. |
| `CurrentStep` | number | Index of current/last executed step. |
| `StepResults` | array | Step results array. |
| `Error` | string | Error message if failed. |
| `StartedAt` | string | ISO timestamp. |
| `CompletedAt` | string | ISO timestamp. |

### ListWorkflowRuns

List workflow runs with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Workflow name. |
| `Status` | string | no | Filter by status. |
| `Limit` | number | no | Max runs to return (default: 20). |

**Returns:** `{ Runs: [ { RunId, Status, CurrentStep, Error, StartedAt, CompletedAt } ] }`


## Data Storage

```
.hive/Entities/<owner>/Workflow/<EntityName>/<EntityName>.entity.json    # Workflow definition
.hive/Entities/<owner>/Workflow/<EntityName>/runs.db                     # Run history (SQLite)
```
