/*
	GetOrder.js
---------------------------------------------------------------------
Gets a single order by ID.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetOrder';
	Tool.Description = 'Get a single order by its ID.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			OrderId: { type: 'number', description: 'ID of the order.' },
		},
		required: [ 'EntityName', 'OrderId' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			OrderId: { type: 'number', description: 'The order ID.' },
			AccountName: { type: 'string', description: 'Account that placed the order.' },
			AssetName: { type: 'string', description: 'Asset being traded.' },
			Side: { type: 'string', description: 'Order side.' },
			Price: { type: 'number', description: 'Limit price.' },
			Quantity: { type: 'number', description: 'Total quantity.' },
			FilledQuantity: { type: 'number', description: 'Quantity filled so far.' },
			Status: { type: 'string', description: 'Order status.' },
			CreatedAt: { type: 'string', description: 'When the order was created.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var rows = store.Query(
				`SELECT OrderId, AccountName, AssetName, Side, Price, Quantity, FilledQuantity, Status, CreatedAt, UpdatedAt FROM "${Plugin.ORDERS_TABLE}" WHERE OrderId = ?`,
				[ Arguments.OrderId ]
			);
			if ( rows.length === 0 )
			{
				throw new Error( `Order [${Arguments.OrderId}] not found.` );
			}

			return rows[ 0 ];
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};