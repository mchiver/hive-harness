/*
	GetAssetPrice.js
---------------------------------------------------------------------
Gets the last trade price for an asset.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetAssetPrice';
	Tool.Description = 'Get the last trade price for an asset.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AssetName: { type: 'string', description: 'Name of the asset.' },
		},
		required: [ 'EntityName', 'AssetName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AssetName: { type: 'string', description: 'The asset name.' },
			LastPrice: { type: 'number', description: 'Last trade price, or null if no trades.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check asset exists
			var asset_rows = store.Query(
				`SELECT AssetName FROM "${Plugin.ASSETS_TABLE}" WHERE AssetName = ?`,
				[ Arguments.AssetName ]
			);
			if ( asset_rows.length === 0 )
			{
				throw new Error( `Asset [${Arguments.AssetName}] not found.` );
			}

			var last_price = Plugin.GetLastTradePrice( store, Arguments.AssetName );

			return {
				AssetName: Arguments.AssetName,
				LastPrice: last_price,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};