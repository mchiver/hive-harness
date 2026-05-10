
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

var TOPIC_NAME = 'topic-live-test';
var HASH_TOPIC_NAME = 'topic-hash-test';
var ENTITY_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Topic', TOPIC_NAME );
var HASH_ENTITY_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Topic', HASH_TOPIC_NAME );


//---------------------------------------------------------------------
TEST.describe( 'Topic Plugin Live Tests', function ()
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
		// Ensure the Llm embedding entity exists
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

		// Create the Topic entity
		await Hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
			Settings: {
				Description: 'Live test topic',
				EmbeddingLlm: 'ollama-embed',
				SplitChunkSize: 200,
				SplitChunkOverlap: 20,
			},
		} );
	}


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		// Clean up test entity folders
		if ( await FileUtils.FolderExists( ENTITY_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( ENTITY_DATA_FOLDER, true );
		}
		if ( await FileUtils.FolderExists( HASH_ENTITY_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( HASH_ENTITY_DATA_FOLDER, true );
		}
	} );


	//=================================================================
	// Plugin Loading
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should load the Topic plugin', async function ()
	{
		var hive = await open_hive();

		ASSERT.ok( hive.Plugins.Topic, 'Topic plugin should be loaded' );
		ASSERT.strictEqual( hive.Plugins.Topic.PluginName, 'Topic' );
		ASSERT.strictEqual( hive.Plugins.Topic.Description, 'Searchable knowledgebase (RAG) per entity.' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have entity management tools', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Topic;
		ASSERT.ok( plugin.Tools.ListEntities, 'should have ListEntities' );
		ASSERT.ok( plugin.Tools.ConfigEntity, 'should have ConfigEntity' );
		ASSERT.ok( plugin.Tools.DeleteEntity, 'should have DeleteEntity' );
		ASSERT.ok( plugin.Tools.RenameEntity, 'should have RenameEntity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should have Topic tools', async function ()
	{
		var hive = await open_hive();

		var plugin = hive.Plugins.Topic;
		ASSERT.ok( plugin.Tools.EmbedText, 'should have EmbedText' );
		ASSERT.ok( plugin.Tools.Search, 'should have Search' );
		ASSERT.ok( plugin.Tools.ListSources, 'should have ListSources' );
		ASSERT.ok( plugin.Tools.GetSource, 'should have GetSource' );
		ASSERT.ok( plugin.Tools.RemoveSource, 'should have RemoveSource' );
		ASSERT.ok( plugin.Tools.RemoveAll, 'should have RemoveAll' );
	} );


	//=================================================================
	// Entity Configuration
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create and configure a Topic entity', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Name, TOPIC_NAME );
		ASSERT.strictEqual( result.Result.EmbeddingLlm, 'ollama-embed' );
		ASSERT.strictEqual( result.Result.SplitChunkSize, 200 );
		ASSERT.strictEqual( result.Result.SplitChunkOverlap, 20 );
	} );


	//=================================================================
	// Factory Helpers
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should split text into chunks', async function ()
	{
		var hive = await open_hive();
		var plugin = hive.Plugins.Topic;

		// Text shorter than chunk size returns single chunk
		var short_chunks = plugin.SplitText( 'Hello world', 200, 20 );
		ASSERT.strictEqual( short_chunks.length, 1 );
		ASSERT.strictEqual( short_chunks[ 0 ], 'Hello world' );

		// Text longer than chunk size splits with overlap
		var text = 'A'.repeat( 500 );
		var chunks = plugin.SplitText( text, 200, 20 );
		ASSERT.ok( chunks.length > 1, 'should produce multiple chunks' );
		ASSERT.strictEqual( chunks[ 0 ].length, 200 );

		// Empty text returns empty array
		var empty_chunks = plugin.SplitText( '', 200, 20 );
		ASSERT.strictEqual( empty_chunks.length, 0 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should compute cosine similarity', async function ()
	{
		var hive = await open_hive();
		var plugin = hive.Plugins.Topic;

		// Identical vectors should return 1
		var score_identical = plugin.CosineSimilarity( [ 1, 0, 0 ], [ 1, 0, 0 ] );
		ASSERT.ok( Math.abs( score_identical - 1.0 ) < 0.0001, 'identical vectors should score 1' );

		// Orthogonal vectors should return 0
		var score_orthogonal = plugin.CosineSimilarity( [ 1, 0, 0 ], [ 0, 1, 0 ] );
		ASSERT.ok( Math.abs( score_orthogonal ) < 0.0001, 'orthogonal vectors should score 0' );

		// Opposite vectors should return -1
		var score_opposite = plugin.CosineSimilarity( [ 1, 0, 0 ], [ -1, 0, 0 ] );
		ASSERT.ok( Math.abs( score_opposite + 1.0 ) < 0.0001, 'opposite vectors should score -1' );

		// Null/empty handling
		ASSERT.strictEqual( plugin.CosineSimilarity( null, [ 1 ] ), 0 );
		ASSERT.strictEqual( plugin.CosineSimilarity( [ 1, 2 ], [ 1 ] ), 0 );
	} );


	//=================================================================
	// EmbedText
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should embed text into a topic', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: TOPIC_NAME,
			SourceName: 'test-doc-1.txt',
			Text: 'Cats are small domesticated carnivorous mammals. They are often kept as pets and are valued for their companionship and ability to hunt pests.',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.ChunksStored > 0, 'should store at least one chunk' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should embed a second source', async function ()
	{
		var hive = await open_hive();
		await setup_entities( hive );

		var result = await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: TOPIC_NAME,
			SourceName: 'test-doc-2.txt',
			Text: 'Quantum mechanics is a fundamental theory in physics that describes the behavior of nature at and below the scale of atoms.',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.ChunksStored > 0, 'should store at least one chunk' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should report embedding method as llm', async function ()
	{
		var hive = await open_hive();

		// Read back the entity config to verify the method was locked
		var config_result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
		} );

		ASSERT.strictEqual( config_result.Result.EmbeddingMethod, 'llm:ollama-embed',
			'should lock to llm:ollama-embed' );
	} );


	//=================================================================
	// ListSources
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list embedded sources', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.ListSources', {
			TopicName: TOPIC_NAME,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.Count >= 2, 'should have at least 2 sources' );

		var source_names = result.Result.Sources.map( function ( s ) { return s.SourceName; } );
		ASSERT.ok( source_names.includes( 'test-doc-1.txt' ), 'should include test-doc-1.txt' );
		ASSERT.ok( source_names.includes( 'test-doc-2.txt' ), 'should include test-doc-2.txt' );

		// Each source should have a chunk count
		for ( var index = 0; index < result.Result.Sources.length; index++ )
		{
			ASSERT.ok( result.Result.Sources[ index ].ChunkCount > 0, 'each source should have chunks' );
		}
	} );


	//=================================================================
	// Search
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should search and return relevant results', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.Search', {
			TopicName: TOPIC_NAME,
			Text: 'cats and pets',
			MinScore: 0.1,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.Count > 0, 'should find results' );

		// Results should be sorted by score descending
		for ( var index = 1; index < result.Result.Results.length; index++ )
		{
			ASSERT.ok(
				result.Result.Results[ index - 1 ].Score >= result.Result.Results[ index ].Score,
				'results should be sorted by score descending'
			);
		}

		// Each result should have the expected fields
		var first_result = result.Result.Results[ 0 ];
		ASSERT.ok( first_result.EmbeddingID, 'should have EmbeddingID' );
		ASSERT.ok( first_result.SourceName, 'should have SourceName' );
		ASSERT.ok( first_result.ChunkText, 'should have ChunkText' );
		ASSERT.ok( typeof first_result.Score === 'number', 'Score should be a number' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should respect MaxResults', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.Search', {
			TopicName: TOPIC_NAME,
			Text: 'animals and science',
			MinScore: 0.0,
			MaxResults: 1,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.Count <= 1, 'should return at most 1 result' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter by SourceName glob', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.Search', {
			TopicName: TOPIC_NAME,
			Text: 'anything',
			SourceName: 'test-doc-1*',
			MinScore: 0.0,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( !result.Result.Error, result.Result.Error );

		// All results should be from test-doc-1.txt
		for ( var index = 0; index < result.Result.Results.length; index++ )
		{
			ASSERT.strictEqual( result.Result.Results[ index ].SourceName, 'test-doc-1.txt',
				'all results should be from test-doc-1.txt' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return no results for high MinScore', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.Search', {
			TopicName: TOPIC_NAME,
			Text: 'completely unrelated gibberish xyzzy',
			MinScore: 0.99,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.strictEqual( result.Result.Count, 0, 'should return no results at high min score' );
	} );


	//=================================================================
	// GetSource
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reconstruct a source document', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.GetSource', {
			TopicName: TOPIC_NAME,
			SourceName: 'test-doc-1.txt',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.strictEqual( result.Result.SourceName, 'test-doc-1.txt' );
		ASSERT.ok( result.Result.Text.length > 0, 'reconstructed text should not be empty' );
		ASSERT.ok( result.Result.ChunkCount > 0, 'should report chunk count' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should error for nonexistent source', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.GetSource', {
			TopicName: TOPIC_NAME,
			SourceName: 'does-not-exist.txt',
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'not found' ) > -1 );
	} );


	//=================================================================
	// RemoveSource
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should remove a source', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'Topic.RemoveSource', {
			TopicName: TOPIC_NAME,
			SourceName: 'test-doc-2.txt',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.RowsRemoved > 0, 'should remove at least one row' );

		// Verify it's gone
		var list_result = await hive.InvokeTool( 'Topic.ListSources', {
			TopicName: TOPIC_NAME,
		} );
		var source_names = list_result.Result.Sources.map( function ( s ) { return s.SourceName; } );
		ASSERT.ok( !source_names.includes( 'test-doc-2.txt' ), 'test-doc-2.txt should be gone' );

		// Embedding method should still be locked (test-doc-1 remains)
		var config_result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
		} );
		ASSERT.strictEqual( config_result.Result.EmbeddingMethod, 'llm:ollama-embed',
			'method should remain locked while sources exist' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should clear embedding method when last source is removed', async function ()
	{
		var hive = await open_hive();

		// Remove the last remaining source
		var result = await hive.InvokeTool( 'Topic.RemoveSource', {
			TopicName: TOPIC_NAME,
			SourceName: 'test-doc-1.txt',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.RowsRemoved > 0, 'should remove rows' );

		// Embedding method should now be cleared
		var config_result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
		} );
		ASSERT.strictEqual( config_result.Result.EmbeddingMethod, '',
			'method should be cleared after last source removed' );
	} );


	//=================================================================
	// RemoveAll
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should remove all sources and clear embedding method', async function ()
	{
		var hive = await open_hive();

		// Re-embed some data so RemoveAll has something to remove
		await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: TOPIC_NAME,
			SourceName: 'refill.txt',
			Text: 'Refill data for the RemoveAll test.',
		} );

		var result = await hive.InvokeTool( 'Topic.RemoveAll', {
			TopicName: TOPIC_NAME,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.ok( result.Result.RowsRemoved > 0, 'should remove at least one row' );

		// Verify everything is gone
		var list_result = await hive.InvokeTool( 'Topic.ListSources', {
			TopicName: TOPIC_NAME,
		} );
		ASSERT.strictEqual( list_result.Result.Count, 0, 'should have no sources left' );

		// Verify the embedding method was cleared
		var config_result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: TOPIC_NAME,
		} );
		ASSERT.strictEqual( config_result.Result.EmbeddingMethod, '',
			'embedding method should be cleared after RemoveAll' );
	} );


	//=================================================================
	// Hash-Based Embedding Fallback
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should produce deterministic hash embeddings', async function ()
	{
		var hive = await open_hive();
		var plugin = hive.Plugins.Topic;

		var vector_a = plugin.HashEmbed( 'The quick brown fox' );
		var vector_b = plugin.HashEmbed( 'The quick brown fox' );

		ASSERT.strictEqual( vector_a.length, plugin.HASH_DIMENSIONS, 'should have correct dimensions' );
		ASSERT.deepStrictEqual( vector_a, vector_b, 'same input should produce same vector' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should produce different hash vectors for different text', async function ()
	{
		var hive = await open_hive();
		var plugin = hive.Plugins.Topic;

		var vector_a = plugin.HashEmbed( 'Cats are wonderful pets' );
		var vector_b = plugin.HashEmbed( 'Quantum mechanics describes particles' );

		ASSERT.strictEqual( vector_a.length, vector_b.length, 'dimensions should match' );
		ASSERT.notDeepStrictEqual( vector_a, vector_b, 'different text should produce different vectors' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should produce normalized hash vectors', async function ()
	{
		var hive = await open_hive();
		var plugin = hive.Plugins.Topic;

		var vector = plugin.HashEmbed( 'Some text to embed into a vector' );

		// Compute magnitude — should be ~1.0 for a normalized vector
		var magnitude = 0;
		for ( var index = 0; index < vector.length; index++ )
		{
			magnitude += vector[ index ] * vector[ index ];
		}
		magnitude = Math.sqrt( magnitude );

		ASSERT.ok( Math.abs( magnitude - 1.0 ) < 0.0001, 'hash vector should be unit normalized' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should embed and search using hash fallback', async function ()
	{
		var hive = await open_hive();

		// Create a topic with no EmbeddingLlm (uses hash fallback)
		await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: HASH_TOPIC_NAME,
			Settings: {
				Description: 'Hash fallback test topic',
				EmbeddingLlm: '',
				SplitChunkSize: 512,
				SplitChunkOverlap: 50,
			},
		} );

		// Embed some text
		var embed_result = await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: HASH_TOPIC_NAME,
			SourceName: 'animals.txt',
			Text: 'Cats are small domesticated carnivorous mammals. Dogs are loyal companions.',
		} );

		ASSERT.ok( !embed_result.Error, embed_result.Error );
		ASSERT.ok( !embed_result.Result.Error, embed_result.Result.Error );
		ASSERT.ok( embed_result.Result.ChunksStored > 0, 'should store chunks' );
		ASSERT.strictEqual( embed_result.Result.EmbeddingMethod, 'hash', 'should use hash method' );

		// Embed a second source
		await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: HASH_TOPIC_NAME,
			SourceName: 'physics.txt',
			Text: 'Quantum mechanics is a fundamental theory in physics describing subatomic behavior.',
		} );

		// Search for something related to animals
		var search_result = await hive.InvokeTool( 'Topic.Search', {
			TopicName: HASH_TOPIC_NAME,
			Text: 'cats and dogs as pets',
			MinScore: 0.0,
		} );

		ASSERT.ok( !search_result.Error, search_result.Error );
		ASSERT.ok( !search_result.Result.Error, search_result.Result.Error );
		ASSERT.ok( search_result.Result.Count > 0, 'should find results' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should lock hash method in entity config', async function ()
	{
		var hive = await open_hive();

		var config_result = await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: HASH_TOPIC_NAME,
		} );

		ASSERT.strictEqual( config_result.Result.EmbeddingMethod, 'hash',
			'should be locked to hash method' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should error when embedding method changes', async function ()
	{
		var hive = await open_hive();

		// Try to change the hash topic to use an LLM
		await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: HASH_TOPIC_NAME,
			Settings: {
				EmbeddingLlm: 'ollama-embed',
			},
		} );

		var result = await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: HASH_TOPIC_NAME,
			SourceName: 'new-source.txt',
			Text: 'This should fail due to method mismatch.',
		} );

		ASSERT.strictEqual( result.Success, false, 'tool call should fail' );
		ASSERT.ok( result.Error, 'should have an error message' );
		ASSERT.ok( result.Error.indexOf( 'mismatch' ) > -1,
			'error should mention mismatch' );

		// Restore the config
		await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: HASH_TOPIC_NAME,
			Settings: {
				EmbeddingLlm: '',
			},
		} );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should allow method change after RemoveAll', async function ()
	{
		var hive = await open_hive();

		// RemoveAll should clear the lock
		await hive.InvokeTool( 'Topic.RemoveAll', {
			TopicName: HASH_TOPIC_NAME,
		} );

		// Now switch to LLM and embed — should succeed
		await hive.InvokeTool( 'Topic.ConfigEntity', {
			EntityName: HASH_TOPIC_NAME,
			Settings: {
				EmbeddingLlm: 'ollama-embed',
			},
		} );

		var result = await hive.InvokeTool( 'Topic.EmbedText', {
			TopicName: HASH_TOPIC_NAME,
			SourceName: 'after-reset.txt',
			Text: 'This should succeed after clearing the method lock.',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( !result.Result.Error, result.Result.Error );
		ASSERT.strictEqual( result.Result.EmbeddingMethod, 'llm:ollama-embed',
			'should now use llm method' );
	} );


} );
