/*
	Entities.js
---------------------------------------------------------------------
Entities are instances of plugin entities.

Entities live under `.hive/Entities/<location>/<PluginName>/<EntityName>/`
where <location> is either `.shared` or a sanitized username.

Each entity carries a `<EntityName>.security.json` sidecar describing
owner, admins, users, and guest access level.
*/

const PATH = require( 'path' );

// Allowed characters in entity and plugin names (alphanumeric, hyphens, underscores).
// This set is safe for both Windows and Linux filesystems.
const VALID_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Shared folder name under .hive/Entities/
const SHARED_FOLDER = '.shared';

// Security level ranks. Higher number = more privilege.
const ACCESS_RANK = {
	'none': 0,
	'user': 1,
	'admin': 2,
	'owner': 3,
};


class Entities
{


	//-----------------------------------------------------------------
	// Validate that a name contains only safe filename characters.
	// Returns true if valid, false otherwise.
	static IsValidEntityName( Name )
	{
		if ( !Name || typeof Name !== 'string' ) { return false; }
		if ( Name.length === 0 ) { return false; }
		if ( Name.length > 255 ) { return false; }
		return VALID_NAME_PATTERN.test( Name );
	}


	//-----------------------------------------------------------------
	// Validate that a name contains only safe filename characters.
	// Throws with a descriptive message if invalid.
	static ValidateEntityName( Name, Label )
	{
		if ( !Entities.IsValidEntityName( Name ) )
		{
			throw new Error(
				`Invalid ${Label}: [${Name}]. ` +
				`Names must contain only letters, numbers, hyphens, and underscores. ` +
				`Do not use paths (../), slashes, or special characters.`
			);
		}
	}


	//-----------------------------------------------------------------
	// Sanitize a username for use as a folder name.
	// Lowercase, non-alphanumeric -> '-', collapse runs, trim edges.
	static SanitizeUsername( Username )
	{
		if ( !Username || typeof Username !== 'string' ) { return ''; }
		var lower = Username.toLowerCase();
		var replaced = lower.replace( /[^a-z0-9]+/g, '-' );
		var trimmed = replaced.replace( /^-+/, '' ).replace( /-+$/, '' );
		return trimmed;
	}


	//-----------------------------------------------------------------
	// Path helpers
	static GetEntitiesRoot( Hive )
	{
		return PATH.join( Hive.DataPath, 'Entities' );
	}


	//-----------------------------------------------------------------
	static GetSharedFolder( Hive )
	{
		return PATH.join( Entities.GetEntitiesRoot( Hive ), SHARED_FOLDER );
	}


	//-----------------------------------------------------------------
	static GetUserFolder( Hive )
	{
		var sanitized = Hive.SanitizedUserName || Entities.SanitizeUsername( Hive.UserName );
		if ( !sanitized ) { sanitized = 'guest'; }
		return PATH.join( Entities.GetEntitiesRoot( Hive ), sanitized );
	}


	//-----------------------------------------------------------------
	static async EnsureSharedFolder( Hive )
	{
		await Hive.Helpers.FileUtils.EnsureFolder( Entities.GetSharedFolder( Hive ) );
	}


	//-----------------------------------------------------------------
	static async EnsureUserFolder( Hive )
	{
		await Hive.Helpers.FileUtils.EnsureFolder( Entities.GetUserFolder( Hive ) );
	}


	//-----------------------------------------------------------------
	// Build the canonical paths for an entity within a given location folder.
	static BuildEntityPaths( LocationFolder, PluginName, EntityName )
	{
		var entity_folder = PATH.join( LocationFolder, PluginName, EntityName );
		return {
			EntityFolder: entity_folder,
			ConfigFile: PATH.join( entity_folder, EntityName + '.entity.json' ),
			SecurityFile: PATH.join( entity_folder, EntityName + '.security.json' ),
		};
	}


	//-----------------------------------------------------------------
	// Locate an entity. Checks the user folder first, then the shared folder.
	// Returns { Found, Location: 'user'|'shared'|null, EntityFolder, ConfigFile, SecurityFile }.
	// If not found, returns the prospective user-folder path (for create flows).
	static async FindEntity( Hive, Plugin, EntityName )
	{
		Entities.ValidateEntityName( EntityName, 'entity name' );
		var plugin_name = Plugin.PluginName;
		var file_utils = Hive.Helpers.FileUtils;

		// Search user folder
		var user_paths = Entities.BuildEntityPaths( Entities.GetUserFolder( Hive ), plugin_name, EntityName );
		if ( await file_utils.FileExists( user_paths.ConfigFile ) )
		{
			return Object.assign( { Found: true, Location: 'user' }, user_paths );
		}

		// Search shared folder
		var shared_paths = Entities.BuildEntityPaths( Entities.GetSharedFolder( Hive ), plugin_name, EntityName );
		if ( await file_utils.FileExists( shared_paths.ConfigFile ) )
		{
			return Object.assign( { Found: true, Location: 'shared' }, shared_paths );
		}

		// Not found — return prospective user-folder paths for creation.
		return Object.assign( { Found: false, Location: null }, user_paths );
	}


	//-----------------------------------------------------------------
	// Load a security block. Returns a default block if the file is missing.
	static async LoadSecurity( Hive, SecurityFile )
	{
		var file_utils = Hive.Helpers.FileUtils;
		if ( await file_utils.FileExists( SecurityFile ) )
		{
			return await file_utils.ReadJson( SecurityFile );
		}
		return Entities.DefaultSecurityBlock( '' );
	}


	//-----------------------------------------------------------------
	static async SaveSecurity( Hive, SecurityFile, Block )
	{
		await Hive.Helpers.FileUtils.WriteJson( SecurityFile, Block );
	}


	//-----------------------------------------------------------------
	// Produce a default security block for a new entity.
	static DefaultSecurityBlock( Owner )
	{
		return {
			owner: Owner || '',
			admins: [],
			users: [],
			guest_access: 'user',
		};
	}


	//-----------------------------------------------------------------
	// Resolve the calling user's effective access level for an entity.
	// Returns 'owner' | 'admin' | 'user' | 'none'.
	static ResolveUserLevel( Security, Username )
	{
		var name = Username || '';
		if ( Security && Security.owner && Security.owner === name ) { return 'owner'; }
		if ( Security && Array.isArray( Security.admins ) && Security.admins.indexOf( name ) > -1 ) { return 'admin'; }
		if ( Security && Array.isArray( Security.users ) && Security.users.indexOf( name ) > -1 ) { return 'user'; }
		var guest = ( Security && Security.guest_access ) || 'none';
		if ( guest !== 'admin' && guest !== 'user' && guest !== 'none' ) { guest = 'none'; }
		return guest;
	}


	//-----------------------------------------------------------------
	// Enforce an access level against an entity. Throws if the calling
	// user's resolved level is below RequiredLevel.
	static async CheckAccess( Hive, Plugin, EntityName, RequiredLevel )
	{
		var find = await Entities.FindEntity( Hive, Plugin, EntityName );
		if ( !find.Found )
		{
			throw new Error( `${Plugin.PluginName} entity [${EntityName}] not found.` );
		}
		var security = await Entities.LoadSecurity( Hive, find.SecurityFile );
		var level = Entities.ResolveUserLevel( security, Hive.UserName );
		var have = ACCESS_RANK[ level ] || 0;
		var need = ACCESS_RANK[ RequiredLevel ] || 0;
		if ( have < need )
		{
			throw new Error(
				`Access denied: [${Hive.UserName || 'guest'}] has '${level}' access on ` +
				`${Plugin.PluginName} entity [${EntityName}], requires '${RequiredLevel}'.`
			);
		}
		return { Level: level, Security: security, Find: find };
	}


	//-----------------------------------------------------------------
	// Check if an entity name is already in use within the plugin
	// (in either the user folder or the shared folder).
	static async EntityNameExists( Hive, Plugin, Name )
	{
		var find = await Entities.FindEntity( Hive, Plugin, Name );
		return find.Found;
	}


	//-----------------------------------------------------------------
	// Internal: list entities present in a single location folder.
	static async ListEntitiesInLocation( Hive, Plugin, LocationFolder, LocationLabel )
	{
		var items = [];
		var file_utils = Hive.Helpers.FileUtils;
		var plugin_folder = PATH.join( LocationFolder, Plugin.PluginName );
		if ( !await file_utils.FolderExists( plugin_folder ) ) { return items; }

		var entity_folders = await file_utils.FindFolders( plugin_folder );
		for ( var index = 0; index < entity_folders.length; index++ )
		{
			var entity_name = entity_folders[ index ];
			if ( !Entities.IsValidEntityName( entity_name ) ) { continue; }
			var entity_filename = PATH.join( plugin_folder, entity_name, `${entity_name}.entity.json` );
			if ( !await file_utils.FileExists( entity_filename ) ) { continue; }

			// Security filter
			var security_filename = PATH.join( plugin_folder, entity_name, `${entity_name}.security.json` );
			var security = await Entities.LoadSecurity( Hive, security_filename );
			var level = Entities.ResolveUserLevel( security, Hive.UserName );
			if ( ( ACCESS_RANK[ level ] || 0 ) === 0 ) { continue; }

			var entity_config = await file_utils.ReadJson( entity_filename );
			items.push( {
				Name: entity_config.Name,
				Description: entity_config.Description,
				Location: LocationLabel,
			} );
		}
		return items;
	}


	//-----------------------------------------------------------------
	// List all entities visible to the calling user (user folder + shared).
	static async ListEntities( Hive, Plugin )
	{
		var user_items = await Entities.ListEntitiesInLocation(
			Hive, Plugin, Entities.GetUserFolder( Hive ), 'user' );
		var shared_items = await Entities.ListEntitiesInLocation(
			Hive, Plugin, Entities.GetSharedFolder( Hive ), 'shared' );
		return user_items.concat( shared_items );
	}


	//-----------------------------------------------------------------
	// Load entity config from disk. Throws if the entity does not exist.
	static async GetEntityConfig( Hive, Plugin, EntityName )
	{
		var find = await Entities.FindEntity( Hive, Plugin, EntityName );
		if ( !find.Found )
		{
			throw new Error( `${Plugin.PluginName} entity [${EntityName}] not found.` );
		}
		return await Hive.Helpers.FileUtils.ReadJson( find.ConfigFile );
	}


	//-----------------------------------------------------------------
	// Read, update, and create entity configurations.
	// New entities are created in the calling user's folder and get a
	// default security block with owner = Hive.UserName.
	static async ConfigEntity( Hive, Plugin, Name, Settings )
	{
		Entities.ValidateEntityName( Name, 'entity name' );
		var file_utils = Hive.Helpers.FileUtils;

		var find = await Entities.FindEntity( Hive, Plugin, Name );

		var entity_config = {};
		if ( find.Found )
		{
			entity_config = await file_utils.ReadJson( find.ConfigFile );
		}
		else
		{
			entity_config = {
				Name: Name,
				Description: '',
			};
		}

		// Merge configs
		entity_config = Object.assign( {}, entity_config, Settings );

		// Save config
		await file_utils.EnsureFolder( find.EntityFolder );
		await file_utils.WriteJson( find.ConfigFile, entity_config );

		// Create a security sidecar for brand-new entities.
		if ( !find.Found )
		{
			var security = Entities.DefaultSecurityBlock( Hive.UserName || '' );
			await Entities.SaveSecurity( Hive, find.SecurityFile, security );
		}

		return entity_config;
	}


	//-----------------------------------------------------------------
	// Delete an entity (from wherever it lives).
	static async DeleteEntity( Hive, Plugin, Name )
	{
		var find = await Entities.FindEntity( Hive, Plugin, Name );
		if ( !find.Found ) { return; }
		await Hive.Helpers.FileUtils.DeleteFolder( find.EntityFolder, true );
	}


	//-----------------------------------------------------------------
	// Rename an entity in place (same location: user->user or shared->shared).
	static async RenameEntity( Hive, Plugin, Name, NewName )
	{
		Entities.ValidateEntityName( NewName, 'new entity name' );
		var file_utils = Hive.Helpers.FileUtils;

		var find = await Entities.FindEntity( Hive, Plugin, Name );
		if ( !find.Found )
		{
			throw new Error( `${Plugin.PluginName} entity [${Name}] not found.` );
		}

		// Make sure the new name is free everywhere.
		if ( await Entities.EntityNameExists( Hive, Plugin, NewName ) )
		{
			throw new Error( `${Plugin.PluginName} entity [${NewName}] already exists.` );
		}

		// Compute destination within the same location.
		var location_folder = PATH.dirname( PATH.dirname( find.EntityFolder ) );
		var new_paths = Entities.BuildEntityPaths( location_folder, Plugin.PluginName, NewName );

		await file_utils.Rename( find.EntityFolder, new_paths.EntityFolder );

		// Rename the two sidecar files inside the new folder.
		var old_config_in_new = PATH.join( new_paths.EntityFolder, Name + '.entity.json' );
		var old_security_in_new = PATH.join( new_paths.EntityFolder, Name + '.security.json' );
		if ( await file_utils.FileExists( old_config_in_new ) )
		{
			await file_utils.Rename( old_config_in_new, new_paths.ConfigFile );
		}
		if ( await file_utils.FileExists( old_security_in_new ) )
		{
			await file_utils.Rename( old_security_in_new, new_paths.SecurityFile );
		}

		// Update Name in the config.
		var config = await file_utils.ReadJson( new_paths.ConfigFile );
		config.Name = NewName;
		await file_utils.WriteJson( new_paths.ConfigFile, config );
	}


	//-----------------------------------------------------------------
	// Promote a user-owned entity to shared space.
	static async ShareEntity( Hive, Plugin, Name )
	{
		var file_utils = Hive.Helpers.FileUtils;
		var find = await Entities.FindEntity( Hive, Plugin, Name );
		if ( !find.Found )
		{
			throw new Error( `${Plugin.PluginName} entity [${Name}] not found.` );
		}
		if ( find.Location === 'shared' )
		{
			throw new Error( `${Plugin.PluginName} entity [${Name}] is already shared.` );
		}

		var dest = Entities.BuildEntityPaths( Entities.GetSharedFolder( Hive ), Plugin.PluginName, Name );
		if ( await file_utils.FolderExists( dest.EntityFolder ) )
		{
			throw new Error( `A shared ${Plugin.PluginName} entity named [${Name}] already exists.` );
		}

		// Ensure the plugin subfolder exists in the shared root.
		await file_utils.EnsureFolder( PATH.join( Entities.GetSharedFolder( Hive ), Plugin.PluginName ) );
		await file_utils.Rename( find.EntityFolder, dest.EntityFolder );
		return { Name: Name, Location: 'shared' };
	}


	//-----------------------------------------------------------------
	// Return a shared entity to its owner's user folder.
	static async UnshareEntity( Hive, Plugin, Name )
	{
		var file_utils = Hive.Helpers.FileUtils;
		var find = await Entities.FindEntity( Hive, Plugin, Name );
		if ( !find.Found )
		{
			throw new Error( `${Plugin.PluginName} entity [${Name}] not found.` );
		}
		if ( find.Location !== 'shared' )
		{
			throw new Error( `${Plugin.PluginName} entity [${Name}] is not shared.` );
		}

		var security = await Entities.LoadSecurity( Hive, find.SecurityFile );
		var owner = security.owner || Hive.UserName || '';
		if ( !owner )
		{
			throw new Error( `Cannot unshare [${Name}]: no owner recorded in security block.` );
		}

		var owner_sanitized = Entities.SanitizeUsername( owner );
		var owner_folder = PATH.join( Entities.GetEntitiesRoot( Hive ), owner_sanitized );
		var dest = Entities.BuildEntityPaths( owner_folder, Plugin.PluginName, Name );

		if ( await file_utils.FolderExists( dest.EntityFolder ) )
		{
			throw new Error( `A ${Plugin.PluginName} entity named [${Name}] already exists in the owner's folder.` );
		}

		await file_utils.EnsureFolder( PATH.join( owner_folder, Plugin.PluginName ) );
		await file_utils.Rename( find.EntityFolder, dest.EntityFolder );
		return { Name: Name, Location: 'user', Owner: owner };
	}


}


//---------------------------------------------------------------------
module.exports = Entities;
