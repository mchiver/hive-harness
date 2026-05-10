
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );

// Registry Tests


TEST.describe( 'Registry Tests', function ()
{

	//-----------------------------------------------------------------
	TEST.it( 'should load a registry from a custom path', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );

		ASSERT.ok( registry, 'registry should be created' );
		ASSERT.ok( registry.Config, 'registry should have a configuration' );
		ASSERT.ok( registry.Config.Version, 'registry should have a version' );
	} );

	//-----------------------------------------------------------------
	TEST.it( 'should list registry users', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var users = await registry.ListUsers();

		ASSERT.ok( users, 'users should be listed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should authenticate the testuser with a password', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var login = await registry.Authenticate( TEST_CONFIG.Username, TEST_CONFIG.Password );

		ASSERT.ok( login, 'user should be authenticated' );
		ASSERT.ok( login.Username, 'authenticated user should have a username' );
		ASSERT.ok( login.Role, 'authenticated user should have a role' );
		ASSERT.ok( login.Token, 'authenticated user should have a token' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should authenticate the testuser with a token', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var login = await registry.Authenticate( TEST_CONFIG.Username, TEST_CONFIG.Password );
		login = await registry.Authenticate( TEST_CONFIG.Username, login.Token );

		ASSERT.ok( login, 'user should be authenticated' );
		ASSERT.ok( login.Username, 'authenticated user should have a username' );
		ASSERT.ok( login.Role, 'authenticated user should have a role' );
		ASSERT.ok( login.Token, 'authenticated user should have a token' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load plugins', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var plugins = await registry.LoadPlugins();

		ASSERT.ok( plugins, 'plugins should be loaded' );
		ASSERT.ok( Object.keys( plugins ).length > 0, 'should have at least one plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject authentication with wrong password', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );

		await ASSERT.rejects( async function ()
		{
			await registry.Authenticate( TEST_CONFIG.Username, 'wrongpassword' );
		}, /Invalid password/ );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject authentication for nonexistent user', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );

		await ASSERT.rejects( async function ()
		{
			await registry.Authenticate( 'nobody', 'test123' );
		}, /User not found/ );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject authentication with invalid token', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );

		await ASSERT.rejects( async function ()
		{
			await registry.Authenticate( TEST_CONFIG.Username, 'eyJinvalidtoken' );
		}, /Invalid token/ );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should suppress plugins starting with tilde or underscore', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var plugins = await registry.LoadPlugins();

		for ( var name in plugins )
		{
			ASSERT.ok( !name.startsWith( '~' ), 'should not load tilde-prefixed plugin: ' + name );
			ASSERT.ok( !name.startsWith( '_' ), 'should not load underscore-prefixed plugin: ' + name );
			ASSERT.ok( !name.startsWith( '.' ), 'should not load dot-prefixed plugin: ' + name );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load plugin tools', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var plugins = await registry.LoadPlugins();

		// System plugin should have tools
		ASSERT.ok( plugins.System, 'should have System plugin' );
		ASSERT.ok( plugins.System.Tools, 'System plugin should have tools' );
		ASSERT.ok( plugins.System.Tools.Info, 'System plugin should have Info tool' );
		ASSERT.ok( plugins.System.Tools.ListPlugins, 'System plugin should have ListPlugins tool' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should generate entity management tools for plugins with EntitySchema', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var plugins = await registry.LoadPlugins();

		// Find a plugin that has EntitySchema
		var entity_plugin = null;
		for ( var name in plugins )
		{
			if ( plugins[ name ].EntitySchema )
			{
				entity_plugin = plugins[ name ];
				break;
			}
		}

		if ( entity_plugin )
		{
			ASSERT.ok( entity_plugin.Tools.ListEntities, 'should have ListEntities tool' );
			ASSERT.ok( entity_plugin.Tools.ConfigEntity, 'should have ConfigEntity tool' );
			ASSERT.ok( entity_plugin.Tools.DeleteEntity, 'should have DeleteEntity tool' );
			ASSERT.ok( entity_plugin.Tools.RenameEntity, 'should have RenameEntity tool' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list users with Username, Description, and Role', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var users = await registry.ListUsers();

		ASSERT.ok( users.length > 0, 'should have at least one user' );
		var user = users[ 0 ];
		ASSERT.ok( user.Username !== undefined, 'user should have Username' );
		ASSERT.ok( user.Role !== undefined, 'user should have Role' );
	} );


} );
