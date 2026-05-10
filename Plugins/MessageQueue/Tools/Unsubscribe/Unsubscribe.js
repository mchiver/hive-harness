/*
	Unsubscribe.js
---------------------------------------------------------------------
Removes a subscription from the queue.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Unsubscribe';
	Tool.Description = 'Remove a subscription by ID.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			SubscriptionId: { type: 'number', description: 'ID of the subscription to remove' },
		},
		required: [ 'EntityName', 'SubscriptionId' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var result = store.Execute( 'DELETE FROM subscriptions WHERE id = ?', [ Arguments.SubscriptionId ] );
			if ( result.RowsAffected === 0 ) { throw new Error( 'Subscription not found.' ); }
			return { Success: true };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
