
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Channel = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Channel.js' ) );
const TestHive = require( './TestHive.js' );
const CONVERSATION_DATA_PATH = PATH.join( TestHive.HIVE_ROOT, '.hive', 'Entities', TestHive.TESTUSER_NAME, 'Conversation' );


//---------------------------------------------------------------------
// TestChannel — captures output, provides canned input
class TestChannel extends Channel
{
	constructor()
	{
		super();
		this.ChannelName = 'test';
		this.OutputLog = [];
		this.CannedInput = [];
	}

	Output( Message, Type )
	{
		this.OutputLog.push( { Message: Message, Type: Type } );
	}

	async Prompt()
	{
		if ( this.CannedInput.length > 0 ) { return this.CannedInput.shift(); }
		return '';
	}

	async PromptChoice( Message, Items )
	{
		this.OutputLog.push( { Message: Message, Type: 'prompt' } );
		if ( Items.length > 0 ) { return Items[ 0 ].Name || Items[ 0 ]; }
		throw new Error( 'No items to choose from' );
	}

	async Start()
	{
		// No-op for tests
	}

	async Stop()
	{
		// No-op for tests
	}

	ShowHelp()
	{
		this.Output( 'Test channel help', 'text' );
	}
}


//---------------------------------------------------------------------
// Helper: create a pre-initialized TestChannel with Hive open
async function create_test_channel()
{
	var channel = new TestChannel();
	channel.Options = {
		_: [],
		registry: TestHive.REGISTRY_PATH,
		path: TestHive.HIVE_ROOT,
		username: TestHive.TESTUSER_NAME,
		password: TestHive.TESTUSER_PASSWORD,
	};
	await channel.Initialize();
	return channel;
}


//---------------------------------------------------------------------
TEST.describe( 'Channel Base Class Tests', function ()
{

	TEST.afterEach( async function ()
	{
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch {}
	} );


	//=================================================================
	// Initialize
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should initialize Registry and Hive from options', async function ()
	{
		var channel = await create_test_channel();

		ASSERT.ok( channel.Registry, 'should have Registry' );
		ASSERT.ok( channel.Hive, 'should have Hive' );
		ASSERT.strictEqual( channel.UserName, TestHive.TESTUSER_NAME );
		ASSERT.ok( channel.Hive.UserName, 'Hive should have username' );
		ASSERT.ok( channel.Hive.Token, 'Hive should be authenticated' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw when registry path does not exist', async function ()
	{
		var channel = new TestChannel();
		channel.Options = {
			_: [],
			registry: PATH.join( __dirname, 'nonexistent-registry' ),
			path: TestHive.HIVE_ROOT,
			username: TestHive.TESTUSER_NAME,
		};

		await ASSERT.rejects( async function ()
		{
			await channel.Initialize();
		}, /Registry not found/ );
	} );


	//=================================================================
	// ResolveConversation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a new conversation when none exist', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;
		await channel.ResolveConversation( channel.Hive );

		ASSERT.ok( channel.ConversationName, 'should have a conversation name' );
		ASSERT.ok( channel.ConversationName.length > 0, 'name should not be empty' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should use --conversation flag when provided', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;

		// Create a conversation first
		await channel.Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'explicit-convo',
			Settings: { Username: TestHive.TESTUSER_NAME, ChannelName: 'test' },
		} );

		channel.Options.conversation = 'explicit-convo';
		await channel.ResolveConversation( channel.Hive );

		ASSERT.strictEqual( channel.ConversationName, 'explicit-convo' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for nonexistent --conversation', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.conversation = 'does-not-exist';

		await ASSERT.rejects( async function ()
		{
			await channel.ResolveConversation( channel.Hive );
		}, /Conversation not found/ );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should resume the last conversation for user + channel', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;

		// Create a conversation with matching username and channel
		await channel.Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'resume-me',
			Settings: {
				Username: TestHive.TESTUSER_NAME,
				ChannelName: 'test',
				ChatLlm: TestHive.Llm.ChatLlm,
				UsedAt: new Date().toISOString(),
			},
		} );

		await channel.ResolveConversation( channel.Hive );
		ASSERT.strictEqual( channel.ConversationName, 'resume-me' );
	} );


	//=================================================================
	// ResolveChatLlm
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return --llm flag value', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = 'my-llm';

		var result = await channel.ResolveChatLlm( channel.Hive );
		ASSERT.strictEqual( result, 'my-llm' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return plugin DefaultChatLlm when set', async function ()
	{
		var channel = await create_test_channel();
		channel.Hive.Plugins.Conversation.DefaultChatLlm = 'default-llm';

		var result = await channel.ResolveChatLlm( channel.Hive );
		ASSERT.strictEqual( result, 'default-llm' );

		// Clean up
		delete channel.Hive.Plugins.Conversation.DefaultChatLlm;
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw in non-interactive mode when no LLM configured', async function ()
	{
		var channel = await create_test_channel();
		channel.IsInteractive = false;

		await ASSERT.rejects( async function ()
		{
			await channel.ResolveChatLlm( channel.Hive );
		}, /No ChatLlm configured/ );
	} );


	//=================================================================
	// ProcessInput — routing
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should route /Help to HandleCommand', async function ()
	{
		var channel = await create_test_channel();
		await channel.ProcessInput( channel.Hive, '/Help' );

		ASSERT.ok( channel.OutputLog.length > 0, 'should have output' );
		ASSERT.strictEqual( channel.OutputLog[ 0 ].Message, 'Test channel help' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should route exact tool name to invocation', async function ()
	{
		var channel = await create_test_channel();
		await channel.ProcessInput( channel.Hive, 'System.Info' );

		ASSERT.ok( channel.OutputLog.length > 0, 'should have output' );
		ASSERT.strictEqual( channel.OutputLog[ 0 ].Type, 'json' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should route free text to Conversation.Chat', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;
		await channel.ResolveConversation( channel.Hive );

		// Free text that doesn't match a tool or command goes to Chat.
		// Chat may succeed or fail depending on LLM availability,
		// but the key assertion is that it wasn't routed as a tool call.
		await channel.ProcessInput( channel.Hive, 'Why is the sky blue?' );

		ASSERT.ok( channel.OutputLog.length > 0, 'should have output' );
		// Verify it was NOT treated as a tool call (would be 'json' type)
		// It should be either 'text' (Chat response) or 'error' (Chat failure)
		var type = channel.OutputLog[ 0 ].Type;
		ASSERT.ok( type === 'text' || type === 'error', 'should be text or error, not json' );
	} );


	//=================================================================
	// HandleCommand
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should output error for unknown command', async function ()
	{
		var channel = await create_test_channel();
		await channel.HandleCommand( channel.Hive, '/bogus' );

		ASSERT.ok( channel.OutputLog.length > 0 );
		ASSERT.strictEqual( channel.OutputLog[ 0 ].Type, 'error' );
		ASSERT.ok( channel.OutputLog[ 0 ].Message.indexOf( 'bogus' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle /Conversation with no args (list)', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;
		await channel.ResolveConversation( channel.Hive );

		channel.OutputLog = [];
		await channel.HandleCommand( channel.Hive, '/Conversation' );

		ASSERT.ok( channel.OutputLog.length > 0 );
		ASSERT.strictEqual( channel.OutputLog[ 0 ].Type, 'table' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle /NewConversation', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;

		await channel.HandleCommand( channel.Hive, '/NewConversation test-new-convo' );

		ASSERT.strictEqual( channel.ConversationName, 'test-new-convo' );
		ASSERT.ok( channel.OutputLog.some( function ( entry )
		{
			return entry.Message.indexOf( 'test-new-convo' ) > -1;
		} ) );
	} );


	//=================================================================
	// GetSuggestions
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should suggest channel commands for / prefix', async function ()
	{
		var channel = await create_test_channel();
		var suggestions = await channel.GetSuggestions( channel.Hive, '/H' );

		ASSERT.ok( suggestions.indexOf( '/Help' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should suggest tool names for partial input', async function ()
	{
		var channel = await create_test_channel();
		var suggestions = await channel.GetSuggestions( channel.Hive, 'System.I' );

		ASSERT.ok( suggestions.indexOf( 'System.Info' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should suggest entity names after tool name', async function ()
	{
		var channel = await create_test_channel();

		// Create a KeyStore entity so there's something to suggest
		await channel.Hive.InvokeTool( 'KeyStore.ConfigEntity', {
			EntityName: 'suggest-test',
			Settings: {},
		} );

		var suggestions = await channel.GetSuggestions( channel.Hive, 'KeyStore.GetKey ' );
		ASSERT.ok( suggestions.length > 0, 'should have entity suggestions' );
		ASSERT.ok( suggestions.some( function ( s ) { return s.indexOf( 'suggest-test' ) > -1; } ) );

		// Clean up
		await channel.Hive.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: 'suggest-test' } );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return all commands and tools for empty input', async function ()
	{
		var channel = await create_test_channel();
		var suggestions = await channel.GetSuggestions( channel.Hive, '' );

		ASSERT.ok( suggestions.length > 4, 'should have commands + tools' );
		ASSERT.ok( suggestions.indexOf( '/Help' ) > -1, 'should include /Help' );
	} );


	//=================================================================
	// RunTest (dry run)
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should output a dry run report', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TestHive.Llm.ChatLlm;
		await channel.ResolveConversation( channel.Hive );

		channel.OutputLog = [];
		await channel.RunTest( channel.Hive );

		ASSERT.strictEqual( channel.OutputLog.length, 1 );
		ASSERT.strictEqual( channel.OutputLog[ 0 ].Type, 'json' );
		var report = channel.OutputLog[ 0 ].Message;
		ASSERT.ok( report.Registry, 'should have Registry' );
		ASSERT.ok( report.HivePath, 'should have HivePath' );
		ASSERT.ok( report.UserName, 'should have UserName' );
		ASSERT.strictEqual( report.ChannelName, 'test' );
		ASSERT.ok( report.ConversationName, 'should have ConversationName' );
		ASSERT.ok( report.Plugins.length > 0, 'should have plugins' );
		ASSERT.ok( report.ToolCount > 0, 'should have tools' );
	} );


} );
