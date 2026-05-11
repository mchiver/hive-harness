/*
	InstallPlugin.js
---------------------------------------------------------------------
Installs a plugin from the catalog into the registry.
In development mode (project root has ~development file), prefers
copying from a local sibling repo if one exists.
*/

const PATH = require( 'path' );
const CP = require( 'child_process' );
const UTIL = require( 'util' );


var exec_promise = UTIL.promisify( CP.exec );


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'InstallPlugin';
	Tool.Description = 'Installs a plugin from the catalog into the registry.';
	Tool.MinimumRole = 'admin';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			PluginName: { type: 'string', description: 'The plugin to install.' },
		},
		required: [ 'PluginName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'Whether the installation succeeded.' },
			PluginName: { type: 'string', description: 'The installed plugin name.' },
			Path: { type: 'string', description: 'The installed plugin path.' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var plugin_name = Arguments.PluginName;

		// Read the plugin index
		var index_path = PATH.join( __dirname, '..', '..', '..', '..', '..', 'hive-plugins', 'hive-plugins.git', 'index.json' );
		var index_data = [];
		if ( await Hive.Helpers.FileUtils.FileExists( index_path ) )
		{
			index_data = await Hive.Helpers.FileUtils.ReadJson( index_path );
		}

		var entry = null;
		for ( var index = 0; index < index_data.length; index++ )
		{
			if ( index_data[ index ].PluginName === plugin_name )
			{
				entry = index_data[ index ];
				break;
			}
		}

		if ( !entry )
		{
			throw new Error( `Plugin [${plugin_name}] not found in the catalog.` );
		}

		// Check if already installed
		var registry_plugins_folder = PATH.join( Hive.Registry.RegistryPath, 'Plugins' );
		var target_folder = PATH.join( registry_plugins_folder, plugin_name );
		var link_path = PATH.join( target_folder, 'plugin.link.json' );
		if ( await Hive.Helpers.FileUtils.FileExists( link_path ) )
		{
			throw new Error( `Plugin [${plugin_name}] is already installed.` );
		}

		// Determine source
		var project_root = PATH.join( __dirname, '..', '..', '..', '..' );
		var development_file = PATH.join( project_root, '~development' );
		var is_development = await Hive.Helpers.FileUtils.FileExists( development_file );
		var installed_from_local = false;

		if ( is_development )
		{
			var sibling_repo = PATH.join( project_root, '..', 'hive-plugins', `hive-plugin-${plugin_name}.git` );
			if ( await Hive.Helpers.FileUtils.FolderExists( sibling_repo ) )
			{
				await Hive.Helpers.FileUtils.EnsureFolder( target_folder );
				await Hive.Helpers.FileUtils.CopyBranch( sibling_repo, target_folder );
				installed_from_local = true;
			}
		}

		if ( !installed_from_local )
		{
			// Clone from the remote URL
			if ( !entry.PluginUrl )
			{
				throw new Error( `Plugin [${plugin_name}] has no PluginUrl to clone from.` );
			}
			await Hive.Helpers.FileUtils.EnsureFolder( registry_plugins_folder );
			var clone_command = `git clone "${entry.PluginUrl}" "${target_folder}"`;
			var clone_result = await exec_promise( clone_command );
			if ( clone_result.stderr && clone_result.stderr.length > 0 )
			{
				// Non-fatal stderr is common with git progress output
				// Only throw if the folder was not created
				if ( !await Hive.Helpers.FileUtils.FolderExists( target_folder ) )
				{
					throw new Error( `Failed to clone plugin [${plugin_name}]: ${clone_result.stderr}` );
				}
			}
		}

		// Create plugin.link.json
		await Hive.Helpers.FileUtils.WriteJson( link_path, {
			Path: target_folder,
		} );

		return {
			Success: true,
			PluginName: plugin_name,
			Path: target_folder,
		};
	};

	return Tool;
};
