/*
	ListSources.js
---------------------------------------------------------------------
Lists all distinct sources stored in a Topic entity.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListSources';
	Tool.Description = 'List all sources in a topic.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			TopicName: { type: 'string', description: 'Name of the Topic entity' },
		},
		required: [ 'TopicName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Sources: { type: 'array', description: 'Array of { SourceName, ChunkCount }' },
			Count: { type: 'number', description: 'Number of sources' },
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
				`SELECT SourceName, COUNT(*) as ChunkCount FROM "${Plugin.EMBEDDINGS_TABLE}" GROUP BY SourceName ORDER BY SourceName`
			);

			var sources = rows.map( function ( row )
			{
				return {
					SourceName: row.SourceName,
					ChunkCount: row.ChunkCount,
				};
			} );

			return {
				Sources: sources,
				Count: sources.length,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
