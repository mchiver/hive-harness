
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;
const TestHive = require( './TestHive.js' );

const CONVERSATION_DATA_PATH = PATH.join( TestHive.HIVE_ROOT, '.hive', 'Entities', TestHive.TESTUSER_NAME, 'Conversation' );


//---------------------------------------------------------------------
TEST.describe( 'Conversation Plugin Tests', function ()
{

	var hive;

	//-------------------------------------------------------------
	TEST.before( async function ()
	{
		// Clean up stale conversation data from prior interrupted runs
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch {}

		var registry = await TestHive.EnsureSetup();
		hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );
	} );

	TEST.after( async function ()
	{
		// Clean up conversation entities
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch {}
	} );


	//=================================================================
	// Plugin Loading
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should load the Conversation plugin', async function ()
	{
		ASSERT.ok( hive.Plugins.Conversation, 'plugin should be loaded' );
		ASSERT.strictEqual( hive.Plugins.Conversation.PluginName, 'Conversation' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have entity management tools', async function ()
	{
		var tools = hive.Plugins.Conversation.Tools;
		ASSERT.ok( tools.ListEntities, 'should have ListEntities' );
		ASSERT.ok( tools.ConfigEntity, 'should have ConfigEntity' );
		ASSERT.ok( tools.DeleteEntity, 'should have DeleteEntity' );
		ASSERT.ok( tools.RenameEntity, 'should have RenameEntity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have conversation-specific tools', async function ()
	{
		var tools = hive.Plugins.Conversation.Tools;
		ASSERT.ok( tools.Chat, 'should have Chat' );
		ASSERT.ok( tools.Search, 'should have Search' );
		ASSERT.ok( tools.GetHistory, 'should have GetHistory' );
		ASSERT.ok( tools.ClearHistory, 'should have ClearHistory' );
		ASSERT.ok( tools.ListConversations, 'should have ListConversations' );
		ASSERT.ok( tools.GetLastConversation, 'should have GetLastConversation' );
	} );


	//=================================================================
	// Entity Management
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create and configure a conversation entity', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'test-convo',
			Settings: {
				Description: 'Test conversation',
				Username: TestHive.TESTUSER_NAME,
				ChannelName: 'cli',
				Topics: [],
				Skills: [ 'System.ToolUsageSkill' ],
				ChatLlm: TestHive.Llm.ChatLlm,
			},
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.strictEqual( result.Result.Name, 'test-convo' );
		ASSERT.strictEqual( result.Result.Description, 'Test conversation' );
		ASSERT.strictEqual( result.Result.Username, TestHive.TESTUSER_NAME );
		ASSERT.strictEqual( result.Result.ChannelName, 'cli' );
		ASSERT.strictEqual( result.Result.ChatLlm, TestHive.Llm.ChatLlm );
		ASSERT.deepStrictEqual( result.Result.Skills, [ 'System.ToolUsageSkill' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list conversation entities', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ListEntities', {} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( Array.isArray( result.Result ) );
		var names = result.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( names.indexOf( 'test-convo' ) > -1, 'should contain test-convo' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should read existing entity config', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'test-convo',
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.strictEqual( result.Result.Name, 'test-convo' );
		ASSERT.strictEqual( result.Result.Username, TestHive.TESTUSER_NAME );
	} );


	//=================================================================
	// ListConversations
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list conversations by username', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ListConversations', {
			Username: TestHive.TESTUSER_NAME,
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( result.Result.Count > 0, 'should find conversations' );
		ASSERT.strictEqual( result.Result.Conversations[ 0 ].ConversationName, 'test-convo' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter conversations by channel name', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ListConversations', {
			Username: TestHive.TESTUSER_NAME,
			ChannelName: 'cli',
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( result.Result.Count > 0 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty for non-matching username', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ListConversations', {
			Username: 'nobody',
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.strictEqual( result.Result.Count, 0 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter with glob channel pattern', async function ()
	{
		// Create a second conversation on a different channel
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'discord-convo',
			Settings: {
				Username: TestHive.TESTUSER_NAME,
				ChannelName: 'discord',
				ChatLlm: TestHive.Llm.ChatLlm,
			},
		} );

		var cli_result = await hive.InvokeTool( 'Conversation.ListConversations', {
			Username: TestHive.TESTUSER_NAME,
			ChannelName: 'cli*',
		} );

		ASSERT.strictEqual( cli_result.Success, true );
		ASSERT.strictEqual( cli_result.Result.Count, 1 );
		ASSERT.strictEqual( cli_result.Result.Conversations[ 0 ].ConversationName, 'test-convo' );
	} );


	//=================================================================
	// GetLastConversation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should get last conversation for a user', async function ()
	{
		// Touch the UsedAt on test-convo so it's most recent
		var plugin = hive.Plugins.Conversation;
		await plugin.TouchUsedAt( hive, 'test-convo' );

		var result = await hive.InvokeTool( 'Conversation.GetLastConversation', {
			Username: TestHive.TESTUSER_NAME,
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( result.Result.ConversationName, 'should return a conversation name' );
		ASSERT.ok( result.Result.UsedAt, 'should have UsedAt' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error when no conversations found', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.GetLastConversation', {
			Username: 'ghost-user',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//=================================================================
	// Chat History
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should append and retrieve messages', async function ()
	{
		var plugin = hive.Plugins.Conversation;

		await plugin.AppendMessage( hive, 'test-convo', TestHive.TESTUSER_NAME, '', '', 'Hello there' );
		await plugin.AppendMessage( hive, 'test-convo', '', TestHive.Llm.ChatLlm, '', 'Hi! How can I help?' );

		var rows = await plugin.GetRecentMessages( hive, 'test-convo', 10 );
		ASSERT.ok( rows.length >= 2, 'should have at least 2 messages' );

		var last = rows[ rows.length - 1 ];
		ASSERT.strictEqual( last.LlmName, TestHive.Llm.ChatLlm );
		ASSERT.strictEqual( last.Text, 'Hi! How can I help?' );
		ASSERT.ok( last.MessageID > 0, 'should have MessageID' );
		ASSERT.ok( last.Timestamp, 'should have Timestamp' );
		ASSERT.ok( Array.isArray( last.Tools ), 'should have Tools array' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should append and retrieve tool calls', async function ()
	{
		var plugin = hive.Plugins.Conversation;

		var msg = await plugin.AppendMessage( hive, 'test-convo', TestHive.TESTUSER_NAME, '', '', 'run a tool' );
		await plugin.AppendToolCall(
			hive, 'test-convo', msg.MessageID,
			'test-convo', 'System.Info', 'ok',
			{}, { HiveRoot: '/test' }
		);

		var rows = await plugin.GetRecentMessages( hive, 'test-convo', 10 );
		var found = rows.find( function ( r ) { return r.MessageID === msg.MessageID; } );
		ASSERT.ok( found, 'should find the message' );
		ASSERT.strictEqual( found.Tools.length, 1, 'should have 1 tool call' );
		ASSERT.strictEqual( found.Tools[ 0 ].ToolName, 'System.Info' );
		ASSERT.strictEqual( found.Tools[ 0 ].Status, 'ok' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should limit message retrieval with MaxItems', async function ()
	{
		var plugin = hive.Plugins.Conversation;

		// Add several entries
		for ( var i = 0; i < 5; i++ )
		{
			await plugin.AppendMessage( hive, 'test-convo', TestHive.TESTUSER_NAME, '', '', 'Message ' + i );
		}

		var rows = await plugin.GetRecentMessages( hive, 'test-convo', 3 );
		ASSERT.strictEqual( rows.length, 3, 'should return only 3 messages' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get history via GetHistory tool', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: 'test-convo',
			MaxItems: 5,
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.strictEqual( result.Result.Count, 5 );
		ASSERT.ok( result.Result.Messages.length === 5 );
		ASSERT.ok( result.Result.Messages[ 0 ].MessageID, 'should have MessageID' );
		ASSERT.ok( Array.isArray( result.Result.Messages[ 0 ].Tools ), 'should have Tools array' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should clear history via ClearHistory tool', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.ClearHistory', {
			EntityName: 'test-convo',
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( result.Result.RowsRemoved > 0, 'should have removed entries' );

		// Verify history is now empty
		var history = await hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: 'test-convo',
		} );
		ASSERT.strictEqual( history.Result.Count, 0 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for GetHistory on nonexistent entity', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: 'does-not-exist',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//=================================================================
	// BuildPrompt
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should build a prompt with all sections', function ()
	{
		var plugin = hive.Plugins.Conversation;
		var prompt = plugin.BuildPrompt(
			'my-convo',
			[
				{ Username: 'alice', LlmName: '', Text: 'Hello' },
				{ Username: '', LlmName: 'my-llm', Text: 'Hi there' },
			],
			[
				{ Score: 0.9, Text: 'Relevant chunk 1' },
				{ Score: 0.7, Text: 'Relevant chunk 2' },
			],
			[
				{ Name: 'System.ToolUsageSkill', Text: 'You have access to tools.' },
				{ Name: 'Skill.MyCodingSkill', Text: 'Be concise.' },
			],
			'What is the answer?'
		);

		ASSERT.ok( prompt.indexOf( '<conversation>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<name>my-convo</name>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<skill name="System.ToolUsageSkill">' ) > -1 );
		ASSERT.ok( prompt.indexOf( 'You have access to tools.' ) > -1 );
		ASSERT.ok( prompt.indexOf( '</skill>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<skill name="Skill.MyCodingSkill">' ) > -1 );
		ASSERT.ok( prompt.indexOf( 'Be concise.' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<history>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '[user] Hello' ) > -1 );
		ASSERT.ok( prompt.indexOf( '[llm] Hi there' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<context>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '[score:0.9] Relevant chunk 1' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<task>' ) > -1 );
		ASSERT.ok( prompt.indexOf( 'What is the answer?' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should build prompt without optional sections', function ()
	{
		var plugin = hive.Plugins.Conversation;
		var prompt = plugin.BuildPrompt( 'minimal', [], [], [], 'Just a question' );

		ASSERT.ok( prompt.indexOf( '<conversation>' ) > -1 );
		ASSERT.ok( prompt.indexOf( '<task>' ) > -1 );
		ASSERT.ok( prompt.indexOf( 'Just a question' ) > -1 );
		ASSERT.strictEqual( prompt.indexOf( '<skill' ), -1, 'should not have skill section' );
		ASSERT.strictEqual( prompt.indexOf( '<history>' ), -1, 'should not have history section' );
		ASSERT.strictEqual( prompt.indexOf( '<context>' ), -1, 'should not have context section' );
	} );


	//=================================================================
	// Search (no topics configured)
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return empty results when no topics configured', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.Search', {
			EntityName: 'test-convo',
			Text: 'anything',
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.strictEqual( result.Result.Count, 0 );
		ASSERT.deepStrictEqual( result.Result.Results, [] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for search on nonexistent entity', async function ()
	{
		var result = await hive.InvokeTool( 'Conversation.Search', {
			EntityName: 'ghost-entity',
			Text: 'anything',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	//=================================================================
	// Search (with topic)
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should search across configured topics', async function ()
	{
		// Create a topic and embed some text
		await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: 'convo-topic',
			Settings: { Description: 'Test topic for conversation' },
		} );
		await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: 'convo-topic',
			SourceName: 'test-doc',
			Text: 'The quick brown fox jumps over the lazy dog. This is a test document about animals and nature.',
		} );

		// Configure conversation to use this topic
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'test-convo',
			Settings: { Topics: [ 'convo-topic' ] },
		} );

		// Search
		var result = await hive.InvokeTool( 'Conversation.Search', {
			EntityName: 'test-convo',
			Text: 'fox and animals',
			MinScore: 0.01,
		} );

		ASSERT.strictEqual( result.Success, true );
		ASSERT.ok( result.Result.Count > 0, 'should find results' );
		ASSERT.strictEqual( result.Result.Results[ 0 ].TopicName, 'convo-topic' );
		ASSERT.ok( result.Result.Results[ 0 ].Text, 'should have text' );
		ASSERT.ok( result.Result.Results[ 0 ].Score > 0, 'should have score' );

		// Clean up topic
		await hive.InvokeTool( 'Topic.DeleteEntity', { EntityName: 'convo-topic' } );
	} );


	//=================================================================
	// Chat (error cases)
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return error when no ChatLlm configured', async function ()
	{
		// Create a conversation without ChatLlm
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'no-llm-convo',
			Settings: { Username: TestHive.TESTUSER_NAME, ChatLlm: '' },
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: 'no-llm-convo',
			Text: 'Hello',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail' );
		ASSERT.ok( result.Error, 'should have error message' );
		ASSERT.ok( result.Error.indexOf( 'ChatLlm' ) > -1 );

		// Clean up
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: 'no-llm-convo' } );
	} );


	//=================================================================
	// Entity Lifecycle
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should delete a conversation entity', async function ()
	{
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'delete-me',
			Settings: { Username: TestHive.TESTUSER_NAME },
		} );

		var result = await hive.InvokeTool( 'Conversation.DeleteEntity', {
			EntityName: 'delete-me',
		} );
		ASSERT.strictEqual( result.Success, true );

		// Verify it's gone
		var list = await hive.InvokeTool( 'Conversation.ListEntities', {} );
		var names = list.Result.map( function ( e ) { return e.Name; } );
		ASSERT.strictEqual( names.indexOf( 'delete-me' ), -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should rename a conversation entity', async function ()
	{
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'rename-me',
			Settings: { Username: TestHive.TESTUSER_NAME, Description: 'to rename' },
		} );

		var result = await hive.InvokeTool( 'Conversation.RenameEntity', {
			EntityName: 'rename-me',
			NewEntityName: 'renamed',
		} );
		ASSERT.strictEqual( result.Success, true );

		// Verify old name is gone and new name exists
		var config = await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: 'renamed',
		} );
		ASSERT.strictEqual( config.Success, true );
		ASSERT.strictEqual( config.Result.Name, 'renamed' );

		// Clean up
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: 'renamed' } );
	} );


	//=================================================================
	// TouchUsedAt
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should update UsedAt timestamp', async function ()
	{
		var plugin = hive.Plugins.Conversation;

		var config_before = await plugin.GetEntityConfig( hive, 'test-convo' );
		var before_used_at = config_before.UsedAt || '';

		// Small delay to ensure timestamp changes
		await new Promise( function ( resolve ) { setTimeout( resolve, 50 ); } );

		await plugin.TouchUsedAt( hive, 'test-convo' );

		var config_after = await plugin.GetEntityConfig( hive, 'test-convo' );
		ASSERT.ok( config_after.UsedAt, 'should have UsedAt' );
		ASSERT.ok( config_after.UsedAt > before_used_at, 'UsedAt should be more recent' );
	} );


	//=================================================================
	// Cleanup remaining test entities
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should clean up test entities', async function ()
	{
		// Clean up the entities created during tests
		try { await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: 'test-convo' } ); } catch {}
		try { await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: 'discord-convo' } ); } catch {}

		var list = await hive.InvokeTool( 'Conversation.ListEntities', {} );
		var names = list.Result.map( function ( e ) { return e.Name || e; } );
		ASSERT.ok( !names.includes( 'test-convo' ), 'test-convo should be cleaned up' );
		ASSERT.ok( !names.includes( 'discord-convo' ), 'discord-convo should be cleaned up' );
	} );


} );
