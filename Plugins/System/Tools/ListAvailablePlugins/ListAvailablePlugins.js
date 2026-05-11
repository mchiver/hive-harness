/*
	ListAvailablePlugins.js
---------------------------------------------------------------------
Reads the plugin index from the canonical plugin catalog (fetched over
HTTPS) and returns all known plugins, marking which ones are already
installed in the registry.
*/


const CATALOG_URL = 'https://raw.githubusercontent.com/mchiver/hive-plugins/refs/heads/main/index.json';


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListAvailablePlugins';
	Tool.Description = 'Returns a list of all known plugins from the catalog, indicating which are installed.';

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
						PluginName: { type: 'string', description: 'The plugin name.' },
						PluginUrl: { type: 'string', description: 'The plugin repository URL.' },
						Description: { type: 'string', description: 'The plugin description.' },
						RequiredRole: { type: 'string', description: 'Minimum role required.' },
						IsInstalled: { type: 'boolean', description: 'Whether the plugin is installed in the registry.' },
					},
				},
			},
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var index_data = await Hive.Helpers.Fetch.Get( CATALOG_URL );
		if ( !Array.isArray( index_data ) )
		{
			index_data = [];
		}

		var plugins = [];
		var installed_names = Object.keys( Hive.Plugins );

		for ( var index = 0; index < index_data.length; index++ )
		{
			var entry = index_data[ index ];
			plugins.push( {
				PluginName: entry.PluginName || '',
				PluginUrl: entry.PluginUrl || '',
				Description: entry.Description || '',
				RequiredRole: entry.RequiredRole || 'user',
				IsInstalled: installed_names.includes( entry.PluginName ),
			} );
		}

		return { Plugins: plugins };
	};

	return Tool;
};
