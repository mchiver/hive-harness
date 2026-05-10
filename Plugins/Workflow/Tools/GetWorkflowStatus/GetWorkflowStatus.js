/*
	GetWorkflowStatus.js
---------------------------------------------------------------------
Get status and results of a specific workflow run.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetWorkflowStatus';
	Tool.Description = 'Get status and results of a workflow run.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Workflow entity' },
			RunId: { type: 'number', description: 'ID of the workflow run' },
		},
		required: [ 'EntityName', 'RunId' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			RunId: { type: 'number', description: 'Run ID' },
			Status: { type: 'string', description: 'Run status' },
			Input: { description: 'Workflow input parameters' },
			CurrentStep: { type: 'number', description: 'Index of current/last step' },
			StepResults: { type: 'array', description: 'Array of step results' },
			Error: { type: 'string', description: 'Error text' },
			StartedAt: { type: 'string', description: 'When the run started' },
			CompletedAt: { type: 'string', description: 'When the run completed' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenRunsDatabase( Hive, Arguments.EntityName );
			var rows = store.Query( 'SELECT * FROM runs WHERE id = ?', [ Arguments.RunId ] );
			if ( rows.length === 0 ) { throw new Error( 'Run not found.' ); }

			var run = rows[ 0 ];
			return {
				RunId: run.id,
				Status: run.status,
				Input: JSON.parse( run.input || '{}' ),
				CurrentStep: run.current_step,
				StepResults: JSON.parse( run.step_results || '[]' ),
				Error: run.error,
				StartedAt: run.started_at,
				CompletedAt: run.completed_at,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
