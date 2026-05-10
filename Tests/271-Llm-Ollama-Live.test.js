
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
TEST.describe( 'Llm Ollama Live Tests', function ()
{


	//-----------------------------------------------------------------
	async function open_hive()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
		return hive;
	}


	//-----------------------------------------------------------------
	async function setup_entities( Hive )
	{
		await Hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'ollama-chat',
			Settings: {
				Description: TEST_CONFIG.LlmModel + ' via Ollama',
				Platform: TEST_CONFIG.LlmPlatform,
				ModelName: TEST_CONFIG.LlmModel,
				ModelTemperature: TEST_CONFIG.LlmTemperature,
				ContextSize: TEST_CONFIG.LlmContextSize,
				CanEmbed: false,
			},
		} );

		await Hive.InvokeTool( 'Llm.ConfigEntity', {
			EntityName: 'ollama-embed',
			Settings: {
				Description: 'Nomic Embed Text via Ollama',
				Platform: 'ollama',
				ModelName: 'nomic-embed-text',
				ModelTemperature: 0,
				CanEmbed: true,
			},
		} );
	}


	//=================================================================
	// SubmitPrompt
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should get a chat response from ollama', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Llm.SubmitPrompt', {
			EntityName: 'ollama-chat',
			Prompt: 'Reply with exactly one word: hello',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.Response, 'should have a response' );
		ASSERT.ok( result.Result.Response.length > 0, 'response should not be empty' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle a longer prompt', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Llm.SubmitPrompt', {
			EntityName: 'ollama-chat',
			Prompt: 'What is 2 + 2? Reply with only the number.',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.Response.indexOf( '4' ) > -1, 'response should contain 4' );
	} );


	//=================================================================
	// EmbedText
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return an embedding vector', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'ollama-embed',
			Text: 'The quick brown fox jumps over the lazy dog.',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( Array.isArray( result.Result.Vector ), 'should return an array' );
		ASSERT.ok( result.Result.Vector.length > 0, 'vector should not be empty' );
		ASSERT.strictEqual( typeof result.Result.Vector[ 0 ], 'number', 'vector elements should be numbers' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return different vectors for different text', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result_a = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'ollama-embed',
			Text: 'Cats are wonderful pets.',
		} );

		var result_b = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'ollama-embed',
			Text: 'Quantum mechanics describes subatomic particles.',
		} );

		ASSERT.ok( !result_a.Result.Error, result_a.Result.Error );
		ASSERT.ok( !result_b.Result.Error, result_b.Result.Error );

		// Vectors should be the same length
		ASSERT.strictEqual( result_a.Result.Vector.length, result_b.Result.Vector.length,
			'vectors should have the same dimensionality' );

		// Vectors should differ
		var identical = true;
		for ( var index = 0; index < result_a.Result.Vector.length; index++ )
		{
			if ( result_a.Result.Vector[ index ] !== result_b.Result.Vector[ index ] )
			{
				identical = false;
				break;
			}
		}
		ASSERT.ok( !identical, 'different text should produce different vectors' );
	} );


	//=================================================================
	// Error Cases
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should error when embedding on a chat-only entity', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Llm.EmbedText', {
			EntityName: 'ollama-chat',
			Text: 'test',
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'does not support embedding' ) > -1 );
	} );


} );
