
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TestHive = require( './TestHive.js' );

var STORE_NAME = 'tool-test-store';
var STORE_DATA_FOLDER = PATH.join( TestHive.HIVE_ROOT, '.hive', 'Entities', TestHive.TESTUSER_NAME, 'KeyStore', STORE_NAME );


//---------------------------------------------------------------------
TEST.describe( 'Store Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		// Create the store entity and its data file via tools
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Create the entity
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: STORE_NAME } );

		// Create the data file with empty values
		var data_path = PATH.join( STORE_DATA_FOLDER, STORE_NAME + '.data.json' );
		await FileUtils.EnsureFolder( STORE_DATA_FOLDER );
		await FileUtils.WriteJson( data_path, { Values: {} } );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		// Clean up the test store
		if ( await FileUtils.FolderExists( STORE_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( STORE_DATA_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should set a key', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		var result = await hive.InvokeTool( 'KeyStore.SetKey', {
			EntityName: STORE_NAME,
			Key: 'greeting',
			Value: 'hello world',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Success, 'result should indicate success' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get a key', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set first
		await hive.InvokeTool( 'KeyStore.SetKey', {
			EntityName: STORE_NAME,
			Key: 'color',
			Value: 'blue',
		} );

		// Get
		var result = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'color',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Value, 'blue', 'should return the stored value' );
		ASSERT.ok( result.Result.CreatedAt, 'should have CreatedAt timestamp' );
		ASSERT.ok( result.Result.UpdatedAt, 'should have UpdatedAt timestamp' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for missing key', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		var result = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'nonexistent',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for missing key' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should update an existing key and preserve CreatedAt', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set initial value
		await hive.InvokeTool( 'KeyStore.SetKey', {
			EntityName: STORE_NAME,
			Key: 'counter',
			Value: 1,
		} );

		// Read CreatedAt
		var first = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'counter',
		} );
		var created_at = first.Result.CreatedAt;

		// Update
		await hive.InvokeTool( 'KeyStore.SetKey', {
			EntityName: STORE_NAME,
			Key: 'counter',
			Value: 2,
		} );

		// Read again
		var second = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'counter',
		} );

		ASSERT.strictEqual( second.Result.Value, 2, 'value should be updated' );
		ASSERT.strictEqual( second.Result.CreatedAt, created_at, 'CreatedAt should be preserved' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list keys', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set a few keys
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'list_a', Value: 1 } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'list_b', Value: 2 } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'list_c', Value: 3 } );

		var result = await hive.InvokeTool( 'KeyStore.ListKeys', { EntityName: STORE_NAME } );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Keys.length >= 3, 'should list at least 3 keys' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list keys with glob filter', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set keys with a pattern
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'user_name', Value: 'alice' } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'user_age', Value: 30 } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'other_val', Value: 'x' } );

		var result = await hive.InvokeTool( 'KeyStore.ListKeys', {
			EntityName: STORE_NAME,
			Glob: 'user_*',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Keys.length >= 2, 'should match at least 2 user_ keys' );

		var key_names = result.Result.Keys.map( function ( entry ) { return entry.Key; } );
		ASSERT.ok( key_names.includes( 'user_name' ), 'should include user_name' );
		ASSERT.ok( key_names.includes( 'user_age' ), 'should include user_age' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a key', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set then delete
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'to_delete', Value: 'bye' } );

		var result = await hive.InvokeTool( 'KeyStore.DeleteKey', {
			EntityName: STORE_NAME,
			Key: 'to_delete',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Success, 'result should indicate success' );

		// Verify it's gone
		var get_result = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'to_delete',
		} );
		ASSERT.strictEqual( get_result.Success, false, 'deleted key should not be found' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error when deleting nonexistent key', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		var result = await hive.InvokeTool( 'KeyStore.DeleteKey', {
			EntityName: STORE_NAME,
			Key: 'does_not_exist',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for missing key' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should clear all keys', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set some keys
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'clear_a', Value: 1 } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'clear_b', Value: 2 } );

		var result = await hive.InvokeTool( 'KeyStore.ClearKeys', { EntityName: STORE_NAME } );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Success, 'result should indicate success' );
		ASSERT.ok( result.Result.Count >= 2, 'should have cleared at least 2 keys' );

		// Verify empty
		var list_result = await hive.InvokeTool( 'KeyStore.ListKeys', { EntityName: STORE_NAME } );
		ASSERT.strictEqual( list_result.Result.Keys.length, 0, 'should have no keys left' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should clear keys matching a glob', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		// Set keys
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'temp_1', Value: 'a' } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'temp_2', Value: 'b' } );
		await hive.InvokeTool( 'KeyStore.SetKey', { EntityName: STORE_NAME, Key: 'keep_this', Value: 'c' } );

		var result = await hive.InvokeTool( 'KeyStore.ClearKeys', {
			EntityName: STORE_NAME,
			Glob: 'temp_*',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Count, 2, 'should have cleared 2 temp keys' );

		// Verify keep_this survived
		var get_result = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'keep_this',
		} );
		ASSERT.strictEqual( get_result.Result.Value, 'c', 'non-matching key should survive' );
	} );


} );
