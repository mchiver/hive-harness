
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const SqlStore = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'SqlStore.js' ) );
const TEMP_FOLDER = PATH.join( __dirname, '.test-data', '~sqlstore-temp' );


//---------------------------------------------------------------------
TEST.describe( 'SqlStore Helper Tests', function ()
{

	var db;

	TEST.before( async function ()
	{
		await FS.mkdir( TEMP_FOLDER, { recursive: true } );
	} );

	TEST.afterEach( function ()
	{
		if ( db && db.db ) { db.Close(); }
	} );

	TEST.after( async function ()
	{
		await FS.rm( TEMP_FOLDER, { recursive: true, force: true } );
	} );


	//=================================================================
	// Open / Close
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should open and close a database', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'open-test.db' ) );
		ASSERT.ok( db.db, 'database should be open' );
		db.Close();
		ASSERT.strictEqual( db.db, null, 'database should be closed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should apply default pragmas', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'pragma-test.db' ) );
		var journal = db.db.pragma( 'journal_mode' );
		ASSERT.strictEqual( journal[ 0 ].journal_mode, 'wal' );
		var fk = db.db.pragma( 'foreign_keys' );
		ASSERT.strictEqual( fk[ 0 ].foreign_keys, 1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should apply custom options', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'custom-opts.db' ), {
			JournalMode: 'delete',
			ForeignKeys: false,
			BusyTimeout: 5000,
		} );
		var journal = db.db.pragma( 'journal_mode' );
		ASSERT.strictEqual( journal[ 0 ].journal_mode, 'delete' );
		var fk = db.db.pragma( 'foreign_keys' );
		ASSERT.strictEqual( fk[ 0 ].foreign_keys, 0 );
	} );


	//=================================================================
	// CreateTable / ListTables / GetTableSchema / DeleteTable
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a table from Columns schema', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'create-cols.db' ) );
		db.CreateTable( 'items', {
			Columns: [
				{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
				{ Name: 'name', Type: 'TEXT', NotNull: true },
				{ Name: 'value', Type: 'REAL', Default: '0.0' },
			]
		} );
		var tables = db.ListTables();
		ASSERT.ok( tables.indexOf( 'items' ) > -1, 'table should exist' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create a table from raw SQL schema', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'create-sql.db' ) );
		db.CreateTable( 'logs', 'id INTEGER PRIMARY KEY, message TEXT' );
		var tables = db.ListTables();
		ASSERT.ok( tables.indexOf( 'logs' ) > -1, 'table should exist' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for invalid schema', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'bad-schema.db' ) );
		ASSERT.throws( function ()
		{
			db.CreateTable( 'fail', 12345 );
		} );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list tables', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'list-tables.db' ) );
		db.CreateTable( 'alpha', 'id INTEGER PRIMARY KEY' );
		db.CreateTable( 'beta', 'id INTEGER PRIMARY KEY' );
		var tables = db.ListTables();
		ASSERT.deepStrictEqual( tables, [ 'alpha', 'beta' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get table schema with column metadata', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'schema-get.db' ) );
		db.CreateTable( 'test_table', {
			Columns: [
				{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
				{ Name: 'label', Type: 'TEXT', NotNull: true },
			]
		} );
		var schema = db.GetTableSchema( 'test_table' );
		ASSERT.ok( schema, 'schema should be returned' );
		ASSERT.ok( schema.Columns, 'should have Columns' );
		ASSERT.strictEqual( schema.Columns.length, 2 );
		ASSERT.strictEqual( schema.Columns[ 0 ].Name, 'id' );
		ASSERT.strictEqual( schema.Columns[ 0 ].PrimaryKey, true );
		ASSERT.strictEqual( schema.Columns[ 0 ].AutoIncrement, true );
		ASSERT.strictEqual( schema.Columns[ 1 ].Name, 'label' );
		ASSERT.strictEqual( schema.Columns[ 1 ].NotNull, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return null for nonexistent table schema', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'no-schema.db' ) );
		var schema = db.GetTableSchema( 'nope' );
		ASSERT.strictEqual( schema, null );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a table', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'delete-table.db' ) );
		db.CreateTable( 'temp', 'id INTEGER PRIMARY KEY' );
		ASSERT.ok( db.ListTables().indexOf( 'temp' ) > -1 );
		db.DeleteTable( 'temp' );
		ASSERT.strictEqual( db.ListTables().indexOf( 'temp' ), -1 );
	} );


	//=================================================================
	// Execute / Query
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should insert and query rows', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'crud.db' ) );
		db.CreateTable( 'people', 'id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER' );

		var insert_result = db.Execute( 'INSERT INTO people (name, age) VALUES (?, ?)', [ 'Alice', 30 ] );
		ASSERT.strictEqual( insert_result.RowsAffected, 1 );
		ASSERT.ok( insert_result.LastInsertId > 0 );

		var rows = db.Query( 'SELECT * FROM people WHERE name = ?', [ 'Alice' ] );
		ASSERT.strictEqual( rows.length, 1 );
		ASSERT.strictEqual( rows[ 0 ].name, 'Alice' );
		ASSERT.strictEqual( rows[ 0 ].age, 30 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute without parameters', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'no-params.db' ) );
		db.CreateTable( 'data', 'id INTEGER PRIMARY KEY, val TEXT' );
		db.Execute( "INSERT INTO data (id, val) VALUES (1, 'test')" );
		var rows = db.Query( 'SELECT * FROM data' );
		ASSERT.strictEqual( rows.length, 1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should update rows and return affected count', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'update.db' ) );
		db.CreateTable( 'items', 'id INTEGER PRIMARY KEY, status TEXT' );
		db.Execute( "INSERT INTO items (id, status) VALUES (1, 'new')" );
		db.Execute( "INSERT INTO items (id, status) VALUES (2, 'new')" );
		var result = db.Execute( "UPDATE items SET status = 'done'" );
		ASSERT.strictEqual( result.RowsAffected, 2 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete rows', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'delete-rows.db' ) );
		db.CreateTable( 'items', 'id INTEGER PRIMARY KEY' );
		db.Execute( 'INSERT INTO items (id) VALUES (1)' );
		db.Execute( 'INSERT INTO items (id) VALUES (2)' );
		var result = db.Execute( 'DELETE FROM items WHERE id = 1' );
		ASSERT.strictEqual( result.RowsAffected, 1 );
		var rows = db.Query( 'SELECT * FROM items' );
		ASSERT.strictEqual( rows.length, 1 );
	} );


	//=================================================================
	// BuildColumnsSql
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should build SQL from Columns array', function ()
	{
		db = new SqlStore();
		var sql = db.BuildColumnsSql( [
			{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
			{ Name: 'name', Type: 'TEXT', NotNull: true },
			{ Name: 'score', Default: '0' },
		] );
		ASSERT.ok( sql.indexOf( '"id" INTEGER PRIMARY KEY AUTOINCREMENT' ) > -1 );
		ASSERT.ok( sql.indexOf( '"name" TEXT NOT NULL' ) > -1 );
		ASSERT.ok( sql.indexOf( 'DEFAULT 0' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should default column type to TEXT', function ()
	{
		db = new SqlStore();
		var sql = db.BuildColumnsSql( [ { Name: 'field' } ] );
		ASSERT.ok( sql.indexOf( '"field" TEXT' ) > -1 );
	} );


	//=================================================================
	// Schema round-trip
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should round-trip schema through GetTableSchema and CreateTable', function ()
	{
		db = new SqlStore();
		db.Open( PATH.join( TEMP_FOLDER, 'roundtrip.db' ) );
		db.CreateTable( 'original', {
			Columns: [
				{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
				{ Name: 'label', Type: 'TEXT', NotNull: true },
			]
		} );

		var schema = db.GetTableSchema( 'original' );
		db.CreateTable( 'clone', schema );

		var clone_schema = db.GetTableSchema( 'clone' );
		ASSERT.strictEqual( clone_schema.Columns.length, schema.Columns.length );
		ASSERT.strictEqual( clone_schema.Columns[ 0 ].Name, 'id' );
		ASSERT.strictEqual( clone_schema.Columns[ 1 ].Name, 'label' );
	} );


} );
