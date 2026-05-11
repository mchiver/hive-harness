
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const TestHive = require( './TestHive.js' );


// Hive Tests


TEST.describe( 'Store Plugin Tests', function ()
{

	//-----------------------------------------------------------------
	TEST.it( 'should open a new store', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );
		var result = await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'test-store' } );

		ASSERT.ok( ( !result.Error ), result.Error );
		ASSERT.ok( ( result.Success ), 'store should be created' );
		ASSERT.ok( ( result.Result.Name === 'test-store' ), 'store should have the correct name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should set a custom value', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		var result = await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'test-store', Settings: { test: true } } );
		ASSERT.ok( ( !result.Error ), result.Error );
		ASSERT.ok( ( result.Success ), 'should have configured store' );
		ASSERT.ok( ( result.Result.test === true ), 'store should have custom setting' );

		result = await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'test-store', Settings: { test: false } } );
		ASSERT.ok( ( !result.Error ), result.Error );
		ASSERT.ok( ( result.Success ), 'should have configured store' );
		ASSERT.ok( ( result.Result.test === false ), 'store should have custom setting' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list stores', async function ()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );

		var result = await hive.InvokeTool( 'KeyStore.ListEntities', {} );
		ASSERT.ok( ( !result.Error ), result.Error );
		ASSERT.ok( ( result.Success ), 'should have listed stores' );
		ASSERT.ok( ( result.Result.length > 0 ), 'should have listed stores' );
	} );


} );
