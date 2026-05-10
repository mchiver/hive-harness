
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const CommandProcessor = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'CommandProcessor.js' ) );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.Parse', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should parse plugin name and tool name', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey' );
		ASSERT.strictEqual( result.PluginName, 'KeyStore' );
		ASSERT.strictEqual( result.ToolName, 'GetKey' );
		ASSERT.strictEqual( result.ArgumentText, '' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse argument object style with relaxed JSON', function ()
	{
		var result = CommandProcessor.Parse( "KeyStore.GetKey { EntityName: 'my-store', Key: 'color' }" );
		ASSERT.strictEqual( result.PluginName, 'KeyStore' );
		ASSERT.strictEqual( result.ToolName, 'GetKey' );
		ASSERT.strictEqual( result.Arguments.EntityName, 'my-store' );
		ASSERT.strictEqual( result.Arguments.Key, 'color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse argument object with double quotes', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey { "EntityName": "my-store", "Key": "color" }' );
		ASSERT.strictEqual( result.Arguments.EntityName, 'my-store' );
		ASSERT.strictEqual( result.Arguments.Key, 'color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse argument object with numeric and boolean values', function ()
	{
		var result = CommandProcessor.Parse( "KeyStore.SetKey { EntityName: 'store1', Key: 'count', Value: 42, Active: true }" );
		ASSERT.strictEqual( result.Arguments.EntityName, 'store1' );
		ASSERT.strictEqual( result.Arguments.Key, 'count' );
		ASSERT.strictEqual( result.Arguments.Value, 42 );
		ASSERT.strictEqual( result.Arguments.Active, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse named arguments with -- prefix', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey --EntityName my-store --Key color' );
		ASSERT.strictEqual( result.Arguments.EntityName, 'my-store' );
		ASSERT.strictEqual( result.Arguments.Key, 'color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse named arguments with = syntax', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey EntityName=my-store Key=color' );
		ASSERT.strictEqual( result.Arguments.EntityName, 'my-store' );
		ASSERT.strictEqual( result.Arguments.Key, 'color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse named arguments with quoted values', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.SetKey --EntityName "my store" --Key \'my key\'' );
		ASSERT.strictEqual( result.Arguments.EntityName, 'my store' );
		ASSERT.strictEqual( result.Arguments.Key, 'my key' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse positional arguments', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey my-store color' );
		ASSERT.ok( Array.isArray( result.Arguments ), 'positional args should be an array' );
		ASSERT.strictEqual( result.Arguments[ 0 ], 'my-store' );
		ASSERT.strictEqual( result.Arguments[ 1 ], 'color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse positional arguments with quoted values', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.GetKey "my store" \'my key\'' );
		ASSERT.ok( Array.isArray( result.Arguments ) );
		ASSERT.strictEqual( result.Arguments[ 0 ], 'my store' );
		ASSERT.strictEqual( result.Arguments[ 1 ], 'my key' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse no arguments as empty object', function ()
	{
		var result = CommandProcessor.Parse( 'KeyStore.ListKeys' );
		ASSERT.deepStrictEqual( result.Arguments, {} );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse nested object in argument object style', function ()
	{
		var result = CommandProcessor.Parse( "SqlStore.CreateTable { EntityName: 'db', TableName: 'users', TableSchema: { Columns: [ { Name: 'id', Type: 'INTEGER' } ] } }" );
		ASSERT.strictEqual( result.Arguments.EntityName, 'db' );
		ASSERT.strictEqual( result.Arguments.TableName, 'users' );
		ASSERT.ok( result.Arguments.TableSchema.Columns );
		ASSERT.strictEqual( result.Arguments.TableSchema.Columns[ 0 ].Name, 'id' );
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.Coerce', function ()
{

	var SCHEMA = {
		type: 'object',
		properties: {
			EntityName: { type: 'string' },
			Count: { type: 'number' },
			Active: { type: 'boolean' },
			Options: { type: 'object' },
		},
		required: [ 'EntityName' ],
	};


	//-----------------------------------------------------------------
	TEST.it( 'should map positional array to named object', function ()
	{
		var result = CommandProcessor.Coerce( [ 'my-store', '42', 'true' ], SCHEMA );
		ASSERT.strictEqual( result.EntityName, 'my-store' );
		ASSERT.strictEqual( result.Count, 42 );
		ASSERT.strictEqual( result.Active, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should coerce string to number', function ()
	{
		var result = CommandProcessor.Coerce( { EntityName: 'store', Count: '99' }, SCHEMA );
		ASSERT.strictEqual( result.Count, 99 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should coerce string to boolean', function ()
	{
		var result = CommandProcessor.Coerce( { EntityName: 'store', Active: 'true' }, SCHEMA );
		ASSERT.strictEqual( result.Active, true );

		var result2 = CommandProcessor.Coerce( { EntityName: 'store', Active: 'false' }, SCHEMA );
		ASSERT.strictEqual( result2.Active, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should coerce string to object via relaxed JSON', function ()
	{
		var result = CommandProcessor.Coerce( { EntityName: 'store', Options: "{ Limit: 10 }" }, SCHEMA );
		ASSERT.strictEqual( result.Options.Limit, 10 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should leave already-typed values alone', function ()
	{
		var result = CommandProcessor.Coerce( { EntityName: 'store', Count: 5, Active: false }, SCHEMA );
		ASSERT.strictEqual( result.Count, 5 );
		ASSERT.strictEqual( result.Active, false );
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.Validate', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should validate a known plugin and tool', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = CommandProcessor.Validate( hive, 'KeyStore', 'GetKey', { EntityName: 'x', Key: 'y' } );
		ASSERT.ok( result.Valid );
		ASSERT.ok( result.Plugin );
		ASSERT.ok( result.Tool );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for unknown plugin', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = CommandProcessor.Validate( hive, 'Bogus', 'GetKey', {} );
		ASSERT.ok( !result.Valid );
		ASSERT.ok( result.Error.indexOf( 'Bogus' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for unknown tool', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = CommandProcessor.Validate( hive, 'KeyStore', 'Bogus', {} );
		ASSERT.ok( !result.Valid );
		ASSERT.ok( result.Error.indexOf( 'Bogus' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for missing required parameter', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = CommandProcessor.Validate( hive, 'KeyStore', 'GetKey', { EntityName: 'x' } );
		ASSERT.ok( !result.Valid );
		ASSERT.ok( result.Error.indexOf( 'Key' ) > -1 );
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.Render', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should render simple string arguments', function ()
	{
		var command = CommandProcessor.Render( {
			PluginName: 'KeyStore',
			ToolName: 'GetKey',
			Arguments: { EntityName: 'my-store', Key: 'color' },
		} );
		ASSERT.strictEqual( command, 'KeyStore.GetKey EntityName=my-store Key=color' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should quote values with spaces', function ()
	{
		var command = CommandProcessor.Render( {
			PluginName: 'KeyStore',
			ToolName: 'SetKey',
			Arguments: { EntityName: 'my store', Key: 'color', Value: 'dark blue' },
		} );
		ASSERT.ok( command.indexOf( 'EntityName="my store"' ) > -1 );
		ASSERT.ok( command.indexOf( 'Value="dark blue"' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should render object values as JSON', function ()
	{
		var command = CommandProcessor.Render( {
			PluginName: 'SqlStore',
			ToolName: 'CreateTable',
			Arguments: {
				EntityName: 'db',
				TableName: 'users',
				TableSchema: { Columns: [ { Name: 'id', Type: 'INTEGER' } ] },
			},
		} );
		ASSERT.ok( command.startsWith( 'SqlStore.CreateTable' ) );
		ASSERT.ok( command.indexOf( 'TableSchema=' ) > -1 );
		ASSERT.ok( command.indexOf( '"Columns"' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should render no arguments', function ()
	{
		var command = CommandProcessor.Render( {
			PluginName: 'KeyStore',
			ToolName: 'ListEntities',
			Arguments: {},
		} );
		ASSERT.strictEqual( command, 'KeyStore.ListEntities' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should round-trip with Parse for simple arguments', function ()
	{
		var original = {
			PluginName: 'KeyStore',
			ToolName: 'GetKey',
			Arguments: { EntityName: 'my-store', Key: 'color' },
		};
		var command = CommandProcessor.Render( original );
		var parsed = CommandProcessor.Parse( command );

		ASSERT.strictEqual( parsed.PluginName, original.PluginName );
		ASSERT.strictEqual( parsed.ToolName, original.ToolName );
		ASSERT.strictEqual( parsed.Arguments.EntityName, original.Arguments.EntityName );
		ASSERT.strictEqual( parsed.Arguments.Key, original.Arguments.Key );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should round-trip with Parse for numeric values', function ()
	{
		var original = {
			PluginName: 'Test',
			ToolName: 'Do',
			Arguments: { Name: 'abc', Count: 42 },
		};
		var command = CommandProcessor.Render( original );
		var parsed = CommandProcessor.Parse( command );

		ASSERT.strictEqual( parsed.Arguments.Name, 'abc' );
		// Parsed as string from text — coerce would fix this
		ASSERT.strictEqual( parsed.Arguments.Count, '42' );
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.Invoke (integration)', function ()
{

	var STORE_NAME = 'cmd-test-store';
	var STORE_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'KeyStore', STORE_NAME );


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: STORE_NAME } );

		var data_path = PATH.join( STORE_DATA_FOLDER, STORE_NAME + '.data.json' );
		await FileUtils.EnsureFolder( STORE_DATA_FOLDER );
		await FileUtils.WriteJson( data_path, { Values: {} } );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( STORE_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( STORE_DATA_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should invoke a tool via CommandProcessor.Invoke', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await CommandProcessor.Invoke( hive, 'KeyStore', 'SetKey', {
			EntityName: STORE_NAME,
			Key: 'test_key',
			Value: 'test_value',
		} );

		ASSERT.ok( result.Success, 'invoke should succeed' );
		ASSERT.ok( result.Result.Success, 'tool result should indicate success' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should invoke via Hive.InvokeTool (delegates to CommandProcessor)', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'test_key',
		} );

		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Value, 'test_value' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for unknown plugin via Invoke', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		await ASSERT.rejects(
			async function () { await CommandProcessor.Invoke( hive, 'Bogus', 'GetKey', {} ); },
			function ( error ) { return error.message.indexOf( 'Bogus' ) > -1; }
		);
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.SuggestTools', function ()
{

	var hive;

	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return all tools when ToolName is empty', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, '' );
		ASSERT.ok( results.length > 0, 'should return tools' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match by prefix (case-insensitive)', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, 'system.l' );
		ASSERT.ok( results.length >= 2, 'should match multiple tools' );
		ASSERT.ok( results.indexOf( 'System.ListPlugins' ) > -1 );
		ASSERT.ok( results.indexOf( 'System.ListTools' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match anywhere in the name', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, 'list' );
		ASSERT.ok( results.length >= 2, 'should match tools containing "list"' );
		for ( var index = 0; index < results.length; index++ )
		{
			ASSERT.ok( results[ index ].toLowerCase().indexOf( 'list' ) > -1 );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should be case-insensitive', function ()
	{
		var lower_results = CommandProcessor.SuggestTools( hive, 'system.info' );
		var upper_results = CommandProcessor.SuggestTools( hive, 'SYSTEM.INFO' );
		var mixed_results = CommandProcessor.SuggestTools( hive, 'System.Info' );
		ASSERT.deepStrictEqual( lower_results, upper_results );
		ASSERT.deepStrictEqual( lower_results, mixed_results );
		ASSERT.ok( lower_results.indexOf( 'System.Info' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty for no matches', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, 'xyzzy_no_match' );
		ASSERT.deepStrictEqual( results, [] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return sorted results', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, '' );
		for ( var index = 1; index < results.length; index++ )
		{
			ASSERT.ok( results[ index ] >= results[ index - 1 ], 'results should be sorted' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should not include suppressed plugin names', function ()
	{
		var results = CommandProcessor.SuggestTools( hive, '' );
		for ( var index = 0; index < results.length; index++ )
		{
			var plugin_name = results[ index ].split( '.' )[ 0 ];
			ASSERT.ok( !plugin_name.startsWith( '~' ), 'should not include tilde-prefixed' );
			ASSERT.ok( !plugin_name.startsWith( '_' ), 'should not include underscore-prefixed' );
			ASSERT.ok( !plugin_name.startsWith( '.' ), 'should not include dot-prefixed' );
		}
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'CommandProcessor.SuggestEntities', function ()
{

	var hive;
	var ENTITY_PLUGIN = 'KeyStore';
	var ENTITY_NAME_A = 'suggest-alpha';
	var ENTITY_NAME_B = 'suggest-beta';

	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create test entities
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: ENTITY_NAME_A, Settings: { Description: 'Alpha' } } );
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: ENTITY_NAME_B, Settings: { Description: 'Beta' } } );
	} );

	TEST.after( async function ()
	{
		await hive.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: ENTITY_NAME_A } );
		await hive.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: ENTITY_NAME_B } );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return all entities when EntityName is empty', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, '' );
		ASSERT.ok( results.length >= 2, 'should return entities' );
		ASSERT.ok( results.indexOf( ENTITY_NAME_A ) > -1 );
		ASSERT.ok( results.indexOf( ENTITY_NAME_B ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return all entities when EntityName is null', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, null );
		ASSERT.ok( results.length >= 2 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match by partial name (prefix)', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, 'suggest-a' );
		ASSERT.strictEqual( results.length, 1 );
		ASSERT.strictEqual( results[ 0 ], ENTITY_NAME_A );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match anywhere in the name', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, 'beta' );
		ASSERT.ok( results.length >= 1 );
		ASSERT.ok( results.indexOf( ENTITY_NAME_B ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should be case-insensitive', async function ()
	{
		var lower = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, 'suggest' );
		var upper = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, 'SUGGEST' );
		ASSERT.deepStrictEqual( lower, upper );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty for invalid plugin', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, 'NonexistentPlugin', '' );
		ASSERT.deepStrictEqual( results, [] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty for no matches', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, 'zzz_no_match' );
		ASSERT.deepStrictEqual( results, [] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return sorted results', async function ()
	{
		var results = await CommandProcessor.SuggestEntities( hive, ENTITY_PLUGIN, '' );
		for ( var index = 1; index < results.length; index++ )
		{
			ASSERT.ok( results[ index ] >= results[ index - 1 ], 'results should be sorted' );
		}
	} );


} );
