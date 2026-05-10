/*
	DebitHolding.js
---------------------------------------------------------------------
Removes asset units from an account's holdings.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'DebitHolding';
	Tool.Description = 'Remove asset units from an account holdings.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account.' },
			AssetName: { type: 'string', description: 'Name of the asset.' },
			Quantity: { type: 'number', description: 'Number of units to remove.' },
		},
		required: [ 'EntityName', 'AccountName', 'AssetName', 'Quantity' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The account name.' },
			AssetName: { type: 'string', description: 'The asset name.' },
			Quantity: { type: 'number', description: 'New holding quantity.' },
			Destroyed: { type: 'boolean', description: 'Whether the removed assets were destroyed (reduced circulating supply).' },
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

			// Check holding exists and has sufficient quantity
			var existing = store.Query(
				`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
				[ Arguments.AccountName, Arguments.AssetName ]
			);
			if ( existing.length === 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] has no holdings of [${Arguments.AssetName}].` );
			}
			if ( existing[ 0 ].Quantity < Arguments.Quantity )
			{
				throw new Error( `Insufficient holdings. Current: ${existing[ 0 ].Quantity}, Requested: ${Arguments.Quantity}.` );
			}

			// Debit holding
			store.Execute(
				`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity - ? WHERE AccountName = ? AND AssetName = ?`,
				[ Arguments.Quantity, Arguments.AccountName, Arguments.AssetName ]
			);

			// Determine if assets are destroyed (removed from circulation)
			var destroyed = Arguments.Destroyed || false;

			if ( destroyed )
			{
				// Reduce circulating supply
				store.Execute(
					`UPDATE "${Plugin.ASSETS_TABLE}" SET CirculatingSupply = CirculatingSupply - ? WHERE AssetName = ?`,
					[ Arguments.Quantity, Arguments.AssetName ]
				);
			}

			// Get updated quantity
			var updated = store.Query(
				`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
				[ Arguments.AccountName, Arguments.AssetName ]
			);

			var new_quantity = ( updated.length > 0 ) ? updated[ 0 ].Quantity : 0;

			return {
				AccountName: Arguments.AccountName,
				AssetName: Arguments.AssetName,
				Quantity: new_quantity,
				Destroyed: destroyed,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};