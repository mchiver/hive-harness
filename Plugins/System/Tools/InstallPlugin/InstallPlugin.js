/*
	InstallPlugin.js
---------------------------------------------------------------------
Installs a plugin from the catalog or a local folder into the registry.
When installing from the catalog, fetches the canonical index.json over
HTTPS, finds the plugin entry, and clones it using simple-git.
When installing from a local SourcePath, copies the folder directly.
Recursively installs missing dependencies declared in
Plugin.RequiredPlugins (always from the catalog).
*/

const PATH = require( 'path' );
const FS = require( 'fs' );
const SimpleGit = require( 'simple-git' );


const CATALOG_URL = 'https://raw.githubusercontent.com/mchiver/hive-plugins/refs/heads/main/index.json';


//---------------------------------------------------------------------
// Fetch the remote plugin catalog and return it as an array.
async function fetch_catalog( Hive )
{
	var index_data = await Hive.Helpers.Fetch.Get( CATALOG_URL );
	if ( !Array.isArray( index_data ) )
	{
		throw new Error( 'Plugin catalog returned invalid data.' );
	}
	return index_data;
}


//---------------------------------------------------------------------
// Find a plugin entry by name in the catalog data.
function find_catalog_entry( CatalogData, PluginName )
{
	for ( var index = 0; index < CatalogData.length; index++ )
	{
		if ( CatalogData[ index ].PluginName === PluginName )
		{
			return CatalogData[ index ];
		}
	}
	return null;
}


//---------------------------------------------------------------------
// Reads the RequiredPlugins array from a plugin factory at a given path.
// Creates a dummy Registry and Plugin so Factory.Initialize can run safely.
function read_factory_required_plugins( SourcePath, PluginName )
{
	var factory_path = PATH.join( SourcePath, `${PluginName}.factory.js` );
	if ( !FS.existsSync( factory_path ) )
	{
		throw new Error( `Factory not found: ${factory_path}` );
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
	Tool.Description = 'Installs a plugin from the catalog or a local folder into the registry.';
	Tool.MinimumRole = 'admin';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			PluginName: { type: 'string', description: 'The plugin to install.' },
			SourcePath: { type: 'string', description: 'Optional local folder path to install from.' },
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
		var source_path = Arguments.SourcePath || '';
		var registry_plugins_folder = PATH.join( Hive.Registry.RegistryPath, 'Plugins' );
		var target_folder = PATH.join( registry_plugins_folder, plugin_name );
		var link_path = PATH.join( target_folder, 'plugin.link.json' );

		// Already installed — fail
		if ( await Hive.Helpers.FileUtils.FileExists( link_path ) )
		{
			throw new Error( `Plugin [${plugin_name}] is already installed.` );
		}

		var resolved_source_path = null;
		var needs_cleanup = false;

		if ( source_path )
		{
			// Local SourcePath branch
			if ( !await Hive.Helpers.FileUtils.FolderExists( source_path ) )
			{
				throw new Error( `SourcePath does not exist: ${source_path}` );
			}
			var factory_file = PATH.join( source_path, `${plugin_name}.factory.js` );
			if ( !await Hive.Helpers.FileUtils.FileExists( factory_file ) )
			{
				throw new Error( `Factory not found at SourcePath: ${factory_file}` );
			}
			resolved_source_path = source_path;
		}
		else
		{
			// Catalog branch — fetch index, find entry, clone
			var catalog = await fetch_catalog( Hive );
			var entry = find_catalog_entry( catalog, plugin_name );
			if ( !entry )
			{
				throw new Error( `Plugin [${plugin_name}] not found in the catalog.` );
			}
			if ( !entry.PluginUrl )
			{
				throw new Error( `Plugin [${plugin_name}] has no PluginUrl to clone from.` );
			}

			var temp_dir = PATH.join( Hive.Registry.RegistryPath, '.tmp', `install-${plugin_name}-${Date.now()}` );
			await Hive.Helpers.FileUtils.EnsureFolder( temp_dir );

			await SimpleGit().clone( entry.PluginUrl, temp_dir, [ '--depth', '1' ] );

			resolved_source_path = temp_dir;
			needs_cleanup = true;
		}

		// Read dependencies from the factory
		var required_plugins = read_factory_required_plugins( resolved_source_path, plugin_name );
		var installed_dependencies = [];

		// Recursively install missing dependencies (always from catalog)
		for ( var dep_index = 0; dep_index < required_plugins.length; dep_index++ )
		{
			var dep_name = required_plugins[ dep_index ];
			var dep_link = PATH.join( registry_plugins_folder, dep_name, 'plugin.link.json' );
			if ( !await Hive.Helpers.FileUtils.FileExists( dep_link ) )
			{
				var dep_result = await Tool.Execute( Hive, Plugin, { PluginName: dep_name } );
				if ( dep_result.Success )
				{
					installed_dependencies.push( dep_name );
					if ( Array.isArray( dep_result.InstalledDependencies ) )
					{
						installed_dependencies = installed_dependencies.concat( dep_result.InstalledDependencies );
					}
				}
			}
		}

		// Copy source into the registry
		await Hive.Helpers.FileUtils.EnsureFolder( target_folder );
		await Hive.Helpers.FileUtils.CopyBranch( resolved_source_path, target_folder );

		// Clean up temporary clone
		if ( needs_cleanup )
		{
			await Hive.Helpers.FileUtils.DeleteFolder( resolved_source_path, true );
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
