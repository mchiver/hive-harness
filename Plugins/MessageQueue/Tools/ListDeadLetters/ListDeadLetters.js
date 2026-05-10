/*
	ListDeadLetters.js
---------------------------------------------------------------------
View dead letter messages.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListDeadLetters';
	Tool.Description = 'List dead letter messages.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			Topic: { type: 'string', description: 'Filter by topic (optional)' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			DeadLetters: { type: 'array', description: 'Array of dead letter records' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var sql = 'SELECT * FROM dead_letters';
			var values = [];

			if ( Arguments.Topic )
			{
				sql += ' WHERE topic = ?';
				values.push( Arguments.Topic );
			}

			sql += ' ORDER BY id';

			var rows = store.Query( sql, values );
			var dead_letters = rows.map( function ( row )
			{
				return {
					DeadLetterId: row.id,
					OriginalMessageId: row.original_message_id,
					Topic: row.topic,
					Payload: JSON.parse( row.payload ),
					Error: row.error,
					CreatedAt: row.created_at,
				};
			} );
			return { DeadLetters: dead_letters };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
