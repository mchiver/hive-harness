/*
	GetMarketSummary.js
---------------------------------------------------------------------
Gets a summary of all assets: last price, bid/ask spread, volume.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetMarketSummary';
	Tool.Description = 'Get a summary of all assets with prices, spreads, and volumes.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Assets: { type: 'array', description: 'Array of asset summary objects.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var assets = store.Query(
				`SELECT AssetName, DisplayName, TotalSupply, CirculatingSupply FROM "${Plugin.ASSETS_TABLE}" ORDER BY AssetName`
			);

			var summary = [];

			for ( var index = 0; index < assets.length; index++ )
			{
				var asset = assets[ index ];

				// Last trade price
				var last_price_rows = store.Query(
					`SELECT Price FROM "${Plugin.TRADES_TABLE}" WHERE AssetName = ? ORDER BY TradeId DESC LIMIT 1`,
					[ asset.AssetName ]
				);
				var last_price = ( last_price_rows.length > 0 ) ? last_price_rows[ 0 ].Price : null;

				// Best bid
				var best_bid_rows = store.Query(
					`SELECT MAX( Price ) AS BestBid FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'buy' AND Status IN ( 'open', 'partial' )`,
					[ asset.AssetName ]
				);
				var best_bid = ( best_bid_rows.length > 0 && best_bid_rows[ 0 ].BestBid ) ? best_bid_rows[ 0 ].BestBid : null;

				// Best ask
				var best_ask_rows = store.Query(
					`SELECT MIN( Price ) AS BestAsk FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'sell' AND Status IN ( 'open', 'partial' )`,
					[ asset.AssetName ]
				);
				var best_ask = ( best_ask_rows.length > 0 && best_ask_rows[ 0 ].BestAsk ) ? best_ask_rows[ 0 ].BestAsk : null;

				// Total volume (all-time)
				var volume_rows = store.Query(
					`SELECT COALESCE( SUM( Quantity ), 0 ) AS TotalVolume FROM "${Plugin.TRADES_TABLE}" WHERE AssetName = ?`,
					[ asset.AssetName ]
				);
				var total_volume = volume_rows[ 0 ].TotalVolume;

				// Spread
				var spread = ( best_bid !== null && best_ask !== null ) ? ( best_ask - best_bid ) : null;

				summary.push( {
					AssetName: asset.AssetName,
					DisplayName: asset.DisplayName,
					LastPrice: last_price,
					BestBid: best_bid,
					BestAsk: best_ask,
					Spread: spread,
					TotalVolume: total_volume,
					CirculatingSupply: asset.CirculatingSupply,
					TotalSupply: asset.TotalSupply,
				} );
			}

			return {
				Assets: summary,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};