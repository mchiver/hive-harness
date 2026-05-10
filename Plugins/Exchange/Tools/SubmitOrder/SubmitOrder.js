/*
	SubmitOrder.js
---------------------------------------------------------------------
Places a buy or sell limit order on the exchange.
Validates that the account has sufficient EC (for buys) or holdings (for sells).
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'SubmitOrder';
	Tool.Description = 'Place a buy or sell limit order on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account placing the order.' },
			AssetName: { type: 'string', description: 'Name of the asset to trade.' },
			Side: { type: 'string', description: 'Order side: "buy" or "sell".' },
			Price: { type: 'number', description: 'Limit price per unit.' },
			Quantity: { type: 'number', description: 'Number of units to trade.' },
		},
		required: [ 'EntityName', 'AccountName', 'AssetName', 'Side', 'Price', 'Quantity' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			OrderId: { type: 'number', description: 'ID of the created order.' },
			AccountName: { type: 'string', description: 'The account name.' },
			AssetName: { type: 'string', description: 'The asset name.' },
			Side: { type: 'string', description: 'Order side.' },
			Price: { type: 'number', description: 'Limit price.' },
			Quantity: { type: 'number', description: 'Order quantity.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			// Validate side
			if ( Arguments.Side !== 'buy' && Arguments.Side !== 'sell' )
			{
				throw new Error( 'Side must be "buy" or "sell".' );
			}

			if ( Arguments.Price <= 0 )
			{
				throw new Error( 'Price must be positive.' );
			}

			if ( Arguments.Quantity <= 0 )
			{
				throw new Error( 'Quantity must be positive.' );
			}

			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check account exists
			var account_rows = store.Query(
				`SELECT EcBalance FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
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

			// Validate sufficient resources
			if ( Arguments.Side === 'buy' )
			{
				var total_cost = Arguments.Price * Arguments.Quantity;
				// Subtract value of existing open buy orders to prevent over-commitment
				var open_buy_value = store.Query(
					`SELECT COALESCE( SUM( Price * ( Quantity - FilledQuantity ) ), 0 ) AS TotalValue FROM "${Plugin.ORDERS_TABLE}" WHERE AccountName = ? AND Side = 'buy' AND Status = 'open'`,
					[ Arguments.AccountName ]
				);
				var committed = open_buy_value[ 0 ].TotalValue;
				var available = account_rows[ 0 ].EcBalance - committed;

				if ( available < total_cost )
				{
					throw new Error( `Insufficient EC. Available: ${available.toFixed( 2 )} (balance ${account_rows[ 0 ].EcBalance.toFixed( 2 )} - committed ${committed.toFixed( 2 )}), Required: ${total_cost.toFixed( 2 )}.` );
				}
			}
			else
			{
				// Check sufficient holdings minus committed sell orders
				var holding_rows = store.Query(
					`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
					[ Arguments.AccountName, Arguments.AssetName ]
				);
				var current_holding = ( holding_rows.length > 0 ) ? holding_rows[ 0 ].Quantity : 0;

				var open_sell_quantity = store.Query(
					`SELECT COALESCE( SUM( Quantity - FilledQuantity ), 0 ) AS TotalQty FROM "${Plugin.ORDERS_TABLE}" WHERE AccountName = ? AND AssetName = ? AND Side = 'sell' AND Status = 'open'`,
					[ Arguments.AccountName, Arguments.AssetName ]
				);
				var committed_qty = open_sell_quantity[ 0 ].TotalQty;
				var available_qty = current_holding - committed_qty;

				if ( available_qty < Arguments.Quantity )
				{
					throw new Error( `Insufficient holdings. Available: ${available_qty.toFixed( 2 )} (holding ${current_holding.toFixed( 2 )} - committed ${committed_qty.toFixed( 2 )}), Requested: ${Arguments.Quantity.toFixed( 2 )}.` );
				}
			}

			// Insert the order
			var now = new Date().toISOString();
			var result = store.Execute(
				`INSERT INTO "${Plugin.ORDERS_TABLE}" ( AccountName, AssetName, Side, Price, Quantity, FilledQuantity, Status, CreatedAt, UpdatedAt ) VALUES ( ?, ?, ?, ?, ?, 0, 'open', ?, ? )`,
				[ Arguments.AccountName, Arguments.AssetName, Arguments.Side, Arguments.Price, Arguments.Quantity, now, now ]
			);

			return {
				OrderId: result.LastInsertId,
				AccountName: Arguments.AccountName,
				AssetName: Arguments.AssetName,
				Side: Arguments.Side,
				Price: Arguments.Price,
				Quantity: Arguments.Quantity,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};