/*
	GetTradeHistory.js
---------------------------------------------------------------------
Gets all recent trades across all assets.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetTradeHistory';
	Tool.Description = 'Get recent trades across all assets.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			Limit: { type: 'number', description: 'Maximum number of trades to return (default: 50).' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
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

			var limit = Arguments.Limit || 50;

			var trades = store.Query(
				`SELECT TradeId, AssetName, BuyerAccount, SellerAccount, Price, Quantity, TradedAt FROM "${Plugin.TRADES_TABLE}" ORDER BY TradeId DESC LIMIT ?`,
				[ limit ]
			);

			// Reverse to show oldest first
			trades.reverse();

			return {
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