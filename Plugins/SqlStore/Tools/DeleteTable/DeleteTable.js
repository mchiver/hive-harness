/*
	DeleteTable.js
---------------------------------------------------------------------
Deletes (drops) a table from a SqlStore database.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'DeleteTable';
	Tool.Description = 'Deletes a table from a SqlStore database.';

	Tool.MinimumRole = 'admin';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
			TableName: { type: 'string', description: 'Name of the table to delete' },
		},
		required: [ 'EntityName', 'TableName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
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
			store.DeleteTable( Arguments.TableName );
			return { Success: true };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
