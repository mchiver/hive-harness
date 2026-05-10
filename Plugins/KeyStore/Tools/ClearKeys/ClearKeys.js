/*
	ClearKeys.js
---------------------------------------------------------------------
Clears keys from the store, optionally matching a glob pattern.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ClearKeys';
	Tool.Description = 'Clears keys from the store, optionally matching a glob pattern.';

	Tool.MinimumRole = 'admin';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the store' },
			Glob: { type: 'string', description: 'Optional glob pattern (e.g., "temp_*")' },
		},
		required: [ 'EntityName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
			Error: { type: 'string', description: 'Error text when error' },
			Count: { type: 'number', description: 'Number of keys removed' },
		},
		required: [],
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store_data = await Plugin.LoadStore( Hive, Arguments.EntityName );

		var count = 0;
		var values = store_data.Values || {};

		if ( !Arguments.Glob )
		{
			// Clear all
			count = Object.keys( values ).length;
			store_data.Values = {};
		}
		else
		{
			// Clear matching keys
			var keys_to_delete = [];
			for ( var key in values )
			{
				if ( Hive.Helpers.Strings.MatchGlob( key, Arguments.Glob ) )
				{
					keys_to_delete.push( key );
				}
			}

			for ( var key of keys_to_delete )
			{
				delete values[ key ];
				count++;
			}

			store_data.Values = values;
		}

		await Plugin.SaveStore( Hive, Arguments.EntityName, store_data );

		return { Success: true, Count: count };
	};

	return Tool;
};
