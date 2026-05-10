/*
	CreateTable.js
---------------------------------------------------------------------
Creates a table in a SqlStore database.
TableSchema can be a raw SQL string or a JSON object with a Columns array.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'CreateTable';
	Tool.Description = 'Creates a table in a SqlStore database.';

	Tool.MinimumRole = 'admin';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
			TableName: { type: 'string', description: 'Name of the table to create' },
			TableSchema: {
				description: 'Table schema: a raw SQL column definition string, or an object with a Columns array [ { Name, Type, PrimaryKey, AutoIncrement, NotNull, Default } ]',
			},
		},
		required: [ 'EntityName', 'TableName', 'TableSchema' ],
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
			store.CreateTable( Arguments.TableName, Arguments.TableSchema );
			return { Success: true };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
