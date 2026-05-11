/*
	UninstallPlugin.js
---------------------------------------------------------------------
Removes an installed plugin from the registry.
Only deletes the registry copy (and link); the source repository is
left untouched.
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
