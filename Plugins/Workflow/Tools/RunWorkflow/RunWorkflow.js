/*
	RunWorkflow.js
---------------------------------------------------------------------
Executes a workflow definition step by step.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RunWorkflow';
	Tool.Description = 'Execute a workflow and return the run result.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Workflow entity' },
			Input: { type: 'object', description: 'Input parameters for the workflow (optional)' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			RunId: { type: 'number', description: 'ID of the workflow run' },
			Status: { type: 'string', description: 'Final status: completed or failed' },
			StepResults: { type: 'array', description: 'Array of step results' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var runs_store = null;
		try
		{
			// Load workflow definition
			var definition = await Plugin.GetWorkflowDefinition( Hive, Arguments.EntityName );
			var steps = definition.Steps || [];
			var workflow_on_error = definition.OnError || 'stop';
			var input = Arguments.Input || {};

			// Create run record
			runs_store = await Plugin.OpenRunsDatabase( Hive, Arguments.EntityName );
			var now = new Date().toISOString();
			var insert_result = runs_store.Execute(
				'INSERT INTO runs ( status, input, current_step, step_results, started_at ) VALUES ( ?, ?, ?, ?, ? )',
				[ 'running', JSON.stringify( input ), 0, '[]', now ]
			);
			var run_id = insert_result.LastInsertId;
			runs_store.Close();
			runs_store = null;

			// Execute steps
			var step_results = {};  // keyed by step Name
			var step_results_array = [];
			var final_status = 'completed';
			var final_error = null;

			for ( var index = 0; index < steps.length; index++ )
			{
				var step = steps[ index ];
				var step_name = step.Name || ( 'step_' + index );
				var step_on_error = step.OnError || workflow_on_error;

				// Interpolate arguments
				var tool_parts = step.Tool.split( '.' );
				var plugin_name = tool_parts[ 0 ];
				var tool_name = tool_parts[ 1 ];
				var interpolated_args = Plugin.InterpolateArguments( step.Arguments || {}, input, step_results );

				// Invoke tool
				var invoke_result = null;
				try
				{
					invoke_result = await Hive.Helpers.CommandProcessor.Invoke(
						Hive, plugin_name, tool_name, interpolated_args
					);
				}
				catch ( error )
				{
					invoke_result = { Success: false, Error: error.message, Result: null };
				}

				// Store step result
				var step_entry = {
					Name: step_name,
					Tool: step.Tool,
					Success: invoke_result.Success,
					Error: invoke_result.Error,
					Result: invoke_result.Result,
				};
				step_results[ step_name ] = invoke_result.Result;
				step_results_array.push( step_entry );

				// Update run progress
				runs_store = await Plugin.OpenRunsDatabase( Hive, Arguments.EntityName );
				runs_store.Execute(
					'UPDATE runs SET current_step = ?, step_results = ? WHERE id = ?',
					[ index + 1, JSON.stringify( step_results_array ), run_id ]
				);
				runs_store.Close();
				runs_store = null;

				// Handle errors
				if ( !invoke_result.Success )
				{
					if ( step_on_error === 'stop' )
					{
						final_status = 'failed';
						final_error = invoke_result.Error;
						break;
					}
					// 'continue' and 'skip' both proceed to next step
				}
			}

			// Finalize run
			runs_store = await Plugin.OpenRunsDatabase( Hive, Arguments.EntityName );
			var completed_at = new Date().toISOString();
			runs_store.Execute(
				'UPDATE runs SET status = ?, step_results = ?, error = ?, completed_at = ? WHERE id = ?',
				[ final_status, JSON.stringify( step_results_array ), final_error, completed_at, run_id ]
			);
			runs_store.Close();
			runs_store = null;

			return {
				RunId: run_id,
				Status: final_status,
				StepResults: step_results_array,
				Error: final_error,
			};
		}
		finally
		{
			if ( runs_store ) { runs_store.Close(); }
		}
	};

	return Tool;
};
