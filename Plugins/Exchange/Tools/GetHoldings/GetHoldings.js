/*
	GetHoldings.js
---------------------------------------------------------------------
Gets all non-zero holdings for an account.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetHoldings';
	Tool.Description = 'Get all asset holdings for an account.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account.' },
		},
		required: [ 'EntityName', 'AccountName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The account name.' },
			Holdings: { type: 'array', description: 'Array of { AssetName, Quantity } for non-zero holdings.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check account exists
			var account_rows = store.Query(
				`SELECT AccountName FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( account_rows.length === 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] not found.` );
			}

			var holdings = store.Query(
				`SELECT AssetName, Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND Quantity > 0 ORDER BY AssetName`,
				[ Arguments.AccountName ]
			);

			return {
				AccountName: Arguments.AccountName,
				Holdings: holdings,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};