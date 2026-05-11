/*
	UninstallPlugin.js
---------------------------------------------------------------------
Removes an installed plugin from the registry.
Only deletes the registry copy (and link); the source repository is
left untouched.
Blocked if another installed plugin declares this one as a dependency.
*/

const PATH = require( 'path' );


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'UninstallPlugin';
	Tool.Description = 'Removes an installed plugin from the registry.';
	Tool.MinimumRole = 'admin';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			PluginName: { type: 'string', description: 'The plugin to uninstall.' },
		},
		required: [ 'PluginName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'Whether the uninstallation succeeded.' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var plugin_name = Arguments.PluginName;

		var target_folder = PATH.join( Hive.Registry.RegistryPath, 'Plugins', plugin_name );
		if ( !await Hive.Helpers.FileUtils.FolderExists( target_folder ) )
		{
			throw new Error( `Plugin [${plugin_name}] is not installed.` );
		}

		// Check if any other installed plugin depends on this one
		var plugins_folder = PATH.join( Hive.Registry.RegistryPath, 'Plugins' );
		var installed_names = await Hive.Helpers.FileUtils.ListFolders( plugins_folder );
		for ( var index = 0; index < installed_names.length; index++ )
		{
			var other_name = installed_names[ index ];
			if ( other_name === plugin_name ) { continue; }

			var other_link_path = PATH.join( plugins_folder, other_name, 'plugin.link.json' );
			if ( !await Hive.Helpers.FileUtils.FileExists( other_link_path ) ) { continue; }

			var other_link = await Hive.Helpers.FileUtils.ReadJson( other_link_path );
			if ( !other_link || !other_link.Path ) { continue; }

			var other_factory_path = PATH.join( other_link.Path, `${other_name}.factory.js` );
			if ( !await Hive.Helpers.FileUtils.FileExists( other_factory_path ) ) { continue; }

			// Read the factory to inspect RequiredPlugins
			try
			{
				delete require.cache[ other_factory_path ];
				var factory = require( other_factory_path );
				var dummy_registry = {};
				var dummy_plugin = { PluginName: other_name };
				factory.Initialize( dummy_registry, dummy_plugin );
				if ( dummy_plugin.RequiredPlugins && dummy_plugin.RequiredPlugins.includes( plugin_name ) )
				{
					throw new Error( `Cannot uninstall [${plugin_name}] because [${other_name}] depends on it.` );
				}
			}
			catch ( err )
			{
				// If the error is our dependency error, rethrow it
				if ( err.message && err.message.includes( 'Cannot uninstall' ) )
				{
					throw err;
				}
				// Otherwise ignore factories that fail to load
			}
		}

		// Delete the entire plugin folder from the registry
		var deleted = await Hive.Helpers.FileUtils.DeleteFolder( target_folder, true );
		if ( !deleted )
		{
			throw new Error( `Failed to remove plugin [${plugin_name}] from the registry.` );
		}

		return { Success: true };
	};

	return Tool;
};
