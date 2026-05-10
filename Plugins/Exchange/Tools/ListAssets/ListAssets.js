/*
	ListAssets.js
---------------------------------------------------------------------
Lists all tradeable assets on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListAssets';
	Tool.Description = 'List all tradeable assets on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				AssetName: { type: 'string', description: 'The asset identifier.' },
				DisplayName: { type: 'string', description: 'Human-readable name.' },
				TotalSupply: { type: 'number', description: 'Total supply.' },
				CirculatingSupply: { type: 'number', description: 'Currently circulating supply.' },
			},
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var rows = store.Query(
				`SELECT AssetName, DisplayName, TotalSupply, CirculatingSupply FROM "${Plugin.ASSETS_TABLE}" ORDER BY AssetName`
			);

			return rows;
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};