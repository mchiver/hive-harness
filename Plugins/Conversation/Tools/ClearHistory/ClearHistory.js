/*
	ClearHistory.js
---------------------------------------------------------------------
Clears all chat history entries for a conversation.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ClearHistory';
	Tool.Description = 'Clear all history entries for a conversation.';

	Tool.MinimumRole = 'admin';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Conversation entity.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			RowsRemoved: { type: 'number', description: 'Number of history entries removed.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			// Verify entity exists
			await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

			store = await Plugin.OpenHistoryDatabase( Hive, Arguments.EntityName );
			store.Execute( `DELETE FROM "${Plugin.TOOLS_TABLE}"` );
			var result = store.Execute( `DELETE FROM "${Plugin.MESSAGES_TABLE}"` );

			return {
				RowsRemoved: result.RowsAffected,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};
