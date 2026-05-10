/*
	ListPlugins.js
---------------------------------------------------------------------
Returns a list of loaded plugins with their descriptions.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListPlugins';
	Tool.Description = 'Returns a list of loaded plugins.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {},
		required: [],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Plugins: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						PluginName: { type: 'string', description: 'The plugin name' },
						Description: { type: 'string', description: 'The plugin description' },
						RequiredRole: { type: 'string', description: 'Minimum role required' },
						ToolCount: { type: 'number', description: 'Number of tools in the plugin' },
					},
				},
			},
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var plugins = [];
		for ( var plugin_name in Hive.Plugins )
		{
			var plugin = Hive.Plugins[ plugin_name ];
			plugins.push( {
				PluginName: plugin.PluginName,
				Description: plugin.Description,
				RequiredRole: plugin.RequiredRole,
				ToolCount: Object.keys( plugin.Tools ).length,
				HasEntities: !!plugin.EntitySchema,
			} );
		}
		return { Plugins: plugins };
	};

	return Tool;
};
