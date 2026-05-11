/*
	Topic.factory.js
---------------------------------------------------------------------
Topic plugin factory - provides searchable knowledgebase (RAG) per entity.
Each topic entity is backed by a SQLite database storing text chunks
and their embedding vectors.
*/

const PATH = require( 'path' );
const CRYPTO = require( 'crypto' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Searchable knowledgebase (RAG) per entity.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [ 'Llm' ];

		// Topic is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a Topic entity.',
			properties: {
				Name: { type: 'string', description: 'Topic entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this topic.' },
				EmbeddingLlm: { type: 'string', default: '', description: 'Name of the Llm entity to use for generating embeddings.' },
				EmbeddingMethod: { type: 'string', default: '', description: 'Embedding method to use, e.g. "openai", "ollama".' },
				SplitChunkSize: { type: 'number', default: 512, description: 'Maximum size in characters for each text chunk when splitting documents.' },
				SplitChunkOverlap: { type: 'number', default: 50, description: 'Number of overlapping characters between consecutive chunks.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Table name for embeddings storage.
		Plugin.EMBEDDINGS_TABLE = 'Embeddings';


		//---------------------------------------------------------------------
		// SQL to create the embeddings table if it does not exist.
		Plugin.EMBEDDINGS_SCHEMA = `
			EmbeddingID TEXT PRIMARY KEY,
			SourceName TEXT NOT NULL,
			EmbeddedAt TEXT NOT NULL,
			ChunkText TEXT NOT NULL,
			Embeddings TEXT NOT NULL
		`;


		//---------------------------------------------------------------------
		// Open a database connection for a named entity.
		// Ensures the embeddings table exists.
		// Returns a SqlStore helper instance. Caller must call .Close() when done.
		Plugin.OpenDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, EntityName + '.db' );

			var store = new Hive.Helpers.SqlStore();
			store.Open( db_path, { JournalMode: 'wal', BusyTimeout: 5000 } );

			// Ensure the embeddings table exists
			var tables = store.ListTables();
			if ( !tables.includes( Plugin.EMBEDDINGS_TABLE ) )
			{
				store.Execute(
					`CREATE TABLE "${Plugin.EMBEDDINGS_TABLE}" ( ${Plugin.EMBEDDINGS_SCHEMA} )`
				);
			}

			return store;
		};


		//---------------------------------------------------------------------
		// Load entity config from disk.
		Plugin.GetEntityConfig = async function ( Hive, EntityName )
		{
			return await Hive.GetEntityConfig( this.PluginName, EntityName );
		};


		//---------------------------------------------------------------------
		// Split text into chunks with overlap.
		// Returns an array of strings.
		Plugin.SplitText = function ( Text, ChunkSize, ChunkOverlap )
		{
			if ( !Text || Text.length === 0 ) { return []; }
			if ( Text.length <= ChunkSize ) { return [ Text ]; }

			var chunks = [];
			var position = 0;
			var step = ChunkSize - ChunkOverlap;
			if ( step <= 0 ) { step = 1; }

			while ( position < Text.length )
			{
				var end = Math.min( position + ChunkSize, Text.length );
				chunks.push( Text.substring( position, end ) );
				if ( end >= Text.length ) { break; }
				position += step;
			}

			return chunks;
		};


		//---------------------------------------------------------------------
		// Compute cosine similarity between two vectors.
		// Returns a number between -1 and 1.
		Plugin.CosineSimilarity = function ( VectorA, VectorB )
		{
			if ( !VectorA || !VectorB ) { return 0; }
			if ( VectorA.length !== VectorB.length ) { return 0; }

			var dot_product = 0;
			var magnitude_a = 0;
			var magnitude_b = 0;

			for ( var index = 0; index < VectorA.length; index++ )
			{
				dot_product += VectorA[ index ] * VectorB[ index ];
				magnitude_a += VectorA[ index ] * VectorA[ index ];
				magnitude_b += VectorB[ index ] * VectorB[ index ];
			}

			magnitude_a = Math.sqrt( magnitude_a );
			magnitude_b = Math.sqrt( magnitude_b );

			if ( magnitude_a === 0 || magnitude_b === 0 ) { return 0; }

			return dot_product / ( magnitude_a * magnitude_b );
		};


		//---------------------------------------------------------------------
		// Hash-based embedding dimensions.
		Plugin.HASH_DIMENSIONS = 256;


		//---------------------------------------------------------------------
		// Generate a hash-based embedding vector from text.
		// Tokenizes text into character trigrams, hashes each into a
		// fixed-size vector, and normalizes to unit length.
		Plugin.HashEmbed = function ( Text )
		{
			if ( !Text || Text.length === 0 ) { return new Array( Plugin.HASH_DIMENSIONS ).fill( 0 ); }

			var dimensions = Plugin.HASH_DIMENSIONS;
			var vector = new Array( dimensions ).fill( 0 );

			// Normalize: lowercase and collapse whitespace
			var normalized = Text.toLowerCase().replace( /\s+/g, ' ' ).trim();

			// Generate character trigrams and hash each one
			for ( var index = 0; index < normalized.length - 2; index++ )
			{
				var trigram = normalized.substring( index, index + 3 );
				var hash = CRYPTO.createHash( 'md5' ).update( trigram ).digest();

				// Use first 4 bytes to pick a bucket, next byte for sign
				var bucket = hash.readUInt32LE( 0 ) % dimensions;
				var sign = ( hash[ 4 ] & 1 ) === 0 ? 1 : -1;
				vector[ bucket ] += sign;
			}

			// Normalize to unit length
			var magnitude = 0;
			for ( var index = 0; index < dimensions; index++ )
			{
				magnitude += vector[ index ] * vector[ index ];
			}
			magnitude = Math.sqrt( magnitude );
			if ( magnitude > 0 )
			{
				for ( var index = 0; index < dimensions; index++ )
				{
					vector[ index ] = vector[ index ] / magnitude;
				}
			}

			return vector;
		};


		//---------------------------------------------------------------------
		// Determine the embedding method string for a config.
		// Returns 'hash' or 'llm:<EntityName>'.
		Plugin.GetEmbeddingMethod = function ( Config )
		{
			if ( Config.EmbeddingLlm )
			{
				return 'llm:' + Config.EmbeddingLlm;
			}
			return 'hash';
		};


		//---------------------------------------------------------------------
		// Embed text using the appropriate method for the given config.
		// Returns the embedding vector.
		// Throws on error.
		Plugin.EmbedVector = async function ( Hive, Config, Text )
		{
			if ( Config.EmbeddingLlm )
			{
				// Use the Llm plugin
				var embed_result = await Hive.InvokeTool( 'Llm.EmbedText', {
					EntityName: Config.EmbeddingLlm,
					Text: Text,
				} );

				if ( !embed_result.Success )
				{
					throw new Error( embed_result.Error );
				}
				if ( embed_result.Result.Error )
				{
					throw new Error( embed_result.Result.Error );
				}

				return embed_result.Result.Vector;
			}

			// Fallback to hash-based embedding
			return Plugin.HashEmbed( Text );
		};


		//---------------------------------------------------------------------
		// Verify and lock the embedding method for a topic.
		// On first embed, saves the method to the entity config.
		// On subsequent embeds, verifies the method matches.
		// Returns the current embedding method string.
		Plugin.LockEmbeddingMethod = async function ( Hive, Config, EntityName )
		{
			var current_method = Plugin.GetEmbeddingMethod( Config );

			if ( !Config.EmbeddingMethod )
			{
				// First use — lock the method
				var entity_folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
				var config_path = PATH.join( entity_folder, EntityName + '.entity.json' );
				Config.EmbeddingMethod = current_method;
				await Hive.Helpers.FileUtils.WriteJson( config_path, Config );
				return current_method;
			}

			// Verify the method matches
			if ( Config.EmbeddingMethod !== current_method )
			{
				throw new Error(
					`Embedding method mismatch for topic [${EntityName}]. ` +
					`Topic is locked to [${Config.EmbeddingMethod}] but current config resolves to [${current_method}]. ` +
					`Use RemoveAll to reset the topic before changing embedding methods.`
				);
			}

			return current_method;
		};


		//---------------------------------------------------------------------
		// Clear the embedding method lock on a topic entity.
		// Called when all embeddings have been removed.
		Plugin.ClearEmbeddingMethod = async function ( Hive, EntityName )
		{
			var config = await Plugin.GetEntityConfig( Hive, EntityName );
			if ( config.EmbeddingMethod )
			{
				config.EmbeddingMethod = '';
				var entity_folder = await Hive.GetEntityDataPath( Plugin.PluginName, EntityName );
				var config_path = PATH.join( entity_folder, EntityName + '.entity.json' );
				await Hive.Helpers.FileUtils.WriteJson( config_path, config );
			}
		};


		//---------------------------------------------------------------------
		// Generate a new UUID.
		Plugin.NewID = function ()
		{
			return CRYPTO.randomUUID();
		};


		return Plugin;
	}
}

module.exports = Factory;
