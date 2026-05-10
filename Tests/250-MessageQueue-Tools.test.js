
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

var ENTITY_NAME = 'mq-test-queue';
var ENTITY_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'MessageQueue', ENTITY_NAME );


//---------------------------------------------------------------------
TEST.describe( 'MessageQueue Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
		await hive.InvokeTool( 'MessageQueue.ConfigEntity', { EntityName: ENTITY_NAME } );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( ENTITY_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( ENTITY_DATA_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should publish a message and peek it', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var pub_result = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'order.created',
			Payload: { OrderId: 123, Amount: 99.95 },
		} );

		ASSERT.ok( pub_result.Success, 'publish should succeed' );
		ASSERT.ok( pub_result.Result.MessageId >= 1, 'should return a MessageId' );

		var peek_result = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'order.created',
		} );

		ASSERT.ok( peek_result.Success, 'peek should succeed' );
		ASSERT.ok( peek_result.Result.Messages.length >= 1, 'should see at least 1 message' );
		ASSERT.strictEqual( peek_result.Result.Messages[ 0 ].Payload.OrderId, 123 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should consume and ack a message', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Publish
		await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
			Payload: { TaskId: 'abc' },
		} );

		// Consume
		var consume_result = await hive.InvokeTool( 'MessageQueue.Consume', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
		} );

		ASSERT.ok( consume_result.Success );
		ASSERT.strictEqual( consume_result.Result.Messages.length, 1 );
		var msg_id = consume_result.Result.Messages[ 0 ].MessageId;

		// Ack
		var ack_result = await hive.InvokeTool( 'MessageQueue.Ack', {
			EntityName: ENTITY_NAME,
			MessageId: msg_id,
		} );

		ASSERT.ok( ack_result.Success );
		ASSERT.ok( ack_result.Result.Success );

		// Should no longer be in pending peek
		var peek_result = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
		} );
		ASSERT.strictEqual( peek_result.Result.Messages.length, 0, 'consumed message should not appear in peek' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should subscribe and list subscriptions', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var sub_result = await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'order.*',
			Mode: 'notify',
		} );

		ASSERT.ok( sub_result.Success );
		ASSERT.ok( sub_result.Result.SubscriptionId >= 1 );

		var list_result = await hive.InvokeTool( 'MessageQueue.ListSubscriptions', {
			EntityName: ENTITY_NAME,
		} );

		ASSERT.ok( list_result.Success );
		var found = list_result.Result.Subscriptions.find( function ( s ) { return s.TopicPattern === 'order.*'; } );
		ASSERT.ok( found, 'should find the subscription' );
		ASSERT.strictEqual( found.Mode, 'notify' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should unsubscribe', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var sub_result = await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'temp.*',
			Mode: 'notify',
		} );

		var unsub_result = await hive.InvokeTool( 'MessageQueue.Unsubscribe', {
			EntityName: ENTITY_NAME,
			SubscriptionId: sub_result.Result.SubscriptionId,
		} );

		ASSERT.ok( unsub_result.Success );
		ASSERT.ok( unsub_result.Result.Success );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject and retry a message', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Publish and consume
		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
			Payload: { data: 'retry me' },
		} );
		var consume = await hive.InvokeTool( 'MessageQueue.Consume', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
		} );
		var msg_id = consume.Result.Messages[ 0 ].MessageId;

		// Reject (should retry since MaxRetries defaults to 3)
		var reject_result = await hive.InvokeTool( 'MessageQueue.Reject', {
			EntityName: ENTITY_NAME,
			MessageId: msg_id,
			Reason: 'test failure',
		} );

		ASSERT.ok( reject_result.Success );
		ASSERT.strictEqual( reject_result.Result.Action, 'retried' );

		// Message should be back in pending
		var peek = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
		} );
		ASSERT.ok( peek.Result.Messages.length >= 1, 'retried message should be pending again' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should dead letter a message after max retries', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Publish
		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'dlq.test',
			Payload: { data: 'will fail' },
		} );
		var msg_id = pub.Result.MessageId;

		// Reject 3 times (MaxRetries default is 3)
		for ( var i = 0; i < 3; i++ )
		{
			// Consume first to simulate processing
			await hive.InvokeTool( 'MessageQueue.Consume', { EntityName: ENTITY_NAME, Topic: 'dlq.test' } );
			await hive.InvokeTool( 'MessageQueue.Reject', {
				EntityName: ENTITY_NAME,
				MessageId: msg_id,
				Reason: 'attempt ' + ( i + 1 ),
			} );
		}

		// Should be in dead letters now
		var dlq = await hive.InvokeTool( 'MessageQueue.ListDeadLetters', {
			EntityName: ENTITY_NAME,
			Topic: 'dlq.test',
		} );

		ASSERT.ok( dlq.Success );
		ASSERT.ok( dlq.Result.DeadLetters.length >= 1, 'should have at least 1 dead letter' );
		ASSERT.strictEqual( dlq.Result.DeadLetters[ 0 ].Topic, 'dlq.test' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should invoke-mode subscription auto-dispatch a tool call', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Subscribe with invoke mode — use System.Info as a safe tool to invoke
		await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'invoke.test',
			Mode: 'invoke',
			ToolCall: { PluginName: 'System', ToolName: 'Info', Arguments: {} },
		} );

		// Publish — should auto-invoke System.Info
		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'invoke.test',
			Payload: { trigger: true },
		} );

		ASSERT.ok( pub.Success, 'publish with invoke subscription should succeed' );
		ASSERT.ok( pub.Result.MessageId >= 1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should purge messages by topic', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Publish some messages
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.a', Payload: 1 } );
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.a', Payload: 2 } );
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.b', Payload: 3 } );

		var purge_result = await hive.InvokeTool( 'MessageQueue.PurgeQueue', {
			EntityName: ENTITY_NAME,
			Topic: 'purge.a',
		} );

		ASSERT.ok( purge_result.Success );
		ASSERT.strictEqual( purge_result.Result.Purged, 2, 'should purge 2 messages' );

		// purge.b should still exist
		var peek = await hive.InvokeTool( 'MessageQueue.Peek', { EntityName: ENTITY_NAME, Topic: 'purge.b' } );
		ASSERT.ok( peek.Result.Messages.length >= 1, 'purge.b messages should remain' );
	} );


} );
