/*
	RemoveAll.js
---------------------------------------------------------------------
Removes all embeddings from a Topic entity, resetting it.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RemoveAll';
	Tool.Description = 'Remove all sources and embeddings from a topic.';

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
				`DELETE FROM "${Plugin.EMBEDDINGS_TABLE}"`
			);

			// Clear the locked embedding method so the topic can be re-used
			// with a different method after reset.
			await Plugin.ClearEmbeddingMethod( Hive, Arguments.TopicName );

			return { RowsRemoved: result.RowsAffected };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
