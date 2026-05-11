/*
	Hive.js
---------------------------------------------------------------------
Two-layer model:
	HiveRuntime — per-folder, shared: plugins, events, helpers, paths.
	Hive        — per-caller wrapper: Runtime reference + identity.

HiveRuntime.OpenRuntime() is called once per process per folder.
Hive.ForUser( runtime, identity ) is called per request (Web) or
once per session (CLI, Discord).
Hive.Open() is the legacy single-call entry point that builds a
runtime and wraps it for one user — used by CLI, Discord, and the
existing test suite.
Hive.OpenGlobal() opens a named hive that lives inside the registry's
own Hives/ folder (unlinked to any project directory).

Layout:
	.hive/
		Plugins/<PluginName>/<PluginName>.plugin.json
		Entities/.shared/<PluginName>/<EntityName>/...
		Entities/<sanitized-username>/<PluginName>/<EntityName>/...
*/

const PATH = require( 'path' );
const FileUtils = require( '../Helpers/FileUtils.js' );
const EventBus = require( '../Helpers/EventBus.js' );
const Entities = require( './Entities.js' );
const Registry = require( './Registry.js' );
const PACKAGE = require( '../package.json' );


//---------------------------------------------------------------------
// HiveRuntime — shared, per-folder, process-wide.
class HiveRuntime
{


	//---------------------------------------------------------------------
	constructor( Registry, HiveRoot )
	{
		this.Registry = Registry;
		this.HiveRoot = HiveRoot;
		this.DataPath = PATH.join( HiveRoot, '.hive' );
		this.HarnessVersion = PACKAGE.version;
		this.IsDevelopment = false;

		this.Events = new EventBus();

		var helpers_folder = PATH.join( __dirname, '..', 'Helpers' );
		this.Helpers = {
			EventBus: EventBus,
			Fetch: require( PATH.join( helpers_folder, 'Fetch.js' ) ),
			FileUtils: require( PATH.join( helpers_folder, 'FileUtils.js' ) ),
			Humanize: require( PATH.join( helpers_folder, 'Humanize.js' ) ),
			Logger: require( PATH.join( helpers_folder, 'Logger' ) ),
			Strings: require( PATH.join( helpers_folder, 'Strings.js' ) ),
			CommandProcessor: require( PATH.join( helpers_folder, 'CommandProcessor.js' ) ),
			SqlStore: require( PATH.join( helpers_folder, 'SqlStore.js' ) ),
		};

		this.Plugins = {};

		return;
	}


	//---------------------------------------------------------------------
	// Build a runtime for a hive folder. No user context.
	static async OpenRuntime( Registry, HiveRoot )
	{
		var runtime = new HiveRuntime( Registry, HiveRoot );

		// Detect development environment.
		var development_file = PATH.join( __dirname, '..', '..', '~development' );
		runtime.IsDevelopment = await FileUtils.FileExists( development_file );

		runtime.Plugins = await runtime.Registry.LoadPlugins();

		await FileUtils.EnsureFolder( runtime.DataPath );
		await FileUtils.EnsureFolder( PATH.join( runtime.DataPath, 'Plugins' ) );

		// Bootstrap Hive (no user) for shared-folder setup.
		var bootstrap_hive = Hive.ForUser( runtime, {} );
		await Entities.EnsureSharedFolder( bootstrap_hive );

		// Install plugins (load per-hive plugin config).
		for ( var plugin_name in runtime.Plugins )
		{
			var plugin = runtime.Plugins[ plugin_name ];
			var plugin_folder = PATH.join( runtime.DataPath, 'Plugins', plugin.PluginName );
			var config_filename = PATH.join( plugin_folder, `${plugin.PluginName}.plugin.json` );
			if ( await FileUtils.FileExists( config_filename ) )
			{
				var config = await FileUtils.ReadJson( config_filename );
				Object.assign( plugin, config );
			}
		}

		return runtime;
	}


} // end class HiveRuntime


//---------------------------------------------------------------------
// Hive — per-caller wrapper: Runtime reference + identity.
// Shared fields (Registry, HiveRoot, DataPath, Events, Helpers,
// Plugins) are exposed as getters that delegate to the Runtime so
// existing call sites keep working unchanged.
class Hive
{


	//---------------------------------------------------------------------
	constructor( Runtime, Identity )
	{
		if ( !Runtime ) { throw new Error( 'Hive requires a Runtime.' ); }
		this.Runtime = Runtime;

		var identity = Identity || {};
		this.UserName = identity.UserName || '';
		this.SanitizedUserName = identity.SanitizedUserName
			|| Entities.SanitizeUsername( this.UserName );
		this.UserRole = identity.UserRole || 'guest';
		this.Token = identity.Token || '';

		return;
	}


	//---------------------------------------------------------------------
	// Shared infrastructure — delegated to the Runtime so that any
	// per-request Hive sees the same Plugins/Events/Helpers.
	get Registry()        { return this.Runtime.Registry; }
	get HiveRoot()        { return this.Runtime.HiveRoot; }
	get DataPath()        { return this.Runtime.DataPath; }
	get HarnessVersion()  { return this.Runtime.HarnessVersion; }
	get IsDevelopment()   { return this.Runtime.IsDevelopment; }
	get Events()          { return this.Runtime.Events; }
	get Helpers()         { return this.Runtime.Helpers; }
	get Plugins()         { return this.Runtime.Plugins; }


	//---------------------------------------------------------------------
	// Build a Hive for a given user over an existing runtime.
	// Cheap — safe to call per request.
	static ForUser( Runtime, Identity )
	{
		return new Hive( Runtime, Identity );
	}


	//---------------------------------------------------------------------
	// Open a Hive for a given folder. If no Username is supplied and the
	// registry has a 'default' user, that user is used as the implicit
	// identity (zero-config flow).
	static async Open( Registry, HiveRoot, Username, Credential )
	{
		var runtime = await HiveRuntime.OpenRuntime( Registry, HiveRoot );

		var resolved_username = Username || '';
		var resolved_credential = Credential || null;

		// Zero-config fallback: if no username is given but a 'default' user exists,
		// use it. Credential is optional (default user is typically passwordless).
		if ( !resolved_username )
		{
			var users = await Registry.ListUsers();
			for ( var index = 0; index < users.length; index++ )
			{
				if ( users[ index ].Username === 'default' )
				{
					resolved_username = 'default';
					break;
				}
			}
		}

		var identity = {
			UserName: resolved_username,
			SanitizedUserName: Entities.SanitizeUsername( resolved_username ),
			UserRole: 'guest',
			Token: '',
		};

		// Authenticate when we have a username. Passwordless users succeed
		// without a credential; password-protected users require one.
		if ( resolved_username )
		{
			var auth = await Registry.Authenticate( resolved_username, resolved_credential );
			identity.UserName = auth.Username;
			identity.SanitizedUserName = Entities.SanitizeUsername( auth.Username );
			identity.UserRole = auth.Role;
			identity.Token = auth.Token;
		}

		var hive = new Hive( runtime, identity );

		if ( hive.SanitizedUserName )
		{
			await Entities.EnsureUserFolder( hive );
		}

		return hive;
	}


	//---------------------------------------------------------------------
	// Open a named global hive that lives inside the registry's own
	// Hives/ folder (unlinked to any project directory).
	// If no registry is supplied, the default registry is ensured at
	// ~/.hives (or HIVE_REGISTRY) and used.
	static async OpenGlobal( Name, Username, Credential, RegistryInstance )
	{
		if ( !Name ) { throw new Error( 'OpenGlobal requires a hive Name.' ); }

		var registry = RegistryInstance;
		if ( !registry )
		{
			registry = await Registry.EnsureDefault();
		}

		var hive_root = PATH.join( registry.RegistryPath, 'Hives', Name );
		await FileUtils.EnsureFolder( hive_root );

		return await Hive.Open( registry, hive_root, Username, Credential );
	}


	//---------------------------------------------------------------------
	async GetPluginDataPath( PluginName )
	{
		return PATH.join( this.DataPath, 'Plugins', PluginName );
	}


	//---------------------------------------------------------------------
	// Resolves to the user folder if the entity lives there, otherwise
	// the shared folder, otherwise the prospective user-folder path
	// (for create flows).
	async GetEntityDataPath( PluginName, EntityName )
	{
		var plugin = this.Plugins[ PluginName ] || { PluginName: PluginName };
		var find = await Entities.FindEntity( this, plugin, EntityName );
		return find.EntityFolder;
	}


	//---------------------------------------------------------------------
	// Locate an entity. Returns { Found, Location, EntityFolder, ConfigFile, SecurityFile }.
	async FindEntity( PluginName, EntityName )
	{
		var plugin = this.Plugins[ PluginName ] || { PluginName: PluginName };
		return await Entities.FindEntity( this, plugin, EntityName );
	}


	//---------------------------------------------------------------------
	// Read the configuration object for a named entity belonging to a plugin.
	async GetEntityConfig( PluginName, EntityName )
	{
		var plugin = this.Plugins[ PluginName ] || { PluginName: PluginName };
		return await Entities.GetEntityConfig( this, plugin, EntityName );
	}


	//---------------------------------------------------------------------
	async InvokeTool( ToolName, Arguments )
	{
		var parts = ToolName.split( '.' );
		if ( parts.length !== 2 ) { throw new Error( `Invalid tool name, expecting '<plugin-name>.<tool-name>'.` ); }
		return await this.Helpers.CommandProcessor.Invoke( this, parts[ 0 ], parts[ 1 ], Arguments );
	}


} // end class Hive


//---------------------------------------------------------------------
module.exports = Hive;
module.exports.HiveRuntime = HiveRuntime;
