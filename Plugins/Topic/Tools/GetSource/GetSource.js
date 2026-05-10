/*
	GetSource.js
---------------------------------------------------------------------
Reconstructs and returns a source document from a Topic entity
by concatenating all chunks in chronological order.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetSource';
	Tool.Description = 'Reconstruct and return a source document from a topic.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			TopicName: { type: 'string', description: 'Name of the Topic entity' },
			SourceName: { type: 'string', description: 'Name of the source to retrieve' },
		},
		required: [ 'TopicName', 'SourceName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			SourceName: { type: 'string', description: 'The source name' },
			Text: { type: 'string', description: 'The reconstructed source text' },
			ChunkCount: { type: 'number', description: 'Number of chunks used' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.TopicName );

			var rows = store.Query(
				`SELECT ChunkText FROM "${Plugin.EMBEDDINGS_TABLE}" WHERE SourceName = ? ORDER BY EmbeddedAt ASC`,
				[ Arguments.SourceName ]
			);

			if ( rows.length === 0 )
			{
				throw new Error( `Source [${Arguments.SourceName}] not found in topic [${Arguments.TopicName}].` );
			}

			// Reconstruct the document by concatenating chunks.
			// Because chunks overlap, we need to remove the overlapping portions.
			var config = await Plugin.GetEntityConfig( Hive, Arguments.TopicName );
			var chunk_overlap = config.SplitChunkOverlap || 50;

			var text = rows[ 0 ].ChunkText;
			for ( var index = 1; index < rows.length; index++ )
			{
				var chunk = rows[ index ].ChunkText;
				// Skip the overlap portion from the beginning of subsequent chunks
				if ( chunk_overlap > 0 && chunk.length > chunk_overlap )
				{
					text += chunk.substring( chunk_overlap );
				}
				else
				{
					text += chunk;
				}
			}

			return {
				SourceName: Arguments.SourceName,
				Text: text,
				ChunkCount: rows.length,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
