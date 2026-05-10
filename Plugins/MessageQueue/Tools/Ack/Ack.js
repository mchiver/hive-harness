/*
	Ack.js
---------------------------------------------------------------------
Acknowledge a message, marking it as completed.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Ack';
	Tool.Description = 'Acknowledge a message as completed.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the MessageQueue entity' },
			MessageId: { type: 'number', description: 'ID of the message to acknowledge' },
		},
		required: [ 'EntityName', 'MessageId' ],
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
			var now = new Date().toISOString();
			var result = store.Execute(
				"UPDATE messages SET status = 'completed', updated_at = ? WHERE id = ?",
				[ now, Arguments.MessageId ]
			);
			if ( result.RowsAffected === 0 ) { throw new Error( 'Message not found.' ); }
			return { Success: true };
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
