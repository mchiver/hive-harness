
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );
const CONVERSATION_DATA_PATH = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Conversation' );


//---------------------------------------------------------------------
async function open_hive()
{
	var registry = await Registry.Open( TEST_REGISTRY_PATH );
	var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
	return hive;
}


//---------------------------------------------------------------------
async function create_conversation( Hive, Name )
{
	await Hive.InvokeTool( 'Conversation.ConfigEntity', {
		EntityName: Name,
		Settings: {
			Username: TEST_CONFIG.Username,
			ChannelName: 'test',
			ChatLlm: TEST_CONFIG.ChatLlm,
			Skills: [ 'System.ToolUsageSkill' ],
		},
	} );
}


//---------------------------------------------------------------------
TEST.describe( 'Conversation Chat Live Tests — Tool Calling', function ()
{

	TEST.afterEach( async function ()
	{
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch { }
	} );


	//=================================================================
	// Test 1: Guided discovery — LLM uses the built-in tool
	// instructions to discover and call System.Info on its own.
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should discover and call System.Info using built-in tool instructions', async function ()
	{
		var hive = await open_hive();
		await create_conversation( hive, 'toolcall-guided' );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: 'toolcall-guided',
			Text: 'Discover the tools in the System plugin and then use one to tell me my username.',
		} );

		// if ( !result.Success ) { console.log( 'ERROR: ', result ); }

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1, 'should have made at least one tool call' );

		// Should have called System.ListTools at some point
		var list_call = result.Result.ToolCalls.find( function ( c ) { return c.Tool === 'System.ListTools'; } );
		ASSERT.ok( list_call, 'should have called System.ListTools' );
		ASSERT.ok( list_call.Success, 'System.ListTools should have succeeded' );

		// Should have called System.Info
		var info_call = result.Result.ToolCalls.find( function ( c ) { return c.Tool === 'System.Info'; } );
		ASSERT.ok( info_call, 'should have called System.Info' );
		ASSERT.ok( info_call.Success, 'System.Info should have succeeded' );

		// Final response should mention the username
		ASSERT.ok( result.Result.Response.indexOf( 'testuser' ) > -1,
			'final response should mention testuser' );
	} );


	//=================================================================
	// Test 2: Direct tool hint — tell the LLM exactly which tool
	// to call. It still needs to use the discovery format.
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should call System.Info when given a direct hint', async function ()
	{
		var hive = await open_hive();
		await create_conversation( hive, 'toolcall-hint' );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: 'toolcall-hint',
			Text: 'Call the System.Info tool and tell me my username.',
		} );

		// if ( !result.Success ) { console.log( 'ERROR: ', result ); }

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1, 'should have made at least one tool call' );

		// Should have called System.Info (may or may not have called ListTools first)
		var info_call = result.Result.ToolCalls.find( function ( c ) { return c.Tool === 'System.Info'; } );
		ASSERT.ok( info_call, 'should have called System.Info' );
		ASSERT.ok( info_call.Success, 'System.Info should have succeeded' );
		ASSERT.ok( info_call.Result.UserName, 'tool result should contain UserName' );

		// Final response should mention the username
		ASSERT.ok( result.Result.Response.indexOf( 'testuser' ) > -1,
			'final response should mention testuser' );
	} );


	//=================================================================
	// Test 3: EventBus events — verify that Chat emits structured
	// events during execution for SSE streaming.
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should emit EventBus events during Chat execution', async function ()
	{
		var hive = await open_hive();
		await create_conversation( hive, 'toolcall-events' );

		// Collect all conversation.* events
		var events = [];
		var subscription_id = await hive.Events.Subscribe( 'conversation.**', function ( data )
		{
			events.push( data );
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: 'toolcall-events',
			Text: 'Call the System.Info tool and tell me my username.',
		} );

		// Unsubscribe
		hive.Events.Unsubscribe( subscription_id );

		ASSERT.ok( result.Success, 'Chat call should succeed' );

		// Should have conversation.prompt.built event
		var prompt_events = events.filter( function ( e ) { return e.ConversationName === 'toolcall-events' && e.Tokens !== undefined; } );
		ASSERT.ok( prompt_events.length >= 1, 'should have at least one prompt.built event' );
		ASSERT.ok( prompt_events[ 0 ].MessageID, 'prompt.built should have MessageID' );
		ASSERT.ok( typeof prompt_events[ 0 ].Tokens === 'number', 'prompt.built should have numeric Tokens' );

		// Should have conversation.tool.start events
		var tool_start_events = events.filter( function ( e ) { return e.ToolName !== undefined && e.Arguments !== undefined && e.Status === undefined; } );
		ASSERT.ok( tool_start_events.length >= 1, 'should have at least one tool.start event' );
		ASSERT.ok( tool_start_events[ 0 ].ToolName, 'tool.start should have ToolName' );

		// Should have conversation.tool.complete events
		var tool_complete_events = events.filter( function ( e ) { return e.ToolName !== undefined && e.Duration !== undefined; } );
		ASSERT.ok( tool_complete_events.length >= 1, 'should have at least one tool.complete event' );
		ASSERT.ok( tool_complete_events[ 0 ].Status, 'tool.complete should have Status' );
		ASSERT.ok( typeof tool_complete_events[ 0 ].Duration === 'number', 'tool.complete should have numeric Duration' );

		// Should have conversation.response event
		var response_events = events.filter( function ( e ) { return e.Text !== undefined && e.Tokens === undefined && e.ToolName === undefined; } );
		ASSERT.ok( response_events.length >= 1, 'should have at least one response event' );
		ASSERT.ok( response_events[ 0 ].MessageID, 'response should have MessageID' );
		ASSERT.ok( response_events[ 0 ].Text.length > 0, 'response should have non-empty Text' );
	} );


	//=================================================================
	// Test 4: Multi-step discovery — LLM must call ListTools first
	// to discover tools, then call System.Info to answer.
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should perform multi-step discovery: ListTools then Info', async function ()
	{
		var hive = await open_hive();
		await create_conversation( hive, 'toolcall-multi' );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: 'toolcall-multi',
			Text: 'First, discover available tools in the System plugin using System.ListTools with PluginName "System". '
				+ 'Then use the appropriate tool to find out the hive username and tell me what it is.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 2,
			'should have made at least 2 tool calls, got ' + result.Result.ToolCalls.length );

		// First call should be System.ListTools
		var first_call = result.Result.ToolCalls[ 0 ];
		ASSERT.strictEqual( first_call.Tool, 'System.ListTools',
			'first call should be System.ListTools, got ' + first_call.Tool );
		ASSERT.ok( first_call.Success, 'ListTools should have succeeded' );

		// Second call should be System.Info
		var second_call = result.Result.ToolCalls[ 1 ];
		ASSERT.strictEqual( second_call.Tool, 'System.Info',
			'second call should be System.Info, got ' + second_call.Tool );
		ASSERT.ok( second_call.Success, 'System.Info should have succeeded' );

		// Final response should mention the username
		ASSERT.ok( result.Result.Response.indexOf( 'testuser' ) > -1,
			'final response should mention testuser' );
	} );


} );
