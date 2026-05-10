/*
	Search.js
---------------------------------------------------------------------
Searches a Topic entity for text similar to the query.
Embeds the query text, then computes cosine similarity against all
stored embeddings, returning ranked results above the minimum score.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Search';
	Tool.Description = 'Search a topic for text similar to a query.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			TopicName: { type: 'string', description: 'Name of the Topic entity' },
			SourceName: { type: 'string', description: 'Source name filter (glob pattern or empty for all)' },
			Text: { type: 'string', description: 'The text to search for' },
			MinScore: { type: 'number', description: 'Minimum similarity score (default 0.3)' },
			MaxResults: { type: 'number', description: 'Maximum number of results (0 or missing for all)' },
		},
		required: [ 'TopicName', 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Results: { type: 'array', description: 'Ranked array of { EmbeddingID, SourceName, ChunkText, Score }' },
			Count: { type: 'number', description: 'Number of results returned' },
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

			// Embed the query text using the same method as stored embeddings
			var query_vector = await Plugin.EmbedVector( Hive, config, Arguments.Text );

			// Open the database and retrieve stored embeddings
			store = await Plugin.OpenDatabase( Hive, Arguments.TopicName );

			var sql = `SELECT EmbeddingID, SourceName, ChunkText, Embeddings FROM "${Plugin.EMBEDDINGS_TABLE}"`;
			var values = null;

			// Apply source name filter
			if ( Arguments.SourceName )
			{
				var like_pattern = Hive.Helpers.Strings.GlobToSqlLike( Arguments.SourceName );
				sql += ` WHERE SourceName LIKE ? ESCAPE '\\'`;
				values = [ like_pattern ];
			}

			var rows = store.Query( sql, values );

			// Compute cosine similarity for each row
			var min_score = ( Arguments.MinScore !== undefined ) ? Arguments.MinScore : 0.3;
			var results = [];

			for ( var index = 0; index < rows.length; index++ )
			{
				var row = rows[ index ];
				var stored_vector = JSON.parse( row.Embeddings );
				var score = Plugin.CosineSimilarity( query_vector, stored_vector );

				if ( score >= min_score )
				{
					results.push( {
						EmbeddingID: row.EmbeddingID,
						SourceName: row.SourceName,
						ChunkText: row.ChunkText,
						Score: Math.round( score * 10000 ) / 10000,
					} );
				}
			}

			// Sort by score descending
			results.sort( function ( a, b ) { return b.Score - a.Score; } );

			// Apply max results limit
			if ( Arguments.MaxResults && Arguments.MaxResults > 0 )
			{
				results = results.slice( 0, Arguments.MaxResults );
			}

			return {
				Results: results,
				Count: results.length,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
