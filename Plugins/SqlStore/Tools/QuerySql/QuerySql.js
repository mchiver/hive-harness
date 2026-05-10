/*
	QuerySql.js
---------------------------------------------------------------------
Executes a SQL query that returns rows (SELECT, etc.).
Supports paging via Options.Limit and Options.Offset.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'QuerySql';
	Tool.Description = 'Executes a SQL query and returns rows.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
			Sql: { type: 'string', description: 'SQL query to execute' },
			Values: { description: 'Bound parameter values (array or object)' },
			Options: {
				type: 'object',
				description: 'Query options',
				properties: {
					Limit: { type: 'number', description: 'Maximum number of rows to return' },
					Offset: { type: 'number', description: 'Number of rows to skip' },
				},
			},
		},
		required: [ 'EntityName', 'Sql' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Rows: { type: 'array', description: 'Array of row objects' },
			Count: { type: 'number', description: 'Number of rows returned' },
			Error: { type: 'string', description: 'Error text when error' },
		},
		required: [],
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Build the final SQL with paging options
			var sql = Arguments.Sql;
			var options = Arguments.Options || {};

			if ( options.Limit !== undefined )
			{
				sql += ` LIMIT ${Number( options.Limit )}`;
			}
			if ( options.Offset !== undefined )
			{
				sql += ` OFFSET ${Number( options.Offset )}`;
			}

			var rows = store.Query( sql, Arguments.Values );
			return {
				Rows: rows,
				Count: rows.length,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
