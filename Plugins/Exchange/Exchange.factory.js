/*
	Exchange.factory.js
---------------------------------------------------------------------
Exchange plugin factory - provides a virtual financial exchange with
limit order book matching, participant management, and trade execution.
Each entity represents a distinct market/exchange with its own assets,
order book, and trade history stored in SQLite.
*/

const PATH = require( 'path' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Virtual financial exchange with limit order book matching and LLM participants.';
		Plugin.RequiredRole = 'user';

		// Exchange is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for an Exchange entity.',
			properties: {
				Name: { type: 'string', description: 'Exchange entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this exchange.' },
				TickIntervalMs: { type: 'number', default: 10000, description: 'Milliseconds between exchange ticks.' },
				LiquidationRate: { type: 'number', default: 0.05, description: 'Fraction of consumer holdings liquidated per tick.' },
				StartingEc: { type: 'number', default: 10000, description: 'Default starting EC balance for new accounts.' },
				BaseAssetPrice: { type: 'number', default: 10, description: 'Base price used for liquidation when no trade history exists.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Table schemas
		//---------------------------------------------------------------------

		Plugin.ASSETS_TABLE = 'Assets';
		Plugin.ACCOUNTS_TABLE = 'Accounts';
		Plugin.HOLDINGS_TABLE = 'Holdings';
		Plugin.ORDERS_TABLE = 'Orders';
		Plugin.TRADES_TABLE = 'Trades';
		Plugin.PARTICIPANTS_TABLE = 'Participants';

		Plugin.ASSETS_SCHEMA = `
			AssetName TEXT PRIMARY KEY,
			DisplayName TEXT NOT NULL DEFAULT '',
			TotalSupply REAL NOT NULL DEFAULT 0,
			CirculatingSupply REAL NOT NULL DEFAULT 0
		`;

		Plugin.ACCOUNTS_SCHEMA = `
			AccountName TEXT PRIMARY KEY,
			EcBalance REAL NOT NULL DEFAULT 0
		`;

		Plugin.HOLDINGS_SCHEMA = `
			AccountName TEXT NOT NULL,
			AssetName TEXT NOT NULL,
			Quantity REAL NOT NULL DEFAULT 0,
			PRIMARY KEY ( AccountName, AssetName ),
			FOREIGN KEY ( AccountName ) REFERENCES Accounts( AccountName ),
			FOREIGN KEY ( AssetName ) REFERENCES Assets( AssetName )
		`;

		Plugin.ORDERS_SCHEMA = `
			OrderId INTEGER PRIMARY KEY AUTOINCREMENT,
			AccountName TEXT NOT NULL,
			AssetName TEXT NOT NULL,
			Side TEXT NOT NULL CHECK ( Side IN ( 'buy', 'sell' ) ),
			Price REAL NOT NULL,
			Quantity REAL NOT NULL,
			FilledQuantity REAL NOT NULL DEFAULT 0,
			Status TEXT NOT NULL DEFAULT 'open' CHECK ( Status IN ( 'open', 'filled', 'cancelled', 'partial' ) ),
			CreatedAt TEXT NOT NULL,
			UpdatedAt TEXT NOT NULL,
			FOREIGN KEY ( AccountName ) REFERENCES Accounts( AccountName ),
			FOREIGN KEY ( AssetName ) REFERENCES Assets( AssetName )
		`;

		Plugin.TRADES_SCHEMA = `
			TradeId INTEGER PRIMARY KEY AUTOINCREMENT,
			AssetName TEXT NOT NULL,
			BuyOrderId INTEGER NOT NULL,
			SellOrderId INTEGER NOT NULL,
			BuyerAccount TEXT NOT NULL,
			SellerAccount TEXT NOT NULL,
			Price REAL NOT NULL,
			Quantity REAL NOT NULL,
			TradedAt TEXT NOT NULL,
			FOREIGN KEY ( BuyOrderId ) REFERENCES Orders( OrderId ),
			FOREIGN KEY ( SellOrderId ) REFERENCES Orders( OrderId )
		`;

		Plugin.PARTICIPANTS_SCHEMA = `
			AccountName TEXT PRIMARY KEY,
			Role TEXT NOT NULL DEFAULT 'speculator' CHECK ( Role IN ( 'supplier', 'consumer', 'speculator', 'hybrid' ) ),
			ConversationName TEXT DEFAULT '',
			IsManufacturer INTEGER DEFAULT 0,
			ManufactureAsset TEXT DEFAULT '',
			ManufactureRate REAL DEFAULT 0,
			LiquidationRateOverride REAL DEFAULT 0,
			IsActive INTEGER DEFAULT 1,
			FOREIGN KEY ( AccountName ) REFERENCES Accounts( AccountName )
		`;


		//---------------------------------------------------------------------
		// Open the exchange database for a named entity.
		// Creates all tables if they don't exist.
		// Returns a SqlStore helper instance. Caller must call .Close() when done.
		Plugin.OpenDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, 'exchange.db' );
			var store = new Hive.Helpers.SqlStore();
			store.Open( db_path, { JournalMode: 'wal', ForeignKeys: true, BusyTimeout: 5000 } );

			Plugin.EnsureTables( store );

			return store;
		};


		//---------------------------------------------------------------------
		// Create the required tables if they don't exist.
		Plugin.EnsureTables = function ( Store )
		{
			var tables = Store.ListTables();

			if ( !tables.includes( Plugin.ASSETS_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.ASSETS_TABLE}" ( ${Plugin.ASSETS_SCHEMA} )` );
			}

			if ( !tables.includes( Plugin.ACCOUNTS_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.ACCOUNTS_TABLE}" ( ${Plugin.ACCOUNTS_SCHEMA} )` );
			}

			if ( !tables.includes( Plugin.HOLDINGS_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.HOLDINGS_TABLE}" ( ${Plugin.HOLDINGS_SCHEMA} )` );
			}

			if ( !tables.includes( Plugin.ORDERS_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.ORDERS_TABLE}" ( ${Plugin.ORDERS_SCHEMA} )` );
			}

			if ( !tables.includes( Plugin.TRADES_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.TRADES_TABLE}" ( ${Plugin.TRADES_SCHEMA} )` );
			}

			if ( !tables.includes( Plugin.PARTICIPANTS_TABLE ) )
			{
				Store.Execute( `CREATE TABLE "${Plugin.PARTICIPANTS_TABLE}" ( ${Plugin.PARTICIPANTS_SCHEMA} )` );
			}
		};


		//---------------------------------------------------------------------
		// Load entity config from disk.
		Plugin.GetEntityConfig = async function ( Hive, EntityName )
		{
			return await Hive.GetEntityConfig( this.PluginName, EntityName );
		};


		//---------------------------------------------------------------------
		// Get the last trade price for an asset, or null if no trades.
		Plugin.GetLastTradePrice = function ( Store, AssetName )
		{
			var rows = Store.Query(
				`SELECT Price FROM "${Plugin.TRADES_TABLE}" WHERE AssetName = ? ORDER BY TradeId DESC LIMIT 1`,
				[ AssetName ]
			);
			if ( rows.length === 0 ) { return null; }
			return rows[ 0 ].Price;
		};


		//---------------------------------------------------------------------
		// Match orders in the order book (price-time priority).
		// Matches highest bid against lowest ask when bid price >= ask price.
		// Trades execute at the maker (earlier) order's price.
		// Returns an array of trade records.
		Plugin.MatchOrders = function ( Store )
		{
			var trades = [];

			// Get all assets that have open orders
			var asset_rows = Store.Query(
				`SELECT DISTINCT AssetName FROM "${Plugin.ORDERS_TABLE}" WHERE Status = 'open'`
			);

			for ( var asset_index = 0; asset_index < asset_rows.length; asset_index++ )
			{
				var asset_name = asset_rows[ asset_index ].AssetName;

				// Get open bids: highest price first, then earliest time
				var bids = Store.Query(
					`SELECT * FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'buy' AND Status = 'open' ORDER BY Price DESC, CreatedAt ASC`,
					[ asset_name ]
				);

				// Get open asks: lowest price first, then earliest time
				var asks = Store.Query(
					`SELECT * FROM "${Plugin.ORDERS_TABLE}" WHERE AssetName = ? AND Side = 'sell' AND Status = 'open' ORDER BY Price ASC, CreatedAt ASC`,
					[ asset_name ]
				);

				var bid_index = 0;
				var ask_index = 0;

				while ( bid_index < bids.length && ask_index < asks.length )
				{
					var bid = bids[ bid_index ];
					var ask = asks[ ask_index ];

					// Can only match if bid price >= ask price
					if ( bid.Price < ask.Price ) { break; }

					// Determine trade quantity (minimum of remaining unfilled)
					var bid_remaining = bid.Quantity - bid.FilledQuantity;
					var ask_remaining = ask.Quantity - ask.FilledQuantity;
					var trade_quantity = Math.min( bid_remaining, ask_remaining );

					if ( trade_quantity <= 0 ) { break; }

					// Determine trade price: the maker's price (earlier order)
					var trade_price;
					if ( bid.CreatedAt <= ask.CreatedAt )
					{
						trade_price = bid.Price; // Bid was first (maker)
					}
					else
					{
						trade_price = ask.Price; // Ask was first (maker)
					}

					var now = new Date().toISOString();

					// Record the trade
					var trade_result = Store.Execute(
						`INSERT INTO "${Plugin.TRADES_TABLE}" ( AssetName, BuyOrderId, SellOrderId, BuyerAccount, SellerAccount, Price, Quantity, TradedAt ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )`,
						[ asset_name, bid.OrderId, ask.OrderId, bid.AccountName, ask.AccountName, trade_price, trade_quantity, now ]
					);

					trades.push( {
						TradeId: trade_result.LastInsertId,
						AssetName: asset_name,
						BuyOrderId: bid.OrderId,
						SellOrderId: ask.OrderId,
						BuyerAccount: bid.AccountName,
						SellerAccount: ask.AccountName,
						Price: trade_price,
						Quantity: trade_quantity,
						TradedAt: now,
					} );

					// Update filled quantities
					var new_bid_filled = bid.FilledQuantity + trade_quantity;
					var new_ask_filled = ask.FilledQuantity + trade_quantity;

					var bid_status = ( new_bid_filled >= bid.Quantity ) ? 'filled' : 'partial';
					var ask_status = ( new_ask_filled >= ask.Quantity ) ? 'filled' : 'partial';

					Store.Execute(
						`UPDATE "${Plugin.ORDERS_TABLE}" SET FilledQuantity = ?, Status = ?, UpdatedAt = ? WHERE OrderId = ?`,
						[ new_bid_filled, bid_status, now, bid.OrderId ]
					);

					Store.Execute(
						`UPDATE "${Plugin.ORDERS_TABLE}" SET FilledQuantity = ?, Status = ?, UpdatedAt = ? WHERE OrderId = ?`,
						[ new_ask_filled, ask_status, now, ask.OrderId ]
					);

					// Transfer EC from buyer to seller
					var ec_cost = trade_price * trade_quantity;
					Store.Execute(
						`UPDATE "${Plugin.ACCOUNTS_TABLE}" SET EcBalance = EcBalance - ? WHERE AccountName = ?`,
						[ ec_cost, bid.AccountName ]
					);
					Store.Execute(
						`UPDATE "${Plugin.ACCOUNTS_TABLE}" SET EcBalance = EcBalance + ? WHERE AccountName = ?`,
						[ ec_cost, ask.AccountName ]
					);

					// Transfer asset from seller to buyer
					// Credit buyer
					var buyer_holding = Store.Query(
						`SELECT Quantity FROM "${Plugin.HOLDINGS_TABLE}" WHERE AccountName = ? AND AssetName = ?`,
						[ bid.AccountName, asset_name ]
					);
					if ( buyer_holding.length > 0 )
					{
						Store.Execute(
							`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity + ? WHERE AccountName = ? AND AssetName = ?`,
							[ trade_quantity, bid.AccountName, asset_name ]
						);
					}
					else
					{
						Store.Execute(
							`INSERT INTO "${Plugin.HOLDINGS_TABLE}" ( AccountName, AssetName, Quantity ) VALUES ( ?, ?, ? )`,
							[ bid.AccountName, asset_name, trade_quantity ]
						);
					}

					// Debit seller
					Store.Execute(
						`UPDATE "${Plugin.HOLDINGS_TABLE}" SET Quantity = Quantity - ? WHERE AccountName = ? AND AssetName = ?`,
						[ trade_quantity, ask.AccountName, asset_name ]
					);

					// Move to next bid/ask if fully filled
					if ( bid_status === 'filled' ) { bid_index++; }
					if ( ask_status === 'filled' ) { ask_index++; }

					// If one side is partially filled, the loop will try again with remaining quantity
					if ( bid_status !== 'filled' && ask_status === 'filled' ) { ask_index++; }
					if ( ask_status !== 'filled' && bid_status === 'filled' ) { bid_index++; }
				}
			}

			return trades;
		};


		//---------------------------------------------------------------------
		// Dynamic Skills
		Plugin.Skills = {};


		//---------------------------------------------------------------------
		// ExchangeSkill - teaches LLM participants how to trade on the exchange.
		Plugin.Skills.ExchangeSkill = function ( Hive )
		{
			var skill_text = '';

			// --- Overview ---
			skill_text += `
You are a participant in a virtual financial exchange. You trade assets using Exchange Credits (EC).
The exchange uses a limit order book: your buy and sell orders match with other participants when prices cross.

Available tools for trading:
- Exchange.GetAccount — Check your EC balance. Pass AccountName.
- Exchange.GetHoldings — Check your asset holdings. Pass AccountName.
- Exchange.GetOrderBook — View the current order book for an asset (bids and asks). Pass AssetName and optional Depth.
- Exchange.SubmitOrder — Place a buy or sell limit order. Pass AccountName, AssetName, Side ("buy" or "sell"), Price, and Quantity.
- Exchange.CancelOrder — Cancel one of your open orders. Pass OrderId.
- Exchange.GetOrders — View your open orders. Pass AccountName and optional AssetName.
- Exchange.GetTrades — View recent trades for an asset. Pass AssetName and optional Limit.
- Exchange.GetMarketSummary — View all assets with prices, spreads, and volumes.
- Exchange.GetAssetPrice — Get the last trade price for an asset. Pass AssetName.
`;

			// --- Order Mechanics ---
			skill_text += `
Order mechanics:
- Buy orders: You specify a maximum price you are willing to pay. Your order matches if a sell order exists at or below your price.
- Sell orders: You specify a minimum price you are willing to accept. Your order matches if a buy order exists at or above your price.
- Orders are matched by price-time priority: best price first, then earliest order.
- When orders match, the trade executes at the maker's (earlier order's) price.
- You must have enough EC to cover buy orders and enough asset holdings to cover sell orders.
- Unfilled orders remain open until matched or cancelled.
`;

			// --- Strategy ---
			skill_text += `
Trading strategy:
- If you are a SUPPLIER, your goal is to sell your assets at the highest price possible. Consider the order book's bid side to find the best selling opportunity.
- If you are a CONSUMER, your goal is to acquire assets at the lowest price possible. Check the ask side for cheap assets.
- If you are a SPECULATOR, your goal is to profit from price movements. Buy low, sell high.
- If you are a HYBRID participant, you may manufacture assets AND consume them. Balance production with market conditions.
- You can have multiple open orders at different prices.
- Cancel orders that no longer reflect your desired price.
`;

			// --- Tool Call Format ---
			skill_text += `
To call a tool, include a tool-call block in your response:
<tool-call>{"Tool":"Exchange.SubmitOrder","Arguments":{"AccountName":"your-name","AssetName":"Iron","Side":"buy","Price":10,"Quantity":5}}</tool-call>

You may call multiple tools in sequence. After checking the market, decide on your orders and respond with tool-call blocks.
`;

			return skill_text;
		};


		return Plugin;
	}
}


module.exports = Factory;
