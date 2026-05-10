/*
	Subscribe.js
---------------------------------------------------------------------
Registers a subscription on the queue.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Subscribe';
	Tool.Description = 'Register a subscription for a topic pattern.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			TopicPattern: { type: 'string', description: 'Topic glob pattern (e.g. "order.*")' },
			Mode: { type: 'string', description: 'Subscription mode: "notify" or "invoke"' },
			ToolCall: {
				type: 'object',
				description: 'For invoke mode: { PluginName, ToolName, Arguments }',
			},
		},
		required: [ 'EntityName', 'TopicPattern', 'Mode' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			SubscriptionId: { type: 'number', description: 'ID of the created subscription' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			if ( Arguments.Mode !== 'notify' && Arguments.Mode !== 'invoke' )
			{
				throw new Error( 'Mode must be "notify" or "invoke".' );
			}
			if ( Arguments.Mode === 'invoke' && !Arguments.ToolCall )
			{
				throw new Error( 'ToolCall is required for invoke mode.' );
			}

			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var now = new Date().toISOString();
			var tool_call_json = Arguments.ToolCall ? JSON.stringify( Arguments.ToolCall ) : null;

			var result = store.Execute(
				'INSERT INTO subscriptions ( topic_pattern, mode, tool_call, created_at ) VALUES ( ?, ?, ?, ? )',
				[ Arguments.TopicPattern, Arguments.Mode, tool_call_json, now ]
			);

			return { SubscriptionId: result.LastInsertId };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
