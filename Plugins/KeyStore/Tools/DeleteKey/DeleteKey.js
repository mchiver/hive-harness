/*
	DeleteKey.js
---------------------------------------------------------------------
Deletes a key from the store.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'DeleteKey';
	Tool.Description = 'Deletes a key from the store.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the store' },
			Key: { type: 'string', description: 'Key to remove' },
		},
		required: [ 'EntityName', 'Key' ],
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
		var store_data = await Plugin.LoadStore( Hive, Arguments.EntityName );

		var key = Arguments.Key;
		if ( !store_data.Values || !store_data.Values[ key ] )
		{
			throw new Error( 'Key not found' );
		}

		delete store_data.Values[ key ];

		await Plugin.SaveStore( Hive, Arguments.EntityName, store_data );

		return { Success: true };
	};

	return Tool;
};
