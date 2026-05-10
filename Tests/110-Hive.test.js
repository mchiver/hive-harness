
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );

// Hive Tests


TEST.describe( 'Hive Tests', function ()
{

	//-----------------------------------------------------------------
	TEST.it( 'should open a hive with testuser and password', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		ASSERT.ok( hive, 'hive should be opened' );
		ASSERT.strictEqual( hive.UserName, TEST_CONFIG.Username );
		ASSERT.ok( hive.UserRole, 'should have a role' );
		ASSERT.ok( hive.Token, 'should have a token' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should open a hive without credentials (guest mode)', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, 'guest', null );

		ASSERT.ok( hive, 'hive should be opened' );
		ASSERT.strictEqual( hive.UserName, 'guest' );
		ASSERT.strictEqual( hive.UserRole, 'guest' );
		ASSERT.strictEqual( hive.Token, '' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load plugins on open', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		ASSERT.ok( hive.Plugins, 'should have plugins' );
		ASSERT.ok( Object.keys( hive.Plugins ).length > 0, 'should have at least one plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should expose helpers', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		ASSERT.ok( hive.Helpers.FileUtils, 'should have FileUtils' );
		ASSERT.ok( hive.Helpers.EventBus, 'should have EventBus' );
		ASSERT.ok( hive.Helpers.Humanize, 'should have Humanize' );
		ASSERT.ok( hive.Helpers.Strings, 'should have Strings' );
		ASSERT.ok( hive.Helpers.CommandProcessor, 'should have CommandProcessor' );
		ASSERT.ok( hive.Helpers.Logger, 'should have Logger' );
		ASSERT.ok( hive.Helpers.Fetch, 'should have Fetch' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have an EventBus instance', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		ASSERT.ok( hive.Events, 'should have Events' );
		ASSERT.ok( typeof hive.Events.Subscribe === 'function', 'should have Subscribe' );
		ASSERT.ok( typeof hive.Events.Publish === 'function', 'should have Publish' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return plugin data path', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await hive.GetPluginDataPath( 'TestPlugin' );
		ASSERT.ok( path.indexOf( '.hive' ) > -1, 'should contain .hive' );
		ASSERT.ok( path.indexOf( 'TestPlugin' ) > -1, 'should contain plugin name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return entity data path', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await hive.GetEntityDataPath( 'TestPlugin', 'TestEntity' );
		ASSERT.ok( path.indexOf( 'TestPlugin' ) > -1, 'should contain plugin name' );
		ASSERT.ok( path.indexOf( 'TestEntity' ) > -1, 'should contain entity name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should invoke a tool via InvokeTool', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'System.Info', {} );
		ASSERT.ok( result, 'should return a result' );
		ASSERT.strictEqual( result.Success, true, 'should succeed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for invalid tool name format', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		await ASSERT.rejects( async function ()
		{
			await hive.InvokeTool( 'InvalidToolName', {} );
		}, /Invalid tool name/ );
	} );


} );
