
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );

var ENTITY_NAME = 'sql-test-store';
var ENTITY_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'SqlStore', ENTITY_NAME );


//---------------------------------------------------------------------
TEST.describe( 'SqlStore Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create the entity
		await hive.InvokeTool( 'SqlStore.ConfigEntity', { EntityName: ENTITY_NAME } );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		// Clean up the test entity folder
		if ( await FileUtils.FolderExists( ENTITY_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( ENTITY_DATA_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list tables (empty database)', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.ListTables', {
			EntityName: ENTITY_NAME,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Tables ), 'Tables should be an array' );
		ASSERT.strictEqual( result.Result.Tables.length, 0, 'should have no tables initially' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create a table with JSON schema', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.CreateTable', {
			EntityName: ENTITY_NAME,
			TableName: 'users',
			TableSchema: {
				Columns: [
					{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
					{ Name: 'name', Type: 'TEXT', NotNull: true },
					{ Name: 'email', Type: 'TEXT' },
					{ Name: 'score', Type: 'REAL', Default: '0.0' },
				],
			},
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Success, 'result should indicate success' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create a table with raw SQL schema', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.CreateTable', {
			EntityName: ENTITY_NAME,
			TableName: 'logs',
			TableSchema: 'id INTEGER PRIMARY KEY, message TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Success, 'result should indicate success' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list tables after creation', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.ListTables', {
			EntityName: ENTITY_NAME,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Tables.includes( 'users' ), 'should list users table' );
		ASSERT.ok( result.Result.Tables.includes( 'logs' ), 'should list logs table' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get table schema', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.GetTableSchema', {
			EntityName: ENTITY_NAME,
			TableName: 'users',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Columns ), 'should return Columns array' );
		ASSERT.strictEqual( result.Result.Columns.length, 4, 'users table should have 4 columns' );

		var id_column = result.Result.Columns.find( function ( c ) { return c.Name === 'id'; } );
		ASSERT.ok( id_column, 'should have id column' );
		ASSERT.strictEqual( id_column.Type, 'INTEGER', 'id should be INTEGER' );
		ASSERT.ok( id_column.PrimaryKey, 'id should be primary key' );
		ASSERT.ok( id_column.AutoIncrement, 'id should be autoincrement' );

		var name_column = result.Result.Columns.find( function ( c ) { return c.Name === 'name'; } );
		ASSERT.ok( name_column, 'should have name column' );
		ASSERT.ok( name_column.NotNull, 'name should be not null' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for nonexistent table schema', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.GetTableSchema', {
			EntityName: ENTITY_NAME,
			TableName: 'nonexistent',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for missing table' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should round-trip schema (GetTableSchema output usable in CreateTable)', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Get the schema from an existing table
		var schema_result = await hive.InvokeTool( 'SqlStore.GetTableSchema', {
			EntityName: ENTITY_NAME,
			TableName: 'users',
		} );

		// Create a new table from that schema
		var create_result = await hive.InvokeTool( 'SqlStore.CreateTable', {
			EntityName: ENTITY_NAME,
			TableName: 'users_copy',
			TableSchema: schema_result.Result,
		} );

		ASSERT.ok( !create_result.Error, create_result.Error );
		ASSERT.ok( create_result.Result.Success, 'should create table from round-tripped schema' );

		// Verify the copy has the same schema
		var copy_schema = await hive.InvokeTool( 'SqlStore.GetTableSchema', {
			EntityName: ENTITY_NAME,
			TableName: 'users_copy',
		} );

		ASSERT.strictEqual( copy_schema.Result.Columns.length, schema_result.Result.Columns.length, 'column count should match' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute insert and return status', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.ExecuteSql', {
			EntityName: ENTITY_NAME,
			Sql: 'INSERT INTO users ( name, email ) VALUES ( ?, ? )',
			Values: [ 'Alice', 'alice@example.com' ],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.RowsAffected, 1, 'should affect 1 row' );
		ASSERT.ok( result.Result.LastInsertId >= 1, 'should return a LastInsertId' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should query rows', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Insert a couple more rows
		await hive.InvokeTool( 'SqlStore.ExecuteSql', {
			EntityName: ENTITY_NAME,
			Sql: 'INSERT INTO users ( name, email ) VALUES ( ?, ? )',
			Values: [ 'Bob', 'bob@example.com' ],
		} );
		await hive.InvokeTool( 'SqlStore.ExecuteSql', {
			EntityName: ENTITY_NAME,
			Sql: 'INSERT INTO users ( name, email ) VALUES ( ?, ? )',
			Values: [ 'Charlie', 'charlie@example.com' ],
		} );

		// Query all
		var result = await hive.InvokeTool( 'SqlStore.QuerySql', {
			EntityName: ENTITY_NAME,
			Sql: 'SELECT * FROM users ORDER BY name',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Rows.length >= 3, 'should return at least 3 rows' );
		ASSERT.ok( result.Result.Count >= 3, 'Count should match rows' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should query with bound parameters', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.QuerySql', {
			EntityName: ENTITY_NAME,
			Sql: 'SELECT * FROM users WHERE name = ?',
			Values: [ 'Alice' ],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Rows.length, 1, 'should return 1 row' );
		ASSERT.strictEqual( result.Result.Rows[ 0 ].name, 'Alice', 'should be Alice' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should query with paging options', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.QuerySql', {
			EntityName: ENTITY_NAME,
			Sql: 'SELECT * FROM users ORDER BY name',
			Options: { Limit: 2, Offset: 1 },
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Rows.length, 2, 'should return 2 rows with limit' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute update', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.ExecuteSql', {
			EntityName: ENTITY_NAME,
			Sql: 'UPDATE users SET score = ? WHERE name = ?',
			Values: [ 99.5, 'Alice' ],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.RowsAffected, 1, 'should affect 1 row' );

		// Verify
		var query = await hive.InvokeTool( 'SqlStore.QuerySql', {
			EntityName: ENTITY_NAME,
			Sql: 'SELECT score FROM users WHERE name = ?',
			Values: [ 'Alice' ],
		} );
		ASSERT.strictEqual( query.Result.Rows[ 0 ].score, 99.5, 'score should be updated' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute delete', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.ExecuteSql', {
			EntityName: ENTITY_NAME,
			Sql: 'DELETE FROM users WHERE name = ?',
			Values: [ 'Charlie' ],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.RowsAffected, 1, 'should affect 1 row' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a table', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'SqlStore.DeleteTable', {
			EntityName: ENTITY_NAME,
			TableName: 'logs',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'should succeed' );

		// Verify it's gone
		var list_result = await hive.InvokeTool( 'SqlStore.ListTables', {
			EntityName: ENTITY_NAME,
		} );
		ASSERT.ok( !list_result.Result.Tables.includes( 'logs' ), 'logs table should be gone' );
	} );


} );
