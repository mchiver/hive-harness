/*
	ListSubscriptions.js
---------------------------------------------------------------------
Lists all subscriptions on the queue.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListSubscriptions';
	Tool.Description = 'List all subscriptions on a queue.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Subscriptions: { type: 'array', description: 'Array of subscription records' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var rows = store.Query( 'SELECT * FROM subscriptions ORDER BY id' );
			var subscriptions = rows.map( function ( row )
			{
				return {
					SubscriptionId: row.id,
					TopicPattern: row.topic_pattern,
					Mode: row.mode,
					ToolCall: row.tool_call ? JSON.parse( row.tool_call ) : null,
					CreatedAt: row.created_at,
				};
			} );
			return { Subscriptions: subscriptions };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
