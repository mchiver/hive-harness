/*
	ListTables.js
---------------------------------------------------------------------
Lists all user tables in a SqlStore database.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListTables';
	Tool.Description = 'Lists all tables in a SqlStore database.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
		},
		required: [ 'EntityName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Tables: { type: 'array', description: 'Array of table name strings' },
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
			var tables = store.ListTables();
			return { Tables: tables };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
