/*
	GetKey.js
---------------------------------------------------------------------
Gets a value from the store by key.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'GetKey';
	Tool.Description = 'Gets a value from the store by key.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the store' },
			Key: { type: 'string', description: 'Key to retrieve' },
		},
		required: [ 'EntityName', 'Key' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
			Error: { type: 'string', description: 'Error text when error' },
			Value: { type: 'any', description: 'Stored value for key' },
			CreatedAt: { type: 'string', "format": 'date-time', description: 'When this was first added to the store' },
			UpdatedAt: { type: 'string', "format": 'date-time', description: 'When this was last updated in the store' },
		},
		required: [],
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store_data = await Plugin.LoadStore( Hive, Arguments.EntityName );

		var key = Arguments.Key;
		if ( store_data.Values && store_data.Values[ key ] )
		{
			var entry = store_data.Values[ key ];
			return {
				Value: entry.Value,
				CreatedAt: entry.CreatedAt,
				UpdatedAt: entry.UpdatedAt,
			};
		}

		throw new Error( 'Key not found' );
	};

	return Tool;
};
