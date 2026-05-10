/*
	ListTools.js
---------------------------------------------------------------------
Returns a list of tools, optionally filtered to a single plugin.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListTools';
	Tool.Description = 'Returns a list of available tools.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			PluginName: { type: 'string', description: 'Filter to tools from this plugin only' },
		},
		required: [],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Tools: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						PluginName: { type: 'string', description: 'The plugin name' },
						ToolName: { type: 'string', description: 'The tool name' },
						Description: { type: 'string', description: 'The tool description' },
						Parameters: { type: 'object', description: 'Parameter JSON Schema' },
						Returns: { type: 'object', description: 'Return value JSON Schema' },
					},
				},
			},
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var tools = [];
		var plugin_names = Object.keys( Hive.Plugins );

		// Filter to a single plugin if requested.
		if ( Arguments.PluginName )
		{
			if ( !Hive.Plugins[ Arguments.PluginName ] )
			{
				return { Tools: [] };
			}
			plugin_names = [ Arguments.PluginName ];
		}

		for ( var index = 0; index < plugin_names.length; index++ )
		{
			var plugin = Hive.Plugins[ plugin_names[ index ] ];
			for ( var tool_name in plugin.Tools )
			{
				var tool = plugin.Tools[ tool_name ];
				tools.push( {
					PluginName: plugin.PluginName,
					ToolName: tool.ToolName,
					Description: tool.Description,
					Parameters: tool.Parameters,
					Returns: tool.Returns,
				} );
			}
		}

		return { Tools: tools };
	};

	return Tool;
};
