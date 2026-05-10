/*
	RegisterAsset.js
---------------------------------------------------------------------
Registers a new tradeable asset on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RegisterAsset';
	Tool.Description = 'Register a new tradeable asset on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AssetName: { type: 'string', description: 'Unique identifier for the asset (e.g. "iron", "grain").' },
			DisplayName: { type: 'string', description: 'Human-readable name (e.g. "Swift Iron").' },
			InitialSupply: { type: 'number', description: 'Initial total supply of this asset.' },
		},
		required: [ 'EntityName', 'AssetName', 'DisplayName', 'InitialSupply' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AssetName: { type: 'string', description: 'The registered asset name.' },
			DisplayName: { type: 'string', description: 'The display name.' },
			TotalSupply: { type: 'number', description: 'Total supply.' },
			CirculatingSupply: { type: 'number', description: 'Circulating supply (initially equals total).' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check if asset already exists
			var existing = store.Query(
				`SELECT AssetName FROM "${Plugin.ASSETS_TABLE}" WHERE AssetName = ?`,
				[ Arguments.AssetName ]
			);
			if ( existing.length > 0 )
			{
				throw new Error( `Asset [${Arguments.AssetName}] already exists.` );
			}

			var initial_supply = Arguments.InitialSupply || 0;

			store.Execute(
				`INSERT INTO "${Plugin.ASSETS_TABLE}" ( AssetName, DisplayName, TotalSupply, CirculatingSupply ) VALUES ( ?, ?, ?, ? )`,
				[ Arguments.AssetName, Arguments.DisplayName, initial_supply, initial_supply ]
			);

			return {
				AssetName: Arguments.AssetName,
				DisplayName: Arguments.DisplayName,
				TotalSupply: initial_supply,
				CirculatingSupply: initial_supply,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};