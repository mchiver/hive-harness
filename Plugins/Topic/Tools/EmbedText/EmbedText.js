/*
	EmbedText.js
---------------------------------------------------------------------
Embeds text into a Topic entity.
Splits the text into chunks, generates embeddings via the configured
Embedding LLM or hash-based fallback, and stores the chunks with
their vectors.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'EmbedText';
	Tool.Description = 'Embed text into a topic, splitting into chunks and storing embeddings.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			TopicName: { type: 'string', description: 'Name of the Topic entity' },
			SourceName: { type: 'string', description: 'Name of the source' },
			Text: { type: 'string', description: 'The text to embed' },
		},
		required: [ 'TopicName', 'SourceName', 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			ChunksStored: { type: 'number', description: 'Number of chunks embedded and stored' },
			EmbeddingMethod: { type: 'string', description: 'The embedding method used' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			// Load entity config
			var config = await Plugin.GetEntityConfig( Hive, Arguments.TopicName );

			// Verify and lock the embedding method
			var method = await Plugin.LockEmbeddingMethod( Hive, config, Arguments.TopicName );

			// Split text into chunks
			var chunk_size = config.SplitChunkSize || 512;
			var chunk_overlap = config.SplitChunkOverlap || 50;
			var chunks = Plugin.SplitText( Arguments.Text, chunk_size, chunk_overlap );

			if ( chunks.length === 0 )
			{
				throw new Error( 'No text to embed.' );
			}

			// Open the database
			store = await Plugin.OpenDatabase( Hive, Arguments.TopicName );

			// Embed each chunk and store it
			var chunks_stored = 0;
			for ( var index = 0; index < chunks.length; index++ )
			{
				var chunk_text = chunks[ index ];

				// Generate embedding via the configured method
				var vector = await Plugin.EmbedVector( Hive, config, chunk_text );

				// Store the embedding
				var embedding_id = Plugin.NewID();
				var embedded_at = new Date().toISOString();

				store.Execute(
					`INSERT INTO "${Plugin.EMBEDDINGS_TABLE}" ( EmbeddingID, SourceName, EmbeddedAt, ChunkText, Embeddings ) VALUES ( ?, ?, ?, ?, ? )`,
					[
						embedding_id,
						Arguments.SourceName,
						embedded_at,
						chunk_text,
						JSON.stringify( vector ),
					]
				);

				chunks_stored++;
			}

			return { ChunksStored: chunks_stored, EmbeddingMethod: method };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
