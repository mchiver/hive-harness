/*
	ExecuteSql.js
---------------------------------------------------------------------
Executes a SQL statement that modifies data (INSERT, UPDATE, DELETE, etc.).
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ExecuteSql';
	Tool.Description = 'Executes a SQL statement and returns status.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
			Sql: { type: 'string', description: 'SQL statement to execute' },
			Values: { description: 'Bound parameter values (array or object)' },
			Options: {
				type: 'object',
				description: 'Execution options (reserved for future use)',
			},
		},
		required: [ 'EntityName', 'Sql' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			RowsAffected: { type: 'number', description: 'Number of rows affected' },
			LastInsertId: { type: 'number', description: 'Last inserted row ID' },
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
			var result = store.Execute( Arguments.Sql, Arguments.Values );
			return result;
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
