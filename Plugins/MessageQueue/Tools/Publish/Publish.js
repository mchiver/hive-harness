/*
	Publish.js
---------------------------------------------------------------------
Publishes a message to the queue. Auto-invokes matching invoke-mode subscriptions.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Publish';
	Tool.Description = 'Publish a message to a topic on the queue.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			Topic: { type: 'string', description: 'Topic/routing key for the message' },
			Payload: { description: 'Message payload (any JSON-serializable value)' },
		},
		required: [ 'EntityName', 'Topic', 'Payload' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			MessageId: { type: 'number', description: 'ID of the published message' },
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
			var payload_json = JSON.stringify( Arguments.Payload );

			// Insert the message
			var insert_result = store.Execute(
				'INSERT INTO messages ( topic, payload, status, created_at, updated_at ) VALUES ( ?, ?, ?, ?, ? )',
				[ Arguments.Topic, payload_json, 'pending', now, now ]
			);
			var message_id = insert_result.LastInsertId;

			// Find invoke-mode subscriptions matching this topic
			var subscriptions = store.Query( "SELECT * FROM subscriptions WHERE mode = 'invoke'" );
			var matching = Plugin.FindMatchingSubscriptions( Hive, subscriptions, Arguments.Topic );

			// Close the database before invoking tools (they may open their own connections)
			store.Close();
			store = null;

			// Execute invoke-mode subscriptions
			var settings = await Plugin.GetEntitySettings( Hive, Arguments.EntityName );
			for ( var sub of matching )
			{
				var tool_call = JSON.parse( sub.tool_call );
				var merged_arguments = Object.assign( {}, tool_call.Arguments || {}, {
					_MessageId: message_id,
					_Topic: Arguments.Topic,
					_Payload: Arguments.Payload,
				} );

				try
				{
					await Hive.Helpers.CommandProcessor.Invoke(
						Hive, tool_call.PluginName, tool_call.ToolName, merged_arguments
					);
				}
				catch ( error )
				{
					// On invoke failure, move to dead letter if max retries exceeded
					var dlq_store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
					try
					{
						var msg = dlq_store.Query( 'SELECT * FROM messages WHERE id = ?', [ message_id ] );
						if ( msg.length > 0 && msg[ 0 ].retry_count >= settings.MaxRetries )
						{
							dlq_store.Execute(
								'INSERT INTO dead_letters ( original_message_id, topic, payload, error, created_at ) VALUES ( ?, ?, ?, ?, ? )',
								[ message_id, Arguments.Topic, payload_json, error.message, now ]
							);
							dlq_store.Execute( "UPDATE messages SET status = 'failed', updated_at = ? WHERE id = ?", [ now, message_id ] );
						}
						else
						{
							dlq_store.Execute(
								"UPDATE messages SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?",
								[ now, message_id ]
							);
						}
					}
					finally
					{
						dlq_store.Close();
					}
				}
			}

			return { MessageId: message_id };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
