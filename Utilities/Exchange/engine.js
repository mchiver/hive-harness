/*
	engine.js
---------------------------------------------------------------------
Exchange engine — manages the tick loop, participant notification,
and coordinates exchange operations with the TUI.
*/

const Registry = require( '../../Source/Registry.js' );
const Hive = require( '../../Source/Hive.js' );
const MONIKER = require( 'moniker' );


//---------------------------------------------------------------------
// Moniker generator for asset names: adjective-noun
var ASSET_NAME_GENERATOR = MONIKER.generator( [ MONIKER.adjective, MONIKER.noun ] );


//=====================================================================
class ExchangeEngine
{


	//---------------------------------------------------------------------
	constructor( Hive, ExchangeName, Tui )
	{
		this.Hive = Hive;
		this.ExchangeName = ExchangeName;
		this.Tui = Tui;
		this.TickIntervalMs = 10000;
		this.IsPaused = true;
		this.TickCount = 0;
		this.Timer = null;
		this.IsRunning = false;
	}


	//---------------------------------------------------------------------
	// Initialize the exchange: load config, seed assets if needed.
	async Initialize()
	{
		// Load exchange config
		var config_result = await this.Hive.InvokeTool( 'Exchange.ConfigEntity', {
			EntityName: this.ExchangeName,
		} );

		if ( config_result.Success && config_result.Result )
		{
			var config = config_result.Result;
			this.TickIntervalMs = config.TickIntervalMs || 10000;
		}

		// Check if assets exist
		var assets_result = await this.Hive.InvokeTool( 'Exchange.ListAssets', {
			EntityName: this.ExchangeName,
		} );

		var assets = [];
		if ( assets_result.Success && assets_result.Result )
		{
			assets = assets_result.Result;
		}

		// Seed initial assets if none exist
		if ( assets.length === 0 )
		{
			await this.SeedAssets();
		}

		return;
	}


	//---------------------------------------------------------------------
	// Seed the exchange with initial assets using moniker-generated names.
	async SeedAssets()
	{
		var asset_configs = [
			{ AssetName: 'iron', DisplayName: 'Wrought Iron', InitialSupply: 1000 },
			{ AssetName: 'grain', DisplayName: 'Golden Grain', InitialSupply: 2000 },
			{ AssetName: 'energy', DisplayName: 'Vivid Energy', InitialSupply: 500 },
			{ AssetName: 'crystal', DisplayName: 'Arcane Crystal', InitialSupply: 200 },
			{ AssetName: 'timber', DisplayName: 'Ancient Timber', InitialSupply: 1500 },
		];

		for ( var index = 0; index < asset_configs.length; index++ )
		{
			var asset_config = asset_configs[ index ];
			var result = await this.Hive.InvokeTool( 'Exchange.RegisterAsset', {
				EntityName: this.ExchangeName,
				AssetName: asset_config.AssetName,
				DisplayName: asset_config.DisplayName,
				InitialSupply: asset_config.InitialSupply,
			} );

			if ( result.Success )
			{
				this.Tui.Log( `Registered asset: ${asset_config.DisplayName} (${asset_config.InitialSupply} units)` );
			}
		}

		return;
	}


	//---------------------------------------------------------------------
	// Start the tick loop.
	Start()
	{
		this.IsPaused = false;
		this.IsRunning = true;
		this.ScheduleNextTick();
		this.Tui.OnEngineStateChanged();
	}


	//---------------------------------------------------------------------
	// Pause the tick loop.
	Pause()
	{
		this.IsPaused = true;
		if ( this.Timer )
		{
			clearTimeout( this.Timer );
			this.Timer = null;
		}
		this.Tui.OnEngineStateChanged();
	}


	//---------------------------------------------------------------------
	// Resume the tick loop.
	Resume()
	{
		if ( !this.IsRunning ) { return; }
		this.IsPaused = false;
		this.ScheduleNextTick();
		this.Tui.OnEngineStateChanged();
	}


	//---------------------------------------------------------------------
	// Toggle pause/resume.
	TogglePause()
	{
		if ( this.IsPaused )
		{
			this.Resume();
		}
		else
		{
			this.Pause();
		}
	}


	//---------------------------------------------------------------------
	// Run a single tick (manual step while paused).
	async Step()
	{
		await this.RunTick();
	}


	//---------------------------------------------------------------------
	// Adjust tick interval.
	SetTickInterval( IntervalMs )
	{
		this.TickIntervalMs = Math.max( 1000, Math.min( 120000, IntervalMs ) );

		// Restart timer if running
		if ( !this.IsPaused && this.IsRunning )
		{
			if ( this.Timer )
			{
				clearTimeout( this.Timer );
				this.Timer = null;
			}
			this.ScheduleNextTick();
		}

		this.Tui.OnEngineStateChanged();
	}


	//---------------------------------------------------------------------
	// Schedule the next tick.
	ScheduleNextTick()
	{
		if ( this.IsPaused || !this.IsRunning ) { return; }
		var self = this;
		this.Timer = setTimeout( function ()
		{
			self.RunTick().then( function ()
			{
				self.ScheduleNextTick();
			} );
		}, this.TickIntervalMs );
	}


	//---------------------------------------------------------------------
	// Execute one tick.
	async RunTick()
	{
		this.TickCount++;
		var tick_start = Date.now();

		this.Tui.OnTickStart( this.TickCount );

		// Run the exchange tick
		var tick_result = await this.Hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: this.ExchangeName,
		} );

		if ( !tick_result.Success )
		{
			this.Tui.Log( `Tick ${this.TickCount} error: ${tick_result.Error}` );
			return;
		}

		var result = tick_result.Result;

		// Log trades
		if ( result.Trades && result.Trades.length > 0 )
		{
			for ( var t = 0; t < result.Trades.length; t++ )
			{
				var trade = result.Trades[ t ];
				this.Tui.Log(
					`Trade: ${trade.Quantity} ${trade.AssetName} @ ${trade.Price.toFixed( 2 )} EC  ${trade.BuyerAccount} <- ${trade.SellerAccount}`
				);
			}
		}

		// Log liquidations
		if ( result.Liquidations && result.Liquidations.length > 0 )
		{
			for ( var l = 0; l < result.Liquidations.length; l++ )
			{
				var liq = result.Liquidations[ l ];
				this.Tui.Log(
					`Liquidation: ${liq.AccountName} destroyed ${liq.UnitsDestroyed} ${liq.AssetName}, gained ${liq.EcCredited} EC`
				);
			}
		}

		// Log manufacturing
		if ( result.Manufacturing && result.Manufacturing.length > 0 )
		{
			for ( var m = 0; m < result.Manufacturing.length; m++ )
			{
				var mfg = result.Manufacturing[ m ];
				this.Tui.Log(
					`Manufacturing: ${mfg.AccountName} produced ${mfg.UnitsProduced} ${mfg.AssetName}`
				);
			}
		}

		var tick_duration = Date.now() - tick_start;

		// Notify participants (LLMs) — runs in background
		this.NotifyParticipants( result );

		// Update TUI with latest market data
		await this.Tui.OnTickComplete( this.TickCount, result, tick_duration );
	}


	//---------------------------------------------------------------------
	// Notify all active participants about the tick results.
	// Each participant receives a market summary via their Conversation.
	async NotifyParticipants( TickResult )
	{
		// Get participants
		var participants_result = await this.Hive.InvokeTool( 'Exchange.ListParticipants', {
			EntityName: this.ExchangeName,
		} );

		if ( !participants_result.Success ) { return; }

		var participants = participants_result.Result;
		if ( !participants || participants.length === 0 ) { return; }

		// Get market summary for the notification
		var summary_result = await this.Hive.InvokeTool( 'Exchange.GetMarketSummary', {
			EntityName: this.ExchangeName,
		} );

		var market_summary = '';
		if ( summary_result.Success && summary_result.Result )
		{
			var assets = summary_result.Result.Assets || [];
			for ( var a = 0; a < assets.length; a++ )
			{
				var asset = assets[ a ];
				var price_str = ( asset.LastPrice !== null ) ? asset.LastPrice.toFixed( 2 ) : 'no trades';
				var bid_str = ( asset.BestBid !== null ) ? asset.BestBid.toFixed( 2 ) : '--';
				var ask_str = ( asset.BestAsk !== null ) ? asset.BestAsk.toFixed( 2 ) : '--';
				market_summary += `\n  ${asset.DisplayName}: Price=${price_str}  Bid=${bid_str}  Ask=${ask_str}  Vol=${asset.TotalVolume}`;
			}
		}

		// Build trade summary
		var trade_summary = '';
		if ( TickResult.Trades && TickResult.Trades.length > 0 )
		{
			trade_summary = '\nTrades this tick:';
			for ( var t = 0; t < TickResult.Trades.length; t++ )
			{
				var trade = TickResult.Trades[ t ];
				trade_summary += `\n  ${trade.Quantity} ${trade.AssetName} @ ${trade.Price.toFixed( 2 )} EC  (Buyer: ${trade.BuyerAccount}, Seller: ${trade.SellerAccount})`;
			}
		}
		else
		{
			trade_summary = '\nNo trades this tick.';
		}

		// Notify each active participant with a conversation
		for ( var p = 0; p < participants.length; p++ )
		{
			var participant = participants[ p ];
			if ( !participant.IsActive ) { continue; }
			if ( !participant.ConversationName ) { continue; }

			// Get participant's account info
			var account_result = await this.Hive.InvokeTool( 'Exchange.GetAccount', {
				EntityName: this.ExchangeName,
				AccountName: participant.AccountName,
			} );

			var account_info = '';
			if ( account_result.Success && account_result.Result )
			{
				var acct = account_result.Result;
				account_info = `\nYour account: ${acct.AccountName}  EC Balance: ${acct.EcBalance.toFixed( 2 )}`;
				if ( acct.Holdings && acct.Holdings.length > 0 )
				{
					account_info += '\nYour holdings:';
					for ( var h = 0; h < acct.Holdings.length; h++ )
					{
						account_info += `\n  ${acct.Holdings[ h ].AssetName}: ${acct.Holdings[ h ].Quantity}`;
					}
				}
			}

			// Build the notification message
			var message = `Exchange tick #${this.TickCount} completed.`
				+ `\n\nMarket Summary:${market_summary}`
				+ `\n${trade_summary}`
				+ `\n${account_info}`
				+ `\n\nYou are a ${participant.Role}. Review the market and decide if you want to place, modify, or cancel any orders.`;

			// Send to participant's conversation (fire-and-forget)
			this.SendToConversation( participant.ConversationName, message );
		}
	}


	//---------------------------------------------------------------------
	// Send a message to a conversation (async, fire-and-forget).
	async SendToConversation( ConversationName, Message )
	{
		try
		{
			await this.Hive.InvokeTool( 'Conversation.Chat', {
				EntityName: ConversationName,
				Text: Message,
			} );
		}
		catch ( error )
		{
			this.Tui.Log( `Failed to notify conversation [${ConversationName}]: ${error.message}` );
		}
	}


	//---------------------------------------------------------------------
	// Stop the engine.
	Stop()
	{
		this.IsRunning = false;
		this.IsPaused = true;
		if ( this.Timer )
		{
			clearTimeout( this.Timer );
			this.Timer = null;
		}
	}


} // end class ExchangeEngine


//---------------------------------------------------------------------
module.exports = ExchangeEngine;