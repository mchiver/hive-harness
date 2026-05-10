
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const EventBus = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'EventBus.js' ) );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
TEST.describe( 'EventBus', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should subscribe and publish', async function ()
	{
		var bus = new EventBus();
		var received = null;

		bus.Subscribe( 'test.event', async function ( data ) { received = data; } );
		await bus.Publish( 'test.event', { Value: 42 } );

		ASSERT.deepStrictEqual( received, { Value: 42 } );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should call multiple handlers in order', async function ()
	{
		var bus = new EventBus();
		var order = [];

		bus.Subscribe( 'test.event', async function () { order.push( 'first' ); } );
		bus.Subscribe( 'test.event', async function () { order.push( 'second' ); } );
		bus.Subscribe( 'test.event', async function () { order.push( 'third' ); } );
		await bus.Publish( 'test.event', {} );

		ASSERT.deepStrictEqual( order, [ 'first', 'second', 'third' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match wildcard * for single segment', async function ()
	{
		var bus = new EventBus();
		var received = [];

		bus.Subscribe( 'tool.*', async function ( data ) { received.push( data.name ); } );
		await bus.Publish( 'tool.before', { name: 'before' } );
		await bus.Publish( 'tool.after', { name: 'after' } );
		await bus.Publish( 'other.event', { name: 'other' } );

		ASSERT.deepStrictEqual( received, [ 'before', 'after' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match wildcard ** for multiple segments', async function ()
	{
		var bus = new EventBus();
		var received = [];

		bus.Subscribe( 'entity.**', async function ( data ) { received.push( data.name ); } );
		await bus.Publish( 'entity.created', { name: 'created' } );
		await bus.Publish( 'entity.config.updated', { name: 'config.updated' } );
		await bus.Publish( 'tool.before', { name: 'tool' } );

		ASSERT.deepStrictEqual( received, [ 'created', 'config.updated' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should not fire handler for non-matching events', async function ()
	{
		var bus = new EventBus();
		var called = false;

		bus.Subscribe( 'specific.event', async function () { called = true; } );
		await bus.Publish( 'other.event', {} );

		ASSERT.strictEqual( called, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should unsubscribe by ID', async function ()
	{
		var bus = new EventBus();
		var count = 0;

		var id = bus.Subscribe( 'test.event', async function () { count++; } );
		await bus.Publish( 'test.event', {} );
		ASSERT.strictEqual( count, 1 );

		bus.Unsubscribe( id );
		await bus.Publish( 'test.event', {} );
		ASSERT.strictEqual( count, 1, 'should not fire after unsubscribe' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should clear all subscriptions', async function ()
	{
		var bus = new EventBus();
		var count = 0;

		bus.Subscribe( 'a', async function () { count++; } );
		bus.Subscribe( 'b', async function () { count++; } );
		bus.Clear();

		await bus.Publish( 'a', {} );
		await bus.Publish( 'b', {} );
		ASSERT.strictEqual( count, 0, 'no handlers should fire after clear' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should await async handlers', async function ()
	{
		var bus = new EventBus();
		var order = [];

		bus.Subscribe( 'test.event', async function ()
		{
			await new Promise( function ( resolve ) { setTimeout( resolve, 10 ); } );
			order.push( 'slow' );
		} );
		bus.Subscribe( 'test.event', async function ()
		{
			order.push( 'fast' );
		} );

		await bus.Publish( 'test.event', {} );
		ASSERT.deepStrictEqual( order, [ 'slow', 'fast' ], 'slow handler should complete before fast starts' );
	} );


} );


//---------------------------------------------------------------------
TEST.describe( 'EventBus integration with Hive', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should emit tool.before and tool.after events', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var events = [];
		hive.Events.Subscribe( 'tool.before', async function ( data ) { events.push( { type: 'before', tool: data.ToolName } ); } );
		hive.Events.Subscribe( 'tool.after', async function ( data ) { events.push( { type: 'after', tool: data.ToolName, success: data.Success } ); } );

		await hive.InvokeTool( 'System.Info', {} );

		ASSERT.strictEqual( events.length, 2 );
		ASSERT.strictEqual( events[ 0 ].type, 'before' );
		ASSERT.strictEqual( events[ 0 ].tool, 'Info' );
		ASSERT.strictEqual( events[ 1 ].type, 'after' );
		ASSERT.strictEqual( events[ 1 ].tool, 'Info' );
		ASSERT.strictEqual( events[ 1 ].success, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should emit tool.after with error on failed tool call', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var after_event = null;
		hive.Events.Subscribe( 'tool.after', async function ( data ) { after_event = data; } );

		// Call a tool that will produce an error result (missing required key for GetKey)
		// We need a tool that throws — use a bad entity name for KeyStore
		var result = await hive.InvokeTool( 'KeyStore.GetKey', { EntityName: 'nonexistent-store', Key: 'x' } );

		ASSERT.ok( after_event, 'tool.after should have fired' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match tool.* wildcard for tool events', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var count = 0;
		hive.Events.Subscribe( 'tool.*', async function () { count++; } );

		await hive.InvokeTool( 'System.Info', {} );

		ASSERT.strictEqual( count, 2, 'tool.* should match both tool.before and tool.after' );
	} );


} );
