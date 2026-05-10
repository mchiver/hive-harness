/*
	Reject.js
---------------------------------------------------------------------
Reject a message. Retries if under max retries, otherwise moves to dead letter.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Reject';
	Tool.Description = 'Reject a message. Retries or moves to dead letter queue.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			MessageId: { type: 'number', description: 'ID of the message to reject' },
			Reason: { type: 'string', description: 'Reason for rejection (optional)' },
		},
		required: [ 'EntityName', 'MessageId' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Action: { type: 'string', description: '"retried" or "dead_lettered"' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var now = new Date().toISOString();
			var settings = await Plugin.GetEntitySettings( Hive, Arguments.EntityName );

			var rows = store.Query( 'SELECT * FROM messages WHERE id = ?', [ Arguments.MessageId ] );
			if ( rows.length === 0 ) { throw new Error( 'Message not found.' ); }

			var message = rows[ 0 ];
			var new_retry_count = message.retry_count + 1;

			if ( new_retry_count >= settings.MaxRetries )
			{
				// Move to dead letter queue
				store.Execute(
					'INSERT INTO dead_letters ( original_message_id, topic, payload, error, created_at ) VALUES ( ?, ?, ?, ?, ? )',
					[ message.id, message.topic, message.payload, Arguments.Reason || 'Max retries exceeded', now ]
				);
				store.Execute(
					"UPDATE messages SET status = 'failed', retry_count = ?, updated_at = ? WHERE id = ?",
					[ new_retry_count, now, message.id ]
				);
				return { Action: 'dead_lettered' };
			}
			else
			{
				// Retry: set back to pending with incremented retry count
				store.Execute(
					"UPDATE messages SET status = 'pending', retry_count = ?, updated_at = ? WHERE id = ?",
					[ new_retry_count, now, message.id ]
				);
				return { Action: 'retried' };
			}
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
