/*
	GetOrderBook.js
---------------------------------------------------------------------
Gets the current order book (bids and asks) for an asset.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetOrderBook';
	Tool.Description = 'Get the current order book (bids and asks) for an asset.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AssetName: { type: 'string', description: 'Name of the asset.' },
			Depth: { type: 'number', description: 'Number of price levels to return per side (default: 10).' },
		},
		required: [ 'EntityName', 'AssetName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AssetName: { type: 'string', description: 'The asset name.' },
			Bids: { type: 'array', description: 'Array of { Price, Quantity, OrderCount } for bid side.' },
			Asks: { type: 'array', description: 'Array of { Price, Quantity, OrderCount } for ask side.' },
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

			var depth = Arguments.Depth || 10;

			// Aggregate bids by price level (highest first)
			var bids = store.Query(
				`SELECT Price, SUM( Quantity - FilledQuantity ) AS Quantity, COUNT( * ) AS OrderCount FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'buy' AND Status IN ( 'open', 'partial' ) GROUP BY Price ORDER BY Price DESC LIMIT ?`,
				[ Arguments.AssetName, depth ]
			);

			// Aggregate asks by price level (lowest first)
			var asks = store.Query(
				`SELECT Price, SUM( Quantity - FilledQuantity ) AS Quantity, COUNT( * ) AS OrderCount FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'sell' AND Status IN ( 'open', 'partial' ) GROUP BY Price ORDER BY Price ASC LIMIT ?`,
				[ Arguments.AssetName, depth ]
			);

			return {
				AssetName: Arguments.AssetName,
				Bids: bids,
				Asks: asks,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};