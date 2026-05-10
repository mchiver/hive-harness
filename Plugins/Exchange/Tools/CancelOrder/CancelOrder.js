/*
	CancelOrder.js
---------------------------------------------------------------------
Cancels an open order on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'CancelOrder';
	Tool.Description = 'Cancel an open order on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			OrderId: { type: 'number', description: 'ID of the order to cancel.' },
		},
		required: [ 'EntityName', 'OrderId' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			OrderId: { type: 'number', description: 'The cancelled order ID.' },
			Status: { type: 'string', description: 'New order status.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check order exists and is open
			var order_rows = store.Query(
				`SELECT OrderId, Status FROM "${Plugin.ORDERS_TABLE}" WHERE OrderId = ?`,
				[ Arguments.OrderId ]
			);
			if ( order_rows.length === 0 )
			{
				throw new Error( `Order [${Arguments.OrderId}] not found.` );
			}
			if ( order_rows[ 0 ].Status !== 'open' && order_rows[ 0 ].Status !== 'partial' )
			{
				throw new Error( `Order [${Arguments.OrderId}] cannot be cancelled. Current status: ${order_rows[ 0 ].Status}.` );
			}

			var now = new Date().toISOString();
			store.Execute(
				`UPDATE "${Plugin.ORDERS_TABLE}" SET Status = 'cancelled', UpdatedAt = ? WHERE OrderId = ?`,
				[ now, Arguments.OrderId ]
			);

			return {
				OrderId: Arguments.OrderId,
				Status: 'cancelled',
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};