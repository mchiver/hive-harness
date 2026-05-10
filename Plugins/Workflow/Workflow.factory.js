/*
	Workflow.factory.js
---------------------------------------------------------------------
Workflow plugin factory - provides multi-step tool orchestration.
Each entity is a workflow definition (stored in .entity.json).
Workflow runs are tracked in a SQLite database per entity.
*/

const PATH = require( 'path' );
const SqlStoreHelper = require( '../../Helpers/SqlStore.js' );

class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Multi-step tool orchestration with variable interpolation.';
		Plugin.RequiredRole = 'user';

		// Workflow is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a Workflow entity.',
			properties: {
				Name: { type: 'string', description: 'Workflow name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of the workflow.' },
				Steps: {
					type: 'array', default: [],
					description: 'Array of step objects. Each step: { Name: string, Tool: "PluginName.ToolName", Arguments: {}, OnError: "stop"|"continue" }. '
						+ 'Arguments support variable interpolation: $Input.Field, $Steps.step-name.Field, $Now.',
				},
				OnError: { type: 'string', default: 'stop', description: 'Default error handling for steps: "stop" aborts on failure, "continue" proceeds to the next step.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Open the runs database for a workflow entity.
		// Creates the runs table if it doesn't exist.
		Plugin.OpenRunsDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, 'runs.db' );
			var store = new SqlStoreHelper();
			store.Open( db_path, { JournalMode: 'wal', ForeignKeys: true } );

			store.Execute( `CREATE TABLE IF NOT EXISTS runs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				status TEXT NOT NULL DEFAULT 'running',
				input TEXT,
				current_step INTEGER DEFAULT 0,
				step_results TEXT,
				error TEXT,
				started_at TEXT,
				completed_at TEXT
			)` );

			return store;
		};


		//---------------------------------------------------------------------
		// Read workflow definition from entity config.
		Plugin.GetWorkflowDefinition = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			var config_path = PATH.join( store_folder, EntityName + '.entity.json' );
			if ( !await Hive.Helpers.FileUtils.FileExists( config_path ) )
			{
				throw new Error( `Workflow [${EntityName}] not found.` );
			}
			return await Hive.Helpers.FileUtils.ReadJson( config_path );
		};


		//---------------------------------------------------------------------
		// Interpolate variables in an arguments object.
		// Supports: $Input.Field, $Steps.step-name.Field, $Now
		Plugin.InterpolateArguments = function ( Arguments, Input, StepResults )
		{
			var result = {};
			for ( var key in Arguments )
			{
				result[ key ] = interpolate_value( Arguments[ key ], Input, StepResults );
			}
			return result;
		};


		//---------------------------------------------------------------------
		// Dynamic Skills
		Plugin.Skills = {};


		//---------------------------------------------------------------------
		// WorkflowSkill - explains workflow creation, management, and execution.
		Plugin.Skills.WorkflowSkill = function ( Hive )
		{
			var skill_text = '';

			// --- Overview ---
			skill_text += `
Workflows let you define multi-step tool sequences that run automatically.
Each workflow is a named entity with an ordered list of steps.
Each step calls a tool and can pass data forward using variable interpolation.
`;

			// --- Entity Management ---
			skill_text += `
Creating and managing workflows:
- Workflow.ConfigEntity — Create or update a workflow definition. Pass EntityName and Settings (Name, Description, Steps, OnError).
- Workflow.ListEntities — List all workflow definitions.
- Workflow.DeleteEntity — Delete a workflow and its run history.
- Workflow.RenameEntity — Rename a workflow.
`;

			// --- Step Definition ---
			skill_text += `
Step definition:
Each step in the Steps array is an object with:
- Name — Unique step name (used for referencing results in later steps).
- Tool — Tool to invoke, as "PluginName.ToolName".
- Arguments — Object of arguments to pass to the tool.
- OnError — "stop" (default) or "continue". Overrides the workflow-level OnError.
`;

			// --- Variable Interpolation ---
			skill_text += `
Variable interpolation:
Step arguments can reference dynamic values:
- $Input.FieldName — A field from the workflow input.
- $Steps.step-name.FieldName — A field from a previous step's result.
- $Now — Current ISO 8601 timestamp.
When a variable is the entire argument value, the original type is preserved.
When embedded in a larger string, it is replaced with its string representation.
`;

			// --- Execution Tools ---
			skill_text += `
Running and monitoring workflows:
- Workflow.RunWorkflow — Execute a workflow by EntityName, with optional Input object. Returns RunId, Status, and StepResults.
- Workflow.GetWorkflowStatus — Get the status and results of a specific run by EntityName and RunId.
- Workflow.ListWorkflowRuns — List runs for a workflow, with optional Status filter and Limit.
`;

			// --- Example ---
			skill_text += `
Example: defining and running a workflow:

Define:
<tool-call>{"Tool":"Workflow.ConfigEntity","Arguments":{"EntityName":"import-data","Settings":{"Name":"import-data","Description":"Read a file and store its content","Steps":[{"Name":"read-file","Tool":"Workspace.ReadFile","Arguments":{"Path":"$Input.FilePath"}},{"Name":"store-result","Tool":"KeyStore.SetKey","Arguments":{"EntityName":"results","Key":"last_import","Value":"$Steps.read-file.Content"}}]}}}</tool-call>

Run:
<tool-call>{"Tool":"Workflow.RunWorkflow","Arguments":{"EntityName":"import-data","Input":{"FilePath":"data/input.txt"}}}</tool-call>
`;
			return skill_text;
		};


		return Plugin;
	}
}


//=====================================================================
// Interpolate a single value. Recursively handles objects and arrays.
function interpolate_value( Value, Input, StepResults )
{
	if ( typeof Value === 'string' )
	{
		// Exact match for full variable replacement (preserves types)
		if ( Value === '$Now' ) { return new Date().toISOString(); }

		var input_match = Value.match( /^\$Input\.(.+)$/ );
		if ( input_match ) { return resolve_path( Input, input_match[ 1 ] ); }

		var steps_match = Value.match( /^\$Steps\.([^.]+)\.(.+)$/ );
		if ( steps_match ) { return resolve_path( StepResults[ steps_match[ 1 ] ] || {}, steps_match[ 2 ] ); }

		// Inline substitution for embedded variables
		var replaced = Value.replace( /\$Now/g, new Date().toISOString() );
		replaced = replaced.replace( /\$Input\.([a-zA-Z0-9_.]+)/g, function ( match, path )
		{
			var resolved = resolve_path( Input, path );
			return ( resolved !== undefined ) ? String( resolved ) : match;
		} );
		replaced = replaced.replace( /\$Steps\.([^.]+)\.([a-zA-Z0-9_.]+)/g, function ( match, step_name, path )
		{
			var resolved = resolve_path( StepResults[ step_name ] || {}, path );
			return ( resolved !== undefined ) ? String( resolved ) : match;
		} );
		return replaced;
	}
	else if ( Array.isArray( Value ) )
	{
		return Value.map( function ( item ) { return interpolate_value( item, Input, StepResults ); } );
	}
	else if ( Value && typeof Value === 'object' )
	{
		var result = {};
		for ( var key in Value )
		{
			result[ key ] = interpolate_value( Value[ key ], Input, StepResults );
		}
		return result;
	}
	return Value;
}


//---------------------------------------------------------------------
// Resolve a dotted path on an object. e.g. resolve_path( obj, 'a.b.c' ) -> obj.a.b.c
function resolve_path( Object, Path )
{
	var parts = Path.split( '.' );
	var current = Object;
	for ( var part of parts )
	{
		if ( current === undefined || current === null ) { return undefined; }
		current = current[ part ];
	}
	return current;
}


module.exports = Factory;
