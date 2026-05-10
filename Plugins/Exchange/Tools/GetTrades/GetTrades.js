/*
	GetTrades.js
---------------------------------------------------------------------
Gets recent trades for an asset.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetTrades';
	Tool.Description = 'Get recent trades for an asset.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AssetName: { type: 'string', description: 'Name of the asset.' },
			Limit: { type: 'number', description: 'Maximum number of trades to return (default: 20).' },
		},
		required: [ 'EntityName', 'AssetName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AssetName: { type: 'string', description: 'The asset name.' },
			Trades: { type: 'array', description: 'Array of trade records.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var limit = Arguments.Limit || 20;

			var trades = store.Query(
				`SELECT TradeId, AssetName, BuyerAccount, SellerAccount, Price, Quantity, TradedAt FROM "${Plugin.TRADES_TABLE}" WHERE AssetName = ? ORDER BY TradeId DESC LIMIT ?`,
				[ Arguments.AssetName, limit ]
			);

			// Reverse to show oldest first
			trades.reverse();

			return {
				AssetName: Arguments.AssetName,
				Trades: trades,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};