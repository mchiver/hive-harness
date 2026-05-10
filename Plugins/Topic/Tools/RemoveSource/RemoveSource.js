/*
	RemoveSource.js
---------------------------------------------------------------------
Removes all embeddings for a given source from a Topic entity.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RemoveSource';
	Tool.Description = 'Remove all entries for a source from a topic.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			TopicName: { type: 'string', description: 'Name of the Topic entity' },
			SourceName: { type: 'string', description: 'Name of the source to remove' },
		},
		required: [ 'TopicName', 'SourceName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			RowsRemoved: { type: 'number', description: 'Number of embedding rows removed' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.TopicName );

			var result = store.Execute(
				`DELETE FROM "${Plugin.EMBEDDINGS_TABLE}" WHERE SourceName = ?`,
				[ Arguments.SourceName ]
			);

			// If no rows remain, clear the embedding method lock
			var remaining = store.Query(
				`SELECT COUNT(*) as Total FROM "${Plugin.EMBEDDINGS_TABLE}"`
			);
			if ( remaining[ 0 ].Total === 0 )
			{
				await Plugin.ClearEmbeddingMethod( Hive, Arguments.TopicName );
			}

			return { RowsRemoved: result.RowsAffected };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
