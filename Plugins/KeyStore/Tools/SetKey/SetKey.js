/*
	SetKey.js
---------------------------------------------------------------------
Sets a value in the store by key.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'SetKey';
	Tool.Description = 'Sets a value in the store by key.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the store' },
			Key: { type: 'string', description: 'Key to set' },
			Value: { type: 'any', description: 'Value to store' },
		},
		required: [ 'EntityName', 'Key', 'Value' ],
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

		var now = new Date().toISOString();
		var key = Arguments.Key;
		var is_new = !store_data.Values[ key ];

		store_data.Values = store_data.Values || {};
		store_data.Values[ key ] = {
			Value: Arguments.Value,
			CreatedAt: is_new ? now : store_data.Values[ key ].CreatedAt,
			UpdatedAt: now,
		};

		await Plugin.SaveStore( Hive, Arguments.EntityName, store_data );

		return { Success: true };
	};

	return Tool;
};
