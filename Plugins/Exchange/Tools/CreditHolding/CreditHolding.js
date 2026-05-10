/*
	CreditHolding.js
---------------------------------------------------------------------
Adds asset units to an account's holdings.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'CreditHolding';
	Tool.Description = 'Add asset units to an account holdings.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account.' },
			AssetName: { type: 'string', description: 'Name of the asset.' },
			Quantity: { type: 'number', description: 'Number of units to add.' },
		},
		required: [ 'EntityName', 'AccountName', 'AssetName', 'Quantity' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The account name.' },
			AssetName: { type: 'string', description: 'The asset name.' },
			Quantity: { type: 'number', description: 'New holding quantity.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			if ( Arguments.Quantity <= 0 )
			{
				throw new Error( 'Quantity must be positive.' );
			}

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

			// Check asset exists
			var asset_rows = store.Query(
				`SELECT AssetName FROM "${Plugin.ASSETS_TABLE}" WHERE AssetName = ?`,
				[ Arguments.AssetName ]
			);
			if ( asset_rows.length === 0 )
			{
				throw new Error( `Asset [${Arguments.AssetName}] not found.` );
			}

			// Upsert holding
			var existing = store.Query(
				`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
				[ Arguments.AccountName, Arguments.AssetName ]
			);

			if ( existing.length > 0 )
			{
				store.Execute(
					`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity + ? WHERE AccountName = ? AND AssetName = ?`,
					[ Arguments.Quantity, Arguments.AccountName, Arguments.AssetName ]
				);
			}
			else
			{
				store.Execute(
					`INSERT INTO "${Plugin.HOLDINGS_TABLE}" ( AccountName, AssetName, Quantity ) VALUES ( ?, ?, ? )`,
					[ Arguments.AccountName, Arguments.AssetName, Arguments.Quantity ]
				);
			}

			// Update circulating supply
			store.Execute(
				`UPDATE "${Plugin.ASSETS_TABLE}" SET CirculatingSupply = CirculatingSupply + ? WHERE AssetName = ?`,
				[ Arguments.Quantity, Arguments.AssetName ]
			);

			// Get updated quantity
			var updated = store.Query(
				`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
				[ Arguments.AccountName, Arguments.AssetName ]
			);

			return {
				AccountName: Arguments.AccountName,
				AssetName: Arguments.AssetName,
				Quantity: updated[ 0 ].Quantity,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};