/*
	CreditEc.js
---------------------------------------------------------------------
Adds EC to an account.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'CreditEc';
	Tool.Description = 'Add EC to an account.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account.' },
			Amount: { type: 'number', description: 'Amount of EC to add.' },
		},
		required: [ 'EntityName', 'AccountName', 'Amount' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The account name.' },
			EcBalance: { type: 'number', description: 'New EC balance.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			if ( Arguments.Amount <= 0 )
			{
				throw new Error( 'Amount must be positive.' );
			}

			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check account exists
			var existing = store.Query(
				`SELECT AccountName FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing.length === 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] not found.` );
			}

			store.Execute(
				`UPDATE "${Plugin.ACCOUNTS_TABLE}" SET EcBalance = EcBalance + ? WHERE AccountName = ?`,
				[ Arguments.Amount, Arguments.AccountName ]
			);

			var updated = store.Query(
				`SELECT EcBalance FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);

			return {
				AccountName: Arguments.AccountName,
				EcBalance: updated[ 0 ].EcBalance,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};