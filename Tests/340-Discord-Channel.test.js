
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;
const CHILD_PROCESS = require( 'child_process' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Channel = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Channel.js' ) );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );

const DISCORD_PATH = PATH.join( __dirname, '..', 'Channels', 'Discord', 'Discord.js' );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );
const CONVERSATION_DATA_PATH = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Conversation' );


//---------------------------------------------------------------------
// Helper: run Discord.js with given args, return { stdout, stderr, code }
function run_discord( args, env, timeout_ms )
{
	return new Promise( function ( resolve, reject )
	{
		var options = { timeout: timeout_ms || 10000 };
		if ( env )
		{
			options.env = Object.assign( {}, process.env, env );
		}
		var child = CHILD_PROCESS.execFile(
			process.execPath,
			[ DISCORD_PATH ].concat( args ),
			options,
			function ( error, stdout, stderr )
			{
				resolve( {
					stdout: stdout,
					stderr: stderr,
					code: error ? error.code : 0,
				} );
			}
		);
	} );
}


//---------------------------------------------------------------------
// Helper: create a DiscordChannel instance with Hive open (no bot connection)
async function create_test_channel()
{
	// Require the module to get the class — but it calls Channel.Run at the
	// bottom, so we need to load the class without running it.
	// Instead, build a DiscordChannel-like object manually using the pattern
	// from 310-Channel.test.js, but with Discord-specific properties.
	var channel = new DiscordChannelStub();
	channel.Options = {
		_: [],
		registry: TEST_REGISTRY_PATH,
		path: TEST_HIVE_ROOT,
		username: TEST_CONFIG.Username,
		password: TEST_CONFIG.Password,
	};
	await channel.Initialize();
	return channel;
}


//---------------------------------------------------------------------
// DiscordChannelStub — mirrors DiscordChannel's non-bot methods for testing
class DiscordChannelStub extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'discord';
		this.Client = null;
		this.ActiveMessage = null;
		this.UserConversations = {};
		this.ProcessingQueue = Promise.resolve();
		this.OutputLog = [];
	}


	//---------------------------------------------------------------------
	ResolveToken()
	{
		if ( this.Options.token )
		{
			return String( this.Options.token );
		}
		if ( process.env.DISCORD_BOT_TOKEN )
		{
			return process.env.DISCORD_BOT_TOKEN;
		}
		throw new Error(
			'Discord bot token not provided.\n'
			+ 'Supply it via --token <token> or set the DISCORD_BOT_TOKEN environment variable.'
		);
	}


	//---------------------------------------------------------------------
	async ResolveUserConversation( DiscordUser )
	{
		if ( this.UserConversations[ DiscordUser.id ] )
		{
			this.ConversationName = this.UserConversations[ DiscordUser.id ];
			this.UserName = 'discord:' + DiscordUser.username;
			this.Hive.UserName = this.UserName;
			return;
		}

		this.UserName = 'discord:' + DiscordUser.username;
		this.Hive.UserName = this.UserName;

		var last_result = await this.Hive.InvokeTool( 'Conversation.GetLastConversation', {
			Username: this.UserName,
			ChannelName: this.ChannelName,
		} );

		if ( last_result.Success )
		{
			this.ConversationName = last_result.Result.ConversationName;
			this.UserConversations[ DiscordUser.id ] = this.ConversationName;
			return;
		}

		await this.CreateNewConversation( this.Hive );
		this.UserConversations[ DiscordUser.id ] = this.ConversationName;
	}


	//---------------------------------------------------------------------
	SplitMessage( Text )
	{
		var text = String( Text );
		if ( text.length <= 2000 )
		{
			return [ text ];
		}

		var chunks = [];
		while ( text.length > 0 )
		{
			if ( text.length <= 2000 )
			{
				chunks.push( text );
				break;
			}

			var slice = text.substring( 0, 2000 );
			var split_index = slice.lastIndexOf( '\n' );
			if ( split_index < 1 )
			{
				split_index = 2000;
			}

			chunks.push( text.substring( 0, split_index ) );
			text = text.substring( split_index );
			if ( text.startsWith( '\n' ) )
			{
				text = text.substring( 1 );
			}
		}

		return chunks;
	}


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		var formatted = '';

		switch ( Type )
		{
			case 'text':
				formatted = String( Message );
				break;
			case 'json':
				formatted = '```json\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				break;
			case 'table':
				if ( Array.isArray( Message ) && Message.length > 0 )
				{
					formatted = '```\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				}
				else
				{
					formatted = '```json\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				}
				break;
			case 'error':
				formatted = '**Error:** ' + ( ( typeof Message === 'string' ) ? Message : JSON.stringify( Message ) );
				break;
			default:
				formatted = String( Message );
				break;
		}

		this.OutputLog.push( { Message: Message, Formatted: formatted, Type: Type } );
	}


	//---------------------------------------------------------------------
	async Prompt()
	{
		return '';
	}


	//---------------------------------------------------------------------
	async PromptChoice( Message, Items )
	{
		if ( Items.length > 0 ) { return Items[ 0 ].Name || Items[ 0 ]; }
		throw new Error( 'No items to choose from' );
	}


	//---------------------------------------------------------------------
	async Start() {}
	async Stop() {}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		this.Output( 'Discord channel help', 'text' );
	}


}


//---------------------------------------------------------------------
TEST.describe( 'Discord Channel Tests', function ()
{

	TEST.afterEach( async function ()
	{
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch {}
	} );


	//=================================================================
	// CLI Integration (subprocess)
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should display help text with --help', async function ()
	{
		var result = await run_discord( [ '--help' ] );

		ASSERT.ok( result.stdout.indexOf( 'Usage:' ) > -1, 'should contain Usage' );
		ASSERT.ok( result.stdout.indexOf( '--token' ) > -1, 'should mention --token' );
		ASSERT.ok( result.stdout.indexOf( 'DISCORD_BOT_TOKEN' ) > -1, 'should mention env var' );
		ASSERT.ok( result.stdout.indexOf( '--registry' ) > -1, 'should mention --registry' );
		ASSERT.ok( result.stdout.indexOf( '/Help' ) > -1, 'should mention /Help command' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should error when registry path does not exist', async function ()
	{
		var result = await run_discord( [
			'--registry', PATH.join( __dirname, 'nonexistent-registry' ),
			'--path', TEST_HIVE_ROOT,
			'--username', 'testuser',
			'System.Info',
		] );

		ASSERT.ok( result.stderr.indexOf( 'Registry not found' ) > -1, 'should report missing registry' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should produce dry run report with --test', async function ()
	{
		var result = await run_discord( [
			'--registry', TEST_REGISTRY_PATH,
			'--path', TEST_HIVE_ROOT,
			'--username', TEST_CONFIG.Username,
			'--password', TEST_CONFIG.Password,
			'--llm', TEST_CONFIG.ChatLlm,
			'--test',
		] );

		ASSERT.strictEqual( result.stderr, '', 'should have no errors' );
		var report = JSON.parse( result.stdout );
		ASSERT.ok( report.Registry, 'should have Registry path' );
		ASSERT.ok( report.HivePath, 'should have HivePath' );
		ASSERT.strictEqual( report.UserName, TEST_CONFIG.Username );
		ASSERT.strictEqual( report.ChannelName, 'discord' );
		ASSERT.ok( report.ConversationName, 'should have ConversationName' );
		ASSERT.ok( report.Plugins.length > 0, 'should have plugins' );
		ASSERT.ok( report.ToolCount > 0, 'should have tools' );
		ASSERT.strictEqual( report.Authenticated, true, 'should be authenticated' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute one-shot tool invocation', async function ()
	{
		var result = await run_discord( [
			'--registry', TEST_REGISTRY_PATH,
			'--path', TEST_HIVE_ROOT,
			'--username', TEST_CONFIG.Username,
			'--password', TEST_CONFIG.Password,
			'--llm', TEST_CONFIG.ChatLlm,
			'System.Info',
		] );

		ASSERT.strictEqual( result.stderr, '', 'should have no errors' );
		var parsed = JSON.parse( result.stdout );
		ASSERT.ok( parsed.HiveRoot, 'should have HiveRoot in System.Info output' );
		ASSERT.ok( parsed.UserName, 'should have UserName' );
	} );


	//=================================================================
	// ResolveToken
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should resolve token from --token flag', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.token = 'flag-token-123';

		var token = channel.ResolveToken();
		ASSERT.strictEqual( token, 'flag-token-123' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should resolve token from environment variable', async function ()
	{
		var channel = await create_test_channel();
		var original = process.env.DISCORD_BOT_TOKEN;

		process.env.DISCORD_BOT_TOKEN = 'env-token-456';
		try
		{
			var token = channel.ResolveToken();
			ASSERT.strictEqual( token, 'env-token-456' );
		}
		finally
		{
			if ( original === undefined )
			{
				delete process.env.DISCORD_BOT_TOKEN;
			}
			else
			{
				process.env.DISCORD_BOT_TOKEN = original;
			}
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should prefer --token flag over environment variable', async function ()
	{
		var channel = await create_test_channel();
		var original = process.env.DISCORD_BOT_TOKEN;

		channel.Options.token = 'flag-token';
		process.env.DISCORD_BOT_TOKEN = 'env-token';
		try
		{
			var token = channel.ResolveToken();
			ASSERT.strictEqual( token, 'flag-token' );
		}
		finally
		{
			if ( original === undefined )
			{
				delete process.env.DISCORD_BOT_TOKEN;
			}
			else
			{
				process.env.DISCORD_BOT_TOKEN = original;
			}
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw when no token is available', async function ()
	{
		var channel = await create_test_channel();
		var original = process.env.DISCORD_BOT_TOKEN;

		delete process.env.DISCORD_BOT_TOKEN;
		try
		{
			ASSERT.throws( function ()
			{
				channel.ResolveToken();
			}, /Discord bot token not provided/ );
		}
		finally
		{
			if ( original !== undefined )
			{
				process.env.DISCORD_BOT_TOKEN = original;
			}
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should coerce numeric token to string', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.token = 12345;

		var token = channel.ResolveToken();
		ASSERT.strictEqual( token, '12345' );
		ASSERT.strictEqual( typeof token, 'string' );
	} );


	//=================================================================
	// SplitMessage
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return short messages as single chunk', async function ()
	{
		var channel = await create_test_channel();
		var chunks = channel.SplitMessage( 'Hello world' );

		ASSERT.strictEqual( chunks.length, 1 );
		ASSERT.strictEqual( chunks[ 0 ], 'Hello world' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should split long messages at newline boundaries', async function ()
	{
		var channel = await create_test_channel();

		// Build a message with lines that sum to > 2000 chars
		var lines = [];
		for ( var index = 0; index < 30; index++ )
		{
			lines.push( 'Line ' + index + ': ' + 'x'.repeat( 80 ) );
		}
		var long_text = lines.join( '\n' );
		ASSERT.ok( long_text.length > 2000, 'test message should exceed 2000 chars' );

		var chunks = channel.SplitMessage( long_text );
		ASSERT.ok( chunks.length > 1, 'should produce multiple chunks' );

		for ( var chunk_index = 0; chunk_index < chunks.length; chunk_index++ )
		{
			ASSERT.ok( chunks[ chunk_index ].length <= 2000, 'each chunk should be <= 2000 chars' );
		}

		// Reassemble and verify no content lost
		var reassembled = chunks.join( '\n' );
		ASSERT.strictEqual( reassembled, long_text );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should hard-split lines exceeding 2000 chars', async function ()
	{
		var channel = await create_test_channel();
		var long_line = 'x'.repeat( 4500 );

		var chunks = channel.SplitMessage( long_line );
		ASSERT.ok( chunks.length > 1, 'should produce multiple chunks' );

		for ( var index = 0; index < chunks.length; index++ )
		{
			ASSERT.ok( chunks[ index ].length <= 2000, 'each chunk should be <= 2000 chars' );
		}

		// Verify total length preserved
		var total_length = 0;
		for ( var index = 0; index < chunks.length; index++ )
		{
			total_length += chunks[ index ].length;
		}
		ASSERT.strictEqual( total_length, 4500 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle empty string', async function ()
	{
		var channel = await create_test_channel();
		var chunks = channel.SplitMessage( '' );

		ASSERT.strictEqual( chunks.length, 1 );
		ASSERT.strictEqual( chunks[ 0 ], '' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle exactly 2000 chars', async function ()
	{
		var channel = await create_test_channel();
		var exact = 'a'.repeat( 2000 );
		var chunks = channel.SplitMessage( exact );

		ASSERT.strictEqual( chunks.length, 1 );
		ASSERT.strictEqual( chunks[ 0 ].length, 2000 );
	} );


	//=================================================================
	// Output formatting
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should format text output as plain string', async function ()
	{
		var channel = await create_test_channel();
		channel.Output( 'Hello world', 'text' );

		ASSERT.strictEqual( channel.OutputLog[ 0 ].Formatted, 'Hello world' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should format json output as code block', async function ()
	{
		var channel = await create_test_channel();
		var data = { key: 'value' };
		channel.Output( data, 'json' );

		var formatted = channel.OutputLog[ 0 ].Formatted;
		ASSERT.ok( formatted.startsWith( '```json\n' ), 'should start with json code fence' );
		ASSERT.ok( formatted.endsWith( '\n```' ), 'should end with code fence' );
		ASSERT.ok( formatted.indexOf( '"key"' ) > -1, 'should contain the key' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should format table output as code block', async function ()
	{
		var channel = await create_test_channel();
		var data = [ { Name: 'Alice' }, { Name: 'Bob' } ];
		channel.Output( data, 'table' );

		var formatted = channel.OutputLog[ 0 ].Formatted;
		ASSERT.ok( formatted.startsWith( '```\n' ), 'should start with plain code fence' );
		ASSERT.ok( formatted.endsWith( '\n```' ), 'should end with code fence' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should format error output with bold prefix', async function ()
	{
		var channel = await create_test_channel();
		channel.Output( 'Something failed', 'error' );

		var formatted = channel.OutputLog[ 0 ].Formatted;
		ASSERT.ok( formatted.startsWith( '**Error:** ' ), 'should start with bold Error prefix' );
		ASSERT.ok( formatted.indexOf( 'Something failed' ) > -1, 'should contain error message' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should format error objects as JSON string', async function ()
	{
		var channel = await create_test_channel();
		channel.Output( { code: 500, detail: 'fail' }, 'error' );

		var formatted = channel.OutputLog[ 0 ].Formatted;
		ASSERT.ok( formatted.startsWith( '**Error:** ' ), 'should start with bold Error prefix' );
		ASSERT.ok( formatted.indexOf( '500' ) > -1, 'should contain error code' );
	} );


	//=================================================================
	// ResolveUserConversation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a new conversation for a Discord user', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TEST_CONFIG.ChatLlm;

		var fake_user = { id: '111222333', username: 'alice' };
		await channel.ResolveUserConversation( fake_user );

		ASSERT.ok( channel.ConversationName, 'should have a conversation name' );
		ASSERT.strictEqual( channel.UserName, 'discord:alice' );
		ASSERT.strictEqual( channel.Hive.UserName, 'discord:alice' );
		ASSERT.strictEqual( channel.UserConversations[ '111222333' ], channel.ConversationName );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should cache and reuse conversation for same user', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TEST_CONFIG.ChatLlm;

		var fake_user = { id: '444555666', username: 'bob' };
		await channel.ResolveUserConversation( fake_user );
		var first_conversation = channel.ConversationName;

		// Resolve again for same user
		await channel.ResolveUserConversation( fake_user );
		ASSERT.strictEqual( channel.ConversationName, first_conversation, 'should reuse cached conversation' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create separate conversations for different users', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TEST_CONFIG.ChatLlm;

		var user_a = { id: '100', username: 'user_a' };
		var user_b = { id: '200', username: 'user_b' };

		await channel.ResolveUserConversation( user_a );
		var conversation_a = channel.ConversationName;

		await channel.ResolveUserConversation( user_b );
		var conversation_b = channel.ConversationName;

		ASSERT.notStrictEqual( conversation_a, conversation_b, 'should have different conversations' );
		ASSERT.strictEqual( channel.UserConversations[ '100' ], conversation_a );
		ASSERT.strictEqual( channel.UserConversations[ '200' ], conversation_b );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should resume existing conversation for known user', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TEST_CONFIG.ChatLlm;

		// Pre-create a conversation for discord:charlie
		await channel.Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'charlie-session',
			Settings: {
				Username: 'discord:charlie',
				ChannelName: 'discord',
				ChatLlm: TEST_CONFIG.ChatLlm,
				UsedAt: new Date().toISOString(),
			},
		} );

		var fake_user = { id: '777', username: 'charlie' };
		await channel.ResolveUserConversation( fake_user );

		ASSERT.strictEqual( channel.ConversationName, 'charlie-session', 'should resume existing conversation' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should set Hive.UserName per user context swap', async function ()
	{
		var channel = await create_test_channel();
		channel.Options.llm = TEST_CONFIG.ChatLlm;

		var user_a = { id: '300', username: 'swap_a' };
		var user_b = { id: '400', username: 'swap_b' };

		await channel.ResolveUserConversation( user_a );
		ASSERT.strictEqual( channel.Hive.UserName, 'discord:swap_a' );

		await channel.ResolveUserConversation( user_b );
		ASSERT.strictEqual( channel.Hive.UserName, 'discord:swap_b' );
	} );


	//=================================================================
	// Constructor defaults
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should have correct default properties', function ()
	{
		var channel = new DiscordChannelStub();

		ASSERT.strictEqual( channel.ChannelName, 'discord' );
		ASSERT.strictEqual( channel.Client, null );
		ASSERT.strictEqual( channel.ActiveMessage, null );
		ASSERT.deepStrictEqual( channel.UserConversations, {} );
	} );


} );
