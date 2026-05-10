/*
	Registry.js
---------------------------------------------------------------------
The Registry is a self-contained store that holds plugin templates, user definitions,
and its own configuration. It can be inspected without opening a Hive.

RegistryPath is typically ~/.hives
*/

const PATH = require( 'path' );
const JWT = require( 'jsonwebtoken' );
const BCRYPT = require( 'bcrypt' );

const Plugin = require( './Plugin.js' );
const Tool = require( './Tool.js' );
const Entities = require( './Entities.js' );
const FileUtils = require( '../Helpers/FileUtils.js' );


//---------------------------------------------------------------------
// Registry class
class Registry
{
	//---------------------------------------------------------------------
	constructor( RegistryPath )
	{
		// Registry Properties
		this.RegistryPath = RegistryPath;
		this.Config = {};
		return;
	}


	//---------------------------------------------------------------------
	static async Open( RegistryPath )
	{
		var registry = new Registry( RegistryPath );
		var registry_config_filename = PATH.join( RegistryPath, 'registry.config.json' );
		if ( await FileUtils.FileExists( registry_config_filename ) )
		{
			registry.Config = await FileUtils.ReadJson( registry_config_filename );
		}
		return registry;
	}


	//---------------------------------------------------------------------
	async LoadPlugins()
	{
		// Load registry plugins
		var plugins = {};
		var plugins_folder = PATH.join( this.RegistryPath, 'Plugins' );
		var plugin_names = await FileUtils.ListFolders( plugins_folder );
		for ( var plugin_index = 0; plugin_index < plugin_names.length; plugin_index++ )
		{
			var plugin_name = plugin_names[ plugin_index ];
			if ( is_supressed_name( plugin_name ) ) { continue; } // Skip files with supressed names
			var plugin = new Plugin( this, plugin_name );

			// Initialize plugin with factory. (support redirection links)
			var plugin_folder = PATH.join( this.RegistryPath, 'Plugins', plugin_name );
			var link_filename = PATH.join( plugin_folder, `plugin.link.json` );
			if ( await FileUtils.FileExists( link_filename ) )
			{
				var link = await FileUtils.ReadJson( link_filename );
				plugin_folder = link.Path;
			}
			plugin.SourcePath = plugin_folder;
			var factory_filename = PATH.join( plugin_folder, `${plugin_name}.factory.js` );
			if ( await FileUtils.FileExists( factory_filename ) )
			{
				delete require.cache[ factory_filename ];
				var factory = require( factory_filename );
				factory.Initialize( this, plugin );
			}

			// Load instance management interface
			if ( plugin.EntitySchema )
			{
				// List
				plugin.Tools.ListEntities = new Tool();
				plugin.Tools.ListEntities.ToolName = 'ListEntities';
				plugin.Tools.ListEntities.Description = 'Lists all entities.';
				plugin.Tools.ListEntities.Parameters = {
					type: 'object',
					properties: {},
					required: [],
				};
				plugin.Tools.ListEntities.Returns = {
					type: 'array',
					items: {
						type: "object",
						properties: {
							Name: { type: 'string', description: 'The entity name.' },
							Description: { type: 'string', description: 'The entity description.' },
						}
					},
					required: [],
				};
				plugin.Tools.ListEntities.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.ListEntities( Hive, Plugin );
				};

				// Config
				plugin.Tools.ConfigEntity = new Tool();
				plugin.Tools.ConfigEntity.ToolName = 'ConfigEntity';
				plugin.Tools.ConfigEntity.Description = 'Read, update, and create entity configurations.';
				plugin.Tools.ConfigEntity.MinimumRole = 'admin';
				plugin.Tools.ConfigEntity.Parameters = {
					type: 'object',
					properties: {
						EntityName: { type: 'string', description: 'The entity name.' },
						Settings: plugin.EntitySchema || { type: 'object', description: 'Configuration settings to update.' },
					},
					required: [ 'EntityName' ],
				};
				plugin.Tools.ConfigEntity.Returns = {
					type: 'object',
					description: 'The updated configuration object.',
					required: [],
				};
				plugin.Tools.ConfigEntity.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.ConfigEntity( Hive, Plugin, Arguments.EntityName, Arguments.Settings );
				};

				// Delete
				plugin.Tools.DeleteEntity = new Tool();
				plugin.Tools.DeleteEntity.ToolName = 'DeleteEntity';
				plugin.Tools.DeleteEntity.Description = 'Delete an entity.';
				plugin.Tools.DeleteEntity.MinimumRole = 'owner';
				plugin.Tools.DeleteEntity.Parameters = {
					type: 'object',
					properties: {
						EntityName: { type: 'string', description: 'The entity name.' },
					},
					required: [ 'EntityName' ],
				};
				plugin.Tools.DeleteEntity.Returns = {
					type: 'any',
				};
				plugin.Tools.DeleteEntity.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.DeleteEntity( Hive, Plugin, Arguments.EntityName );
				};

				// Rename
				plugin.Tools.RenameEntity = new Tool();
				plugin.Tools.RenameEntity.ToolName = 'RenameEntity';
				plugin.Tools.RenameEntity.Description = 'Rename an entity.';
				plugin.Tools.RenameEntity.MinimumRole = 'owner';
				plugin.Tools.RenameEntity.Parameters = {
					type: 'object',
					properties: {
						EntityName: { type: 'string', description: 'The entity name.' },
						NewEntityName: { type: 'string', description: 'The new name of the entity.' },
					},
					required: [ 'EntityName', 'NewEntityName' ],
				};
				plugin.Tools.RenameEntity.Returns = {
					type: 'any',
				};
				plugin.Tools.RenameEntity.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.RenameEntity( Hive, Plugin, Arguments.EntityName, Arguments.NewEntityName );
				};

				// Share
				plugin.Tools.ShareEntity = new Tool();
				plugin.Tools.ShareEntity.ToolName = 'ShareEntity';
				plugin.Tools.ShareEntity.Description = 'Promote a user-owned entity to the shared space.';
				plugin.Tools.ShareEntity.MinimumRole = 'owner';
				plugin.Tools.ShareEntity.Parameters = {
					type: 'object',
					properties: {
						EntityName: { type: 'string', description: 'The entity name.' },
					},
					required: [ 'EntityName' ],
				};
				plugin.Tools.ShareEntity.Returns = {
					type: 'any',
				};
				plugin.Tools.ShareEntity.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.ShareEntity( Hive, Plugin, Arguments.EntityName );
				};

				// Unshare
				plugin.Tools.UnshareEntity = new Tool();
				plugin.Tools.UnshareEntity.ToolName = 'UnshareEntity';
				plugin.Tools.UnshareEntity.Description = 'Return a shared entity to its owner\'s user folder.';
				plugin.Tools.UnshareEntity.MinimumRole = 'owner';
				plugin.Tools.UnshareEntity.Parameters = {
					type: 'object',
					properties: {
						EntityName: { type: 'string', description: 'The entity name.' },
					},
					required: [ 'EntityName' ],
				};
				plugin.Tools.UnshareEntity.Returns = {
					type: 'any',
				};
				plugin.Tools.UnshareEntity.Execute = async function ( Hive, Plugin, Arguments )
				{
					return await Entities.UnshareEntity( Hive, Plugin, Arguments.EntityName );
				};
			}

			// Load tools
			var tools_folder = PATH.join( plugin_folder, 'Tools' );
			if ( await FileUtils.FolderExists( tools_folder ) )
			{
				var tool_names = await FileUtils.ListFolders( tools_folder );
				for ( var tool_index = 0; tool_index < tool_names.length; tool_index++ )
				{
					var tool_name = tool_names[ tool_index ];
					if ( is_supressed_name( tool_name ) ) { continue; }
					// Load the tool
					var tool_filename = PATH.join( tools_folder, tool_name, `${tool_name}.js` );
					if ( !await FileUtils.FileExists( tool_filename ) ) { continue; }
					delete require.cache[ tool_filename ];
					var tool = require( tool_filename )( new Tool() );
					// Collect tool
					plugin.Tools[ tool.ToolName ] = tool;
				}
			}

			// Collect plugin
			plugins[ plugin.PluginName ] = plugin;
		}
		return plugins;
	}


	//---------------------------------------------------------------------
	// List all users
	async ListUsers()
	{
		var user_items = []; // { Username, Description, Role }
		var users_folder = PATH.join( this.RegistryPath, 'Users' );
		var filenames = await FileUtils.ListFiles( users_folder );
		for ( var index = 0; index < filenames.length; index++ )
		{
			var user_filename = filenames[ index ];
			if ( is_supressed_name( user_filename ) ) { continue; } // Skip users with supressed names
			var user = await FileUtils.ReadJson( PATH.join( users_folder, user_filename ) );
			user_items.push( {
				Username: PATH.parse( user_filename ).name,
				Description: user.Description,
				Role: user.Role || 'guest',
			} );
		}
		return user_items;
	}


	//---------------------------------------------------------------------
	// Authenticate a user with password or validate a token
	async Authenticate( Username, Credential )
	{
		var users_folder = PATH.join( this.RegistryPath, 'Users' );
		var user_filename = PATH.join( users_folder, `${Username}.json` );
		if ( !await FileUtils.FileExists( user_filename ) )
		{
			throw new Error( 'User not found: ' + Username );
		}
		var user = await FileUtils.ReadJson( user_filename );
		if ( !user )
		{
			throw new Error( 'User not found: ' + Username );
		}

		// If credential looks like a JWT (starts with eyJ), try to validate it
		if ( typeof Credential === 'string' && Credential.startsWith( 'eyJ' ) )
		{
			try
			{
				var decoded = JWT.verify( Credential, user.PasswordHash );
				if ( decoded.Username === Username )
				{
					return {
						Username: Username,
						Role: user.Role || 'guest',
						Token: Credential,
					};
				}
			}
			catch ( e )
			{
				throw new Error( 'Invalid token' );
			}
		}

		// Otherwise, treat as password - compare with bcrypt
		if ( !user.PasswordHash )
		{
			throw new Error( 'User has no password set' );
		}

		var is_valid = await BCRYPT.compare( Credential, user.PasswordHash );
		if ( !is_valid )
		{
			throw new Error( 'Invalid password' );
		}

		// Create JWT token
		var token = JWT.sign(
			{ Username: Username },
			user.PasswordHash,
			{ expiresIn: '24h' }
		);

		return {
			Username: Username,
			Role: user.Role || 'guest',
			Token: token,
		};
	}


} // end class Registry



//---------------------------------------------------------------------
function is_supressed_name( Name )
{
	if ( Name.startsWith( '~' ) ) { return true; } // Supress names that begin with '~'
	if ( Name.startsWith( '_' ) ) { return true; } // Supress names that begin with '_'
	if ( Name.startsWith( '.' ) ) { return true; } // Supress names that begin with '.'
	return false;
}


//---------------------------------------------------------------------
module.exports = Registry;
