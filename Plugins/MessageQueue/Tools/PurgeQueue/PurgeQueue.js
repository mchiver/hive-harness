/*
	PurgeQueue.js
---------------------------------------------------------------------
Remove messages from the queue by filter.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'PurgeQueue';
	Tool.Description = 'Remove messages from the queue by filter.';

	Tool.MinimumRole = 'admin';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			Topic: { type: 'string', description: 'Filter by topic (optional)' },
			Status: { type: 'string', description: 'Filter by status (optional)' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Purged: { type: 'number', description: 'Number of messages removed' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var sql = 'DELETE FROM messages WHERE 1=1';
			var values = [];

			if ( Arguments.Topic )
			{
				sql += ' AND topic = ?';
				values.push( Arguments.Topic );
			}
			if ( Arguments.Status )
			{
				sql += ' AND status = ?';
				values.push( Arguments.Status );
			}

			var result = store.Execute( sql, values );
			return { Purged: result.RowsAffected };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
