const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const Entities = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Entities.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
TEST.describe( 'Entities Module Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should accept valid entity names', function ()
	{
		var valid = [ 'test-entity', 'test_entity', 'TestEntity123', 'a', 'ALLCAPS', '123numeric' ];
		for ( var index = 0; index < valid.length; index++ )
		{
			ASSERT.ok( Entities.IsValidEntityName( valid[ index ] ), `Expected [${valid[ index ]}] to be valid` );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject invalid entity names', function ()
	{
		var invalid = [ '../etc', '..', 'path/to', 'path\\file', './file', '.hidden', '', null, undefined ];
		for ( var index = 0; index < invalid.length; index++ )
		{
			ASSERT.ok( !Entities.IsValidEntityName( invalid[ index ] ), `Expected [${invalid[ index ]}] to be invalid` );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject names longer than 255 characters', function ()
	{
		var long_name = 'a'.repeat( 255 );
		ASSERT.ok( Entities.IsValidEntityName( long_name ), '255-char name should be valid' );

		var too_long = 'a'.repeat( 256 );
		ASSERT.ok( !Entities.IsValidEntityName( too_long ), '256-char name should be invalid' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for invalid names in ValidateEntityName', function ()
	{
		var threw = false;
		try
		{
			Entities.ValidateEntityName( '../etc', 'entity name' );
		}
		catch ( e )
		{
			threw = true;
			ASSERT.ok( e.message.includes( 'Invalid entity name' ), 'Error should mention invalid name' );
		}
		ASSERT.ok( threw, 'Should have thrown for invalid name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should not throw for valid names in ValidateEntityName', function ()
	{
		try
		{
			Entities.ValidateEntityName( 'valid-name', 'entity name' );
		}
		catch ( e )
		{
			ASSERT.fail( 'Should not have thrown for valid name: ' + e.message );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject invalid entity names via ConfigEntity', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: '../etc',
			Settings: { Name: '../etc' },
		} );

		ASSERT.ok( !result.Success, 'ConfigEntity should reject path traversal name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should update existing entity via ConfigEntity', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create entity
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'edit-test',
			Settings: { Name: 'edit-test', Description: 'Original' },
		} );

		// ConfigEntity on existing name is an edit, not an error
		var result = await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'edit-test',
			Settings: { Description: 'Updated' },
		} );

		ASSERT.ok( result.Success, 'ConfigEntity should update existing entity' );
		ASSERT.strictEqual( result.Result.Description, 'Updated' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject invalid names via DeleteEntity', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: '../etc' } );
		ASSERT.ok( !result.Success, 'DeleteEntity should reject invalid name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject invalid current name via RenameEntity', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Conversation.RenameEntity', {
			EntityName: '../etc',
			NewEntityName: 'some-name',
		} );
	 ASSERT.ok( !result.Success, 'RenameEntity should reject invalid current name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject invalid new name via RenameEntity', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create a valid entity first
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'rename-test',
			Settings: { Name: 'rename-test' },
		} );

		var result = await hive.InvokeTool( 'Conversation.RenameEntity', {
			EntityName: 'rename-test',
			NewEntityName: '../etc',
		} );
	 ASSERT.ok( !result.Success, 'RenameEntity should reject invalid new name' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should use centralized GetEntityConfig via plugin', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create an entity
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'getentityconfig-test',
			Settings: { Name: 'getentityconfig-test', Description: 'Test' },
		} );

		// Call a tool that uses GetEntityConfig internally
		var result = await hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: 'getentityconfig-test',
		} );

		// If the entity was found (even if empty history), GetEntityConfig worked
	 ASSERT.ok( result.Success || result.Error.includes( 'not found' ), 'GetEntityConfig should validate and find entity' );

		// Invalid name should fail via GetEntityConfig validation
		var bad_result = await hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: '../etc',
		} );
	 ASSERT.ok( !bad_result.Success, 'GetEntityConfig should reject invalid name' );
	} );


} );