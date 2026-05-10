/*
	GetTableSchema.js
---------------------------------------------------------------------
Returns the schema for a table in a SqlStore database.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'GetTableSchema';
	Tool.Description = 'Returns the column schema for a table.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the SqlStore entity' },
			TableName: { type: 'string', description: 'Name of the table' },
		},
		required: [ 'EntityName', 'TableName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Columns: {
				type: 'array',
				description: 'Array of column definitions: { Name, Type, PrimaryKey, AutoIncrement, NotNull, Default }',
			},
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
			var schema = store.GetTableSchema( Arguments.TableName );
			if ( !schema )
			{
				throw new Error( `Table [${Arguments.TableName}] not found.` );
			}
			return schema;
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
