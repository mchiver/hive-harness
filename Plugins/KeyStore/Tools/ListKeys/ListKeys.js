/*
	ListKeys.js
---------------------------------------------------------------------
Lists keys in the store, optionally matching a glob pattern.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListKeys';
	Tool.Description = 'Lists keys in the store, optionally matching a glob pattern.';

	Tool.MinimumRole = 'user';
	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the store' },
			Glob: { type: 'string', description: 'Optional glob pattern (e.g., "user_*")' },
		},
		required: [ 'EntityName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
			Error: { type: 'string', description: 'Error text when error' },
			Keys: {
				type: 'array',
				items: {
					type: "object",
					properties: {
						Key: { type: 'string', description: 'The key for this entry' },
						CreatedAt: { type: 'string', "format": 'date-time', description: 'When this was first added to the store' },
						UpdatedAt: { type: 'string', "format": 'date-time', description: 'When this was last updated in the store' },
					}
				},
				description: 'Array of key entries'
			},
		},
		required: [],
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store_data = await Plugin.LoadStore( Hive, Arguments.EntityName );

		var keys = [];
		var values = store_data.Values || {};

		for ( var key in values )
		{
			if ( Arguments.Glob && !Hive.Helpers.Strings.MatchGlob( key, Arguments.Glob ) )
			{
				continue;
			}

			var entry = values[ key ];
			keys.push( {
				Key: key,
				CreatedAt: entry.CreatedAt,
				UpdatedAt: entry.UpdatedAt,
			} );
		}

		return { Keys: keys };
	};

	return Tool;
};
