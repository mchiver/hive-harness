/*
	ListParticipants.js
---------------------------------------------------------------------
Lists all exchange participants.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListParticipants';
	Tool.Description = 'List all exchange participants.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				AccountName: { type: 'string', description: 'The participant account name.' },
				Role: { type: 'string', description: 'Participant role.' },
				ConversationName: { type: 'string', description: 'Conversation entity name.' },
				IsManufacturer: { type: 'number', description: 'Whether this participant is a manufacturer.' },
				ManufactureAsset: { type: 'string', description: 'Asset they produce.' },
				ManufactureRate: { type: 'number', description: 'Production rate per tick.' },
				IsActive: { type: 'number', description: 'Whether participant is active.' },
			},
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var rows = store.Query(
				`SELECT p.AccountName, p.Role, p.ConversationName, p.IsManufacturer, p.ManufactureAsset, p.ManufactureRate, p.IsActive, a.EcBalance FROM "${Plugin.PARTICIPANTS_TABLE}" p LEFT JOIN "${Plugin.ACCOUNTS_TABLE}" a ON p.AccountName = a.AccountName ORDER BY p.AccountName`
			);

			return rows;
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};