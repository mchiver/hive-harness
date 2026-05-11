
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );

const TestHive = require( './TestHive.js' );

// Hive Tests


TEST.describe( 'Hive Tests', function ()
{

	//-----------------------------------------------------------------
	TEST.it( 'should open a hive with testuser and password', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		ASSERT.ok( hive, 'hive should be opened' );
		ASSERT.strictEqual( hive.UserName, TestHive.TESTUSER_NAME );
		ASSERT.ok( hive.UserRole, 'should have a role' );
		ASSERT.ok( hive.Token, 'should have a token' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should open a hive with the default user (no credentials)', async function ()
	{
		var hive = await TestHive.Open();

		ASSERT.ok( hive, 'hive should be opened' );
		ASSERT.strictEqual( hive.UserName, 'default' );
		ASSERT.strictEqual( hive.UserRole, 'user' );
		ASSERT.strictEqual( hive.Token, '' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load plugins on open', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		ASSERT.ok( hive.Plugins, 'should have plugins' );
		ASSERT.ok( Object.keys( hive.Plugins ).length > 0, 'should have at least one plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should expose harness helpers and version on the hive', async function ()
	{
		var hive = await TestHive.Open();

		ASSERT.strictEqual( typeof hive.Helpers.SqlStore, 'function' );
		ASSERT.strictEqual( typeof hive.Helpers.FileUtils, 'object' );
		ASSERT.ok( hive.HarnessVersion, 'should expose HarnessVersion' );
		ASSERT.strictEqual( typeof hive.GetEntityConfig, 'function' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should root the hive inside <registry>/Hives/test', async function ()
	{
		var hive = await TestHive.Open();

		ASSERT.strictEqual( hive.HiveRoot, TestHive.HIVE_ROOT );
	} );


} );
