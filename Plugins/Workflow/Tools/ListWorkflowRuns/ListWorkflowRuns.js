/*
	ListWorkflowRuns.js
---------------------------------------------------------------------
List workflow runs, optionally filtered by status.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListWorkflowRuns';
	Tool.Description = 'List workflow runs, optionally filtered by status.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Workflow entity' },
			Status: { type: 'string', description: 'Filter by status (optional)' },
			Limit: { type: 'number', description: 'Maximum runs to return (default: 20)' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Runs: { type: 'array', description: 'Array of run summaries' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenRunsDatabase( Hive, Arguments.EntityName );
			var limit = Arguments.Limit || 20;
			var sql = 'SELECT id, status, current_step, error, started_at, completed_at FROM runs';
			var values = [];

			if ( Arguments.Status )
			{
				sql += ' WHERE status = ?';
				values.push( Arguments.Status );
			}

			sql += ' ORDER BY id DESC LIMIT ?';
			values.push( limit );

			var rows = store.Query( sql, values );
			var runs = rows.map( function ( row )
			{
				return {
					RunId: row.id,
					Status: row.status,
					CurrentStep: row.current_step,
					Error: row.error,
					StartedAt: row.started_at,
					CompletedAt: row.completed_at,
				};
			} );
			return { Runs: runs };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
