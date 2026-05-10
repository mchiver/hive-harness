/*
	GetAccount.js
---------------------------------------------------------------------
Gets an account's EC balance and holdings.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetAccount';
	Tool.Description = 'Get an account balance and holdings.';

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
			EcBalance: { type: 'number', description: 'Current EC balance.' },
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

			// Get account
			var account_rows = store.Query(
				`SELECT AccountName, EcBalance FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( account_rows.length === 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] not found.` );
			}

			var account = account_rows[ 0 ];

			// Get holdings
			var holdings = store.Query(
				`SELECT AssetName, Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND Quantity > 0 ORDER BY AssetName`,
				[ Arguments.AccountName ]
			);

			return {
				AccountName: account.AccountName,
				EcBalance: account.EcBalance,
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