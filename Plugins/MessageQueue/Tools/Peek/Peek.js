/*
	Peek.js
---------------------------------------------------------------------
View pending messages without consuming them.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Peek';
	Tool.Description = 'View pending messages without consuming them.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			Topic: { type: 'string', description: 'Filter by topic (optional)' },
			Limit: { type: 'number', description: 'Maximum messages to return (default: 10)' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Messages: { type: 'array', description: 'Array of message records' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var limit = Arguments.Limit || 10;
			var sql = "SELECT * FROM messages WHERE status = 'pending'";
			var values = [];

			if ( Arguments.Topic )
			{
				sql += ' AND topic = ?';
				values.push( Arguments.Topic );
			}

			sql += ' ORDER BY id LIMIT ?';
			values.push( limit );

			var rows = store.Query( sql, values );
			var messages = rows.map( function ( row )
			{
				return {
					MessageId: row.id,
					Topic: row.topic,
					Payload: JSON.parse( row.payload ),
					Status: row.status,
					RetryCount: row.retry_count,
					CreatedAt: row.created_at,
				};
			} );
			return { Messages: messages };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
