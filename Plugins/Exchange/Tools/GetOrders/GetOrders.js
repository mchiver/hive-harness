/*
	GetOrders.js
---------------------------------------------------------------------
Gets open orders for an account, optionally filtered by asset.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetOrders';
	Tool.Description = 'Get open orders for an account, optionally filtered by asset.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the account.' },
			AssetName: { type: 'string', description: 'Optional: filter by asset name.' },
		},
		required: [ 'EntityName', 'AccountName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The account name.' },
			Orders: { type: 'array', description: 'Array of order objects.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var sql = `SELECT OrderId, AssetName, Side, Price, Quantity, FilledQuantity, Status, CreatedAt FROM "${Plugin.ORDERS_TABLE}" WHERE AccountName = ? AND Status IN ( 'open', 'partial' ) ORDER BY CreatedAt DESC`;
			var values = [ Arguments.AccountName ];

			if ( Arguments.AssetName )
			{
				sql = `SELECT OrderId, AssetName, Side, Price, Quantity, FilledQuantity, Status, CreatedAt FROM "${Plugin.ORDERS_TABLE}" WHERE AccountName = ? AND AssetName = ? AND Status IN ( 'open', 'partial' ) ORDER BY CreatedAt DESC`;
				values = [ Arguments.AccountName, Arguments.AssetName ];
			}

			var orders = store.Query( sql, values );

			return {
				AccountName: Arguments.AccountName,
				Orders: orders,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};