/*
	RunTick.js
---------------------------------------------------------------------
Executes one exchange tick:
1. Liquidation pass — consumers lose a fraction of holdings, gain EC
2. Manufacturing pass — manufacturers produce new supply
3. Order matching — match compatible buy/sell orders
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'RunTick';
	Tool.Description = 'Execute one exchange tick: liquidation, manufacturing, and order matching.';

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
			Trades: { type: 'array', description: 'Array of executed trades.' },
			Liquidations: { type: 'array', description: 'Array of liquidation events.' },
			Manufacturing: { type: 'array', description: 'Array of manufacturing events.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );
			var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );
			var liquidation_rate = config.LiquidationRate || 0.05;
			var base_asset_price = config.BaseAssetPrice || 10;

			var liquidations = [];
			var manufacturing_events = [];
			var trades = [];

			//-----------------------------------------------------------------
			// 1. Liquidation pass
			//-----------------------------------------------------------------

			var participants = store.Query(
				`SELECT AccountName, Role, LiquidationRateOverride FROM "${Plugin.PARTICIPANTS_TABLE}" WHERE IsActive = 1`
			);

			for ( var p_index = 0; p_index < participants.length; p_index++ )
			{
				var participant = participants[ p_index ];

				// Only consumers and hybrid participants liquidate
				if ( participant.Role !== 'consumer' && participant.Role !== 'hybrid' ) { continue; }

				var effective_rate = ( participant.LiquidationRateOverride > 0 )
					? participant.LiquidationRateOverride
					: liquidation_rate;

				if ( effective_rate <= 0 ) { continue; }

				// Get this participant's holdings
				var holdings = store.Query(
					`SELECT AssetName, Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND Quantity > 0`,
					[ participant.AccountName ]
				);

				for ( var h_index = 0; h_index < holdings.length; h_index++ )
				{
					var holding = holdings[ h_index ];
					var units_to_liquidate = Math.floor( holding.Quantity * effective_rate );
					if ( units_to_liquidate <= 0 ) { continue; }

					// Get last trade price for this asset
					var last_price = Plugin.GetLastTradePrice( store, holding.AssetName );
					var effective_price = ( last_price !== null ) ? last_price : base_asset_price;
					var ec_value = Math.floor( units_to_liquidate * effective_price );

					// Debit holding
					store.Execute(
						`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity - ? WHERE AccountName = ? AND AssetName = ?`,
						[ units_to_liquidate, participant.AccountName, holding.AssetName ]
					);

					// Credit EC
					store.Execute(
						`UPDATE "${Plugin.ACCOUNTS_TABLE}" SET EcBalance = EcBalance + ? WHERE AccountName = ?`,
						[ ec_value, participant.AccountName ]
					);

					// Reduce circulating supply (assets are destroyed)
					store.Execute(
						`UPDATE "${Plugin.ASSETS_TABLE}" SET CirculatingSupply = CirculatingSupply - ? WHERE AssetName = ?`,
						[ units_to_liquidate, holding.AssetName ]
					);

					liquidations.push( {
						AccountName: participant.AccountName,
						AssetName: holding.AssetName,
						UnitsDestroyed: units_to_liquidate,
						EcCredited: ec_value,
						Price: effective_price,
					} );
				}
			}

			//-----------------------------------------------------------------
			// 2. Manufacturing pass
			//-----------------------------------------------------------------

			var manufacturers = store.Query(
				`SELECT AccountName, ManufactureAsset, ManufactureRate FROM "${Plugin.PARTICIPANTS_TABLE}" WHERE IsManufacturer = 1 AND IsActive = 1 AND ManufactureRate > 0`
			);

			for ( var m_index = 0; m_index < manufacturers.length; m_index++ )
			{
				var manufacturer = manufacturers[ m_index ];
				var production = manufacturer.ManufactureRate;

				// Credit holding to manufacturer
				var existing_holding = store.Query(
					`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
					[ manufacturer.AccountName, manufacturer.ManufactureAsset ]
				);

				if ( existing_holding.length > 0 )
				{
					store.Execute(
						`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity + ? WHERE AccountName = ? AND AssetName = ?`,
						[ production, manufacturer.AccountName, manufacturer.ManufactureAsset ]
					);
				}
				else
				{
					store.Execute(
						`INSERT INTO "${Plugin.HOLDINGS_TABLE}" ( AccountName, AssetName, Quantity ) VALUES ( ?, ?, ? )`,
						[ manufacturer.AccountName, manufacturer.ManufactureAsset, production ]
					);
				}

				// Increase circulating supply
				store.Execute(
					`UPDATE "${Plugin.ASSETS_TABLE}" SET CirculatingSupply = CirculatingSupply + ? WHERE AssetName = ?`,
					[ production, manufacturer.ManufactureAsset ]
				);

				manufacturing_events.push( {
					AccountName: manufacturer.AccountName,
					AssetName: manufacturer.ManufactureAsset,
					UnitsProduced: production,
				} );
			}

			//-----------------------------------------------------------------
			// 3. Order matching
			//-----------------------------------------------------------------

			trades = Plugin.MatchOrders( store );

			return {
				Trades: trades,
				Liquidations: liquidations,
				Manufacturing: manufacturing_events,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};