/*
	InstallPlugin.js
---------------------------------------------------------------------
Installs a plugin from the catalog into the registry.
In development mode (project root has ~development file), prefers
copying from a local sibling repo if one exists.
Recursively installs missing dependencies declared in Plugin.RequiredPlugins.
*/

const PATH = require( 'path' );
const CP = require( 'child_process' );
const UTIL = require( 'util' );
const FS = require( 'fs' );


var exec_promise = UTIL.promisify( CP.exec );


//---------------------------------------------------------------------
// Reads the RequiredPlugins array from a plugin factory at a given path.
// Creates a dummy Registry and Plugin so Factory.Initialize can run safely.
function read_factory_required_plugins( SourcePath, PluginName )
{
	var factory_path = PATH.join( SourcePath, `${PluginName}.factory.js` );
	if ( !FS.existsSync( factory_path ) )
	{
		return [];
	}
	delete require.cache[ factory_path ];
	var factory = require( factory_path );
	var dummy_registry = {};
	var dummy_plugin = { PluginName: PluginName };
	factory.Initialize( dummy_registry, dummy_plugin );
	return dummy_plugin.RequiredPlugins || [];
}


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
			InstalledDependencies: { type: 'array', items: { type: 'string' }, description: 'Names of dependencies that were auto-installed.' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var plugin_name = Arguments.PluginName;
		var registry_plugins_folder = PATH.join( Hive.Registry.RegistryPath, 'Plugins' );
		var target_folder = PATH.join( registry_plugins_folder, plugin_name );
		var link_path = PATH.join( target_folder, 'plugin.link.json' );

		// Already installed — fail
		if ( await Hive.Helpers.FileUtils.FileExists( link_path ) )
		{
			throw new Error( `Plugin [${plugin_name}] is already installed.` );
		}

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

		// Resolve source path (local sibling or temp clone)
		var project_root = PATH.join( __dirname, '..', '..', '..', '..' );
		var development_file = PATH.join( project_root, '~development' );
		var is_development = await Hive.Helpers.FileUtils.FileExists( development_file );
		var source_path = null;
		var needs_cleanup = false;

		if ( is_development )
		{
			var sibling_repo = PATH.join( project_root, '..', 'hive-plugins', `hive-plugin-${plugin_name}.git` );
			if ( await Hive.Helpers.FileUtils.FolderExists( sibling_repo ) )
			{
				source_path = sibling_repo;
			}
		}

		if ( !source_path )
		{
			if ( !entry.PluginUrl )
			{
				throw new Error( `Plugin [${plugin_name}] has no PluginUrl to clone from.` );
			}
			// Clone to a temporary directory so we can inspect the factory
			var temp_dir = PATH.join( Hive.Registry.RegistryPath, '.tmp', `install-${plugin_name}-${Date.now()}` );
			await Hive.Helpers.FileUtils.EnsureFolder( temp_dir );
			var clone_command = `git clone "${entry.PluginUrl}" "${temp_dir}"`;
			var clone_result = await exec_promise( clone_command );
			if ( clone_result.stderr && clone_result.stderr.length > 0 )
			{
				if ( !await Hive.Helpers.FileUtils.FolderExists( temp_dir ) )
				{
					throw new Error( `Failed to clone plugin [${plugin_name}]: ${clone_result.stderr}` );
				}
			}
			source_path = temp_dir;
			needs_cleanup = true;
		}

		// Read dependencies from the factory
		var required_plugins = read_factory_required_plugins( source_path, plugin_name );
		var installed_dependencies = [];

		// Recursively install missing dependencies
		for ( var dep_index = 0; dep_index < required_plugins.length; dep_index++ )
		{
			var dep_name = required_plugins[ dep_index ];
			var dep_link = PATH.join( registry_plugins_folder, dep_name, 'plugin.link.json' );
			if ( !await Hive.Helpers.FileUtils.FileExists( dep_link ) )
			{
				var dep_result = await Tool.Execute( Hive, Plugin, { PluginName: dep_name } );
				if ( dep_result.Success && dep_result.InstalledDependencies )
				{
					installed_dependencies.push( dep_name );
					installed_dependencies = installed_dependencies.concat( dep_result.InstalledDependencies );
				}
			}
		}

		// Copy from source to target
		await Hive.Helpers.FileUtils.EnsureFolder( target_folder );
		await Hive.Helpers.FileUtils.CopyBranch( source_path, target_folder );

		// Clean up temp clone if we used one
		if ( needs_cleanup )
		{
			await Hive.Helpers.FileUtils.DeleteFolder( source_path, true );
		}

		// Create plugin.link.json
		await Hive.Helpers.FileUtils.WriteJson( link_path, {
			Path: target_folder,
		} );

		return {
			Success: true,
			PluginName: plugin_name,
			Path: target_folder,
			InstalledDependencies: installed_dependencies,
		};
	};

	return Tool;
};
