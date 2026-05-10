
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

var AUDIT_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Plugins', 'Audit' );


//---------------------------------------------------------------------
TEST.describe( 'Audit Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		// Clean audit folder before tests.
		if ( await FileUtils.FolderExists( AUDIT_FOLDER ) )
		{
			await FileUtils.DeleteFolder( AUDIT_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		// Clean audit folder after tests.
		if ( await FileUtils.FolderExists( AUDIT_FOLDER ) )
		{
			await FileUtils.DeleteFolder( AUDIT_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	async function open_hive()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
		return hive;
	}


	//=================================================================
	// Append and Get
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should append an event and retrieve it', async function ()
	{
		var hive = await open_hive();

		var append_result = await hive.InvokeTool( 'Audit.Append', {
			EventType: 'Test Event',
			EventData: { Message: 'hello audit' },
		} );

		ASSERT.ok( !append_result.Error, append_result.Error );
		ASSERT.ok( append_result.Result.Success, 'append should succeed' );
		ASSERT.ok( append_result.Result.Time, 'should have a timestamp' );

		var get_result = await hive.InvokeTool( 'Audit.Get', {} );

		ASSERT.ok( !get_result.Error, get_result.Error );
		ASSERT.ok( get_result.Result.Entries.length >= 1, 'should have at least 1 entry' );

		var last_entry = get_result.Result.Entries[ 0 ];
		ASSERT.strictEqual( last_entry.EventType, 'Test Event' );
		ASSERT.strictEqual( last_entry.EventData.Message, 'hello audit' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get entries with MaxEntries limit', async function ()
	{
		var hive = await open_hive();

		// Append several events.
		await hive.InvokeTool( 'Audit.Append', { EventType: 'Batch', EventData: { Index: 1 } } );
		await hive.InvokeTool( 'Audit.Append', { EventType: 'Batch', EventData: { Index: 2 } } );
		await hive.InvokeTool( 'Audit.Append', { EventType: 'Batch', EventData: { Index: 3 } } );

		var result = await hive.InvokeTool( 'Audit.Get', { MaxEntries: 2 } );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Entries.length, 2, 'should return exactly 2 entries' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter by EventType glob', async function ()
	{
		var hive = await open_hive();

		await hive.InvokeTool( 'Audit.Append', { EventType: 'Tool Call', EventData: { Tool: 'ReadFile' } } );
		await hive.InvokeTool( 'Audit.Append', { EventType: 'Tool Error', EventData: { Tool: 'WriteFile' } } );
		await hive.InvokeTool( 'Audit.Append', { EventType: 'User Login', EventData: { User: 'alice' } } );

		var result = await hive.InvokeTool( 'Audit.Get', { EventType: 'Tool*' } );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Entries.length >= 2, 'should match at least 2 Tool* entries' );

		for ( var index = 0; index < result.Result.Entries.length; index++ )
		{
			ASSERT.ok( result.Result.Entries[ index ].EventType.startsWith( 'Tool' ),
				'all entries should match Tool* pattern' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return all entries when no EventType given', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Audit.Get', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Entries.length > 0, 'should return entries' );

		// Verify entries are newest-first.
		for ( var index = 1; index < result.Result.Entries.length; index++ )
		{
			var prev_time = new Date( result.Result.Entries[ index - 1 ].Time );
			var curr_time = new Date( result.Result.Entries[ index ].Time );
			ASSERT.ok( prev_time >= curr_time, 'entries should be newest-first' );
		}
	} );


	//=================================================================
	// GetAgo
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should get entries from a duration ago', async function ()
	{
		var hive = await open_hive();

		// Append a fresh event.
		await hive.InvokeTool( 'Audit.Append', {
			EventType: 'Recent Event',
			EventData: { Fresh: true },
		} );

		// Get events from the last hour.
		var result = await hive.InvokeTool( 'Audit.GetAgo', {
			Duration: '1h',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Entries.length >= 1, 'should have entries from last hour' );

		// Verify entries are oldest-first (chronological).
		for ( var index = 1; index < result.Result.Entries.length; index++ )
		{
			var prev_time = new Date( result.Result.Entries[ index - 1 ].Time );
			var curr_time = new Date( result.Result.Entries[ index ].Time );
			ASSERT.ok( prev_time <= curr_time, 'entries should be oldest-first' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should limit GetAgo with MaxEntries', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Audit.GetAgo', {
			Duration: '1h',
			MaxEntries: 2,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Entries.length <= 2, 'should return at most 2 entries' );
	} );


	//=================================================================
	// GetSince
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should get entries since a timestamp', async function ()
	{
		var hive = await open_hive();

		// Record a timestamp before appending.
		var before_time = new Date().toISOString();

		await hive.InvokeTool( 'Audit.Append', {
			EventType: 'After Marker',
			EventData: { After: true },
		} );

		var result = await hive.InvokeTool( 'Audit.GetSince', {
			Time: before_time,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Entries.length >= 1, 'should have entries since the marker' );

		var found = result.Result.Entries.some( function ( e ) { return e.EventType === 'After Marker'; } );
		ASSERT.ok( found, 'should include the event appended after the timestamp' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should limit GetSince with MaxEntries', async function ()
	{
		var hive = await open_hive();

		// Get with a far-past timestamp but limited entries.
		var result = await hive.InvokeTool( 'Audit.GetSince', {
			Time: '2000-01-01T00:00:00.000Z',
			MaxEntries: 3,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Entries.length, 3, 'should return exactly 3 entries' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter GetSince by EventType glob', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Audit.GetSince', {
			Time: '2000-01-01T00:00:00.000Z',
			EventType: 'After*',
		} );

		ASSERT.ok( !result.Error, result.Error );
		for ( var index = 0; index < result.Result.Entries.length; index++ )
		{
			ASSERT.ok( result.Result.Entries[ index ].EventType.startsWith( 'After' ),
				'all entries should match After* pattern' );
		}
	} );


} );
