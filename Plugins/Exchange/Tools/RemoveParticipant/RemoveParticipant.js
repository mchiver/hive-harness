/*
	RemoveParticipant.js
---------------------------------------------------------------------
Deactivates a participant on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RemoveParticipant';
	Tool.Description = 'Deactivate a participant on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the participant account.' },
		},
		required: [ 'EntityName', 'AccountName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The participant account name.' },
			IsActive: { type: 'boolean', description: 'New active state (always false).' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check participant exists
			var existing = store.Query(
				`SELECT AccountName FROM "${Plugin.PARTICIPANTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing.length === 0 )
			{
				throw new Error( `Participant [${Arguments.AccountName}] not found.` );
			}

			// Cancel all open orders for this participant
			store.Execute(
				`UPDATE "${Plugin.ORDERS_TABLE}" SET Status = 'cancelled', UpdatedAt = ? WHERE AccountName = ? AND Status IN ( 'open', 'partial' )`,
				[ new Date().toISOString(), Arguments.AccountName ]
			);

			// Deactivate the participant
			store.Execute(
				`UPDATE "${Plugin.PARTICIPANTS_TABLE}" SET IsActive = 0 WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);

			return {
				AccountName: Arguments.AccountName,
				IsActive: false,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};