
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const TestHive = require( './TestHive.js' );



//---------------------------------------------------------------------
TEST.describe( 'Llm Plugin Tests', function ()
{


	//-----------------------------------------------------------------
	async function open_hive()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );
		return hive;
	}


	//=================================================================
	// Plugin Loading
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should load the Llm plugin', async function ()
	{
		var hive = await open_hive();

		ASSERT.ok( hive.Plugins.Llm, 'Llm plugin should be loaded' );
		ASSERT.strictEqual( hive.Plugins.Llm.PluginName, 'Llm' );
		ASSERT.strictEqual( hive.Plugins.Llm.Description, 'LLM chat and embedding via platform adapters.' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have entity management tools', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		ASSERT.ok( plugin.Tools.ListEntities, 'should have ListEntities' );
		ASSERT.ok( plugin.Tools.ConfigEntity, 'should have ConfigEntity' );
		ASSERT.ok( plugin.Tools.DeleteEntity, 'should have DeleteEntity' );
		ASSERT.ok( plugin.Tools.RenameEntity, 'should have RenameEntity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have SubmitPrompt and EmbedText tools', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		ASSERT.ok( plugin.Tools.SubmitPrompt, 'should have SubmitPrompt' );
		ASSERT.ok( plugin.Tools.EmbedText, 'should have EmbedText' );
	} );


	//=================================================================
	// Entity Configuration
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create and configure an Llm entity', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: TestHive.Llm.ChatLlm,
			Settings: {
				Description: 'Test LLM entity',
				Platform: TestHive.Llm.Platform,
				ModelName: TestHive.Llm.ModelName,
				ModelTemperature: TestHive.Llm.ModelTemperature,
				ContextSize: TestHive.Llm.ContextSize,
				CanEmbed: false,
				PlatformSettings: {},
			},
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Name, TestHive.Llm.ChatLlm );
		ASSERT.strictEqual( result.Result.Platform, TestHive.Llm.Platform );
		ASSERT.strictEqual( result.Result.ModelName, TestHive.Llm.ModelName );
		ASSERT.strictEqual( result.Result.ModelTemperature, TestHive.Llm.ModelTemperature );
		ASSERT.strictEqual( result.Result.ContextSize, TestHive.Llm.ContextSize );
		ASSERT.strictEqual( result.Result.CanEmbed, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list created entities', async function ()
	{
		var hive = await open_hive();

		// Ensure entity exists
		await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'list-test',
			Settings: { Platform: 'ollama', ModelName: 'llama3', Description: 'List test' },
		} );

		var result = await hive.InvokeTool( 'Llm.ListEntities', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result ), 'should be an array' );

		var names = result.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( names.includes( 'list-test' ), 'should include list-test entity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete an entity', async function ()
	{
		var hive = await open_hive();

		// Create then delete
		await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'delete-me',
			Settings: { Platform: 'ollama', ModelName: 'llama3' },
		} );

		var delete_result = await hive.InvokeTool( 'Llm.DeleteEntity', {
			EntityName: 'delete-me',
		} );

		ASSERT.ok( !delete_result.Error, delete_result.Error );
		ASSERT.ok( delete_result.Success, 'should succeed' );

		// Verify it's gone
		var list_result = await hive.InvokeTool( 'Llm.ListEntities', {} );
		var names = list_result.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( !names.includes( 'delete-me' ), 'should not include deleted entity' );
	} );


	//=================================================================
	// Token Estimation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should estimate tokens correctly', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		ASSERT.strictEqual( plugin.EstimateTokens( '' ), 0 );
		ASSERT.strictEqual( plugin.EstimateTokens( null ), 0 );
		ASSERT.strictEqual( plugin.EstimateTokens( 'abcd' ), 1 );
		ASSERT.strictEqual( plugin.EstimateTokens( 'abcde' ), 2 );
		ASSERT.strictEqual( plugin.EstimateTokens( 'a'.repeat( 100 ) ), 25 );
	} );


	//=================================================================
	// Adapter Resolution
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should load the ollama adapter', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		var adapter = plugin.GetAdapter( 'ollama' );
		ASSERT.ok( adapter, 'should return an adapter' );
		ASSERT.ok( typeof adapter.SubmitPrompt === 'function', 'should have SubmitPrompt' );
		ASSERT.ok( typeof adapter.EmbedText === 'function', 'should have EmbedText' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load the openai adapter', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		var adapter = plugin.GetAdapter( 'openai' );
		ASSERT.ok( adapter, 'should return an adapter' );
		ASSERT.ok( typeof adapter.SubmitPrompt === 'function', 'should have SubmitPrompt' );
		ASSERT.ok( typeof adapter.EmbedText === 'function', 'should have EmbedText' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should load the anthropic adapter', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		var adapter = plugin.GetAdapter( 'anthropic' );
		ASSERT.ok( adapter, 'should return an adapter' );
		ASSERT.ok( typeof adapter.SubmitPrompt === 'function', 'should have SubmitPrompt' );
		// Anthropic does not support embedding
		ASSERT.ok( !adapter.EmbedText, 'should not have EmbedText' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw for unsupported platform', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Llm;
		ASSERT.throws( function ()
		{
			plugin.GetAdapter( 'not-a-platform' );
		}, /Unsupported platform/ );
	} );


	//=================================================================
	// SubmitPrompt Validation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reject prompts exceeding context size', async function ()
	{
		var hive = await open_hive();

		// Create entity with small context size
		await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'tiny-context',
			Settings: {
				Platform: 'ollama',
				ModelName: 'llama3',
				ContextSize: 10,
			},
		} );

		// Submit a prompt that's too large (10 tokens * 4 chars = 40 chars needed, send 100)
		var result = await hive.InvokeTool( 'Llm.SubmitPrompt', {
			EntityName: 'tiny-context',
			Prompt: 'a'.repeat( 100 ),
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'exceeds the context size' ) > -1 );
	} );


	//=================================================================
	// EmbedText Validation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reject embedding when CanEmbed is false', async function ()
	{
		var hive = await open_hive();

		// Create entity without embedding
		await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'no-embed',
			Settings: {
				Platform: 'ollama',
				ModelName: 'llama3',
				CanEmbed: false,
			},
		} );

		var result = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'no-embed',
			Text: 'test text',
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'does not support embedding' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject embedding when platform lacks support', async function ()
	{
		var hive = await open_hive();

		// Create Anthropic entity with CanEmbed = true (but platform doesn't support it)
		await hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'anthropic-embed',
			Settings: {
				Platform: 'anthropic',
				ModelName: 'claude-sonnet-4-6',
				CanEmbed: true,
				ApiKey: 'fake-key',
			},
		} );

		var result = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'anthropic-embed',
			Text: 'test text',
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'does not support embedding' ) > -1 );
	} );


} );
