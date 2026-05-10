/*
	CreateParticipant.js
---------------------------------------------------------------------
Creates a new exchange participant with role, conversation, and optional
manufacturing config. Also creates the underlying account.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'CreateParticipant';
	Tool.Description = 'Create a new exchange participant with role and optional manufacturing config.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Unique name for the participant account.' },
			Role: { type: 'string', description: 'Participant role: "supplier", "consumer", "speculator", or "hybrid".' },
			ConversationName: { type: 'string', description: 'Conversation entity name for LLM interaction (optional).' },
			IsManufacturer: { type: 'boolean', description: 'Whether this participant manufactures assets (default: false).' },
			ManufactureAsset: { type: 'string', description: 'Which asset they produce (required if IsManufacturer).' },
			ManufactureRate: { type: 'number', description: 'Units produced per tick (required if IsManufacturer).' },
			LiquidationRateOverride: { type: 'number', description: 'Per-participant liquidation rate override (0 = use exchange default).' },
			StartingEc: { type: 'number', description: 'Starting EC balance (optional, uses exchange default).' },
			InitialHoldings: { type: 'object', description: 'Initial asset holdings: { AssetName: Quantity, ... } (optional).' },
		},
		required: [ 'EntityName', 'AccountName', 'Role' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The participant account name.' },
			Role: { type: 'string', description: 'The participant role.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			// Validate role
			var valid_roles = [ 'supplier', 'consumer', 'speculator', 'hybrid' ];
			if ( valid_roles.indexOf( Arguments.Role ) === -1 )
			{
				throw new Error( `Invalid role [${Arguments.Role}]. Must be one of: ${valid_roles.join( ', ' )}.` );
			}

			// Validate manufacturing config
			var is_manufacturer = Arguments.IsManufacturer || false;
			var manufacture_asset = Arguments.ManufactureAsset || '';
			var manufacture_rate = Arguments.ManufactureRate || 0;

			if ( is_manufacturer && !manufacture_asset )
			{
				throw new Error( 'ManufactureAsset is required when IsManufacturer is true.' );
			}
			if ( is_manufacturer && manufacture_rate <= 0 )
			{
				throw new Error( 'ManufactureRate must be positive when IsManufacturer is true.' );
			}

			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check if participant already exists
			var existing = store.Query(
				`SELECT AccountName FROM "${Plugin.PARTICIPANTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing.length > 0 )
			{
				throw new Error( `Participant [${Arguments.AccountName}] already exists.` );
			}

			// Check if account already exists
			var existing_account = store.Query(
				`SELECT AccountName FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing_account.length > 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] already exists. Use a different name.` );
			}

			// Get default starting EC from exchange config
			var starting_ec = Arguments.StartingEc;
			if ( starting_ec === undefined || starting_ec === null )
			{
				var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );
				starting_ec = config.StartingEc || 10000;
			}

			// Create the account
			store.Execute(
				`INSERT INTO "${Plugin.ACCOUNTS_TABLE}" ( AccountName, EcBalance ) VALUES ( ?, ? )`,
				[ Arguments.AccountName, starting_ec ]
			);

			// Credit initial holdings
			var initial_holdings = Arguments.InitialHoldings || {};
			for ( var asset_name in initial_holdings )
			{
				var quantity = initial_holdings[ asset_name ];

				// Verify asset exists
				var asset_rows = store.Query(
					`SELECT AssetName FROM "${Plugin.ASSETS_TABLE}" WHERE AssetName = ?`,
					[ asset_name ]
				);
				if ( asset_rows.length === 0 )
				{
					throw new Error( `Asset [${asset_name}] not found. Cannot credit initial holdings.` );
				}

				store.Execute(
					`INSERT OR REPLACE INTO "${Plugin.HOLDINGS_TABLE}" ( AccountName, AssetName, Quantity ) VALUES ( ?, ?, ? )`,
					[ Arguments.AccountName, asset_name, quantity ]
				);

				// Update circulating supply
				store.Execute(
					`UPDATE "${Plugin.ASSETS_TABLE}" SET CirculatingSupply = CirculatingSupply + ? WHERE AssetName = ?`,
					[ quantity, asset_name ]
				);
			}

			// Create the participant record
			store.Execute(
				`INSERT INTO "${Plugin.PARTICIPANTS_TABLE}" ( AccountName, Role, ConversationName, IsManufacturer, ManufactureAsset, ManufactureRate, LiquidationRateOverride, IsActive ) VALUES ( ?, ?, ?, ?, ?, ?, ?, 1 )`,
				[
					Arguments.AccountName,
					Arguments.Role,
					Arguments.ConversationName || '',
					is_manufacturer ? 1 : 0,
					manufacture_asset,
					manufacture_rate,
					Arguments.LiquidationRateOverride || 0,
				]
			);

			return {
				AccountName: Arguments.AccountName,
				Role: Arguments.Role,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};