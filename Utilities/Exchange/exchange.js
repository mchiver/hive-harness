#!/usr/bin/env node
/*
	exchange.js
---------------------------------------------------------------------
Entry point for the HiveJS Exchange TUI application.
Opens a Hive, creates/loads the exchange entity, and starts the tick loop.
*/

const OS = require( 'os' );
const PATH = require( 'path' );
const MINIMIST = require( 'minimist' );

const Registry = require( '../../Source/Registry.js' );
const Hive = require( '../../Source/Hive.js' );
const ExchangeEngine = require( './engine.js' );


//---------------------------------------------------------------------
// Main
//---------------------------------------------------------------------

async function main()
{
	// Parse CLI arguments
	var options = MINIMIST( process.argv.slice( 2 ) );

	// Show help
	if ( options.help )
	{
		console.log( '' );
		console.log( 'Usage: node exchange.js [options]' );
		console.log( '' );
		console.log( 'Options:' );
		console.log( '  --registry <path>     Registry path (default: ~/.hives)' );
		console.log( '  --hive <path>         Hive workspace path (default: cwd)' );
		console.log( '  --exchange <name>     Exchange entity name (default: "main")' );
		console.log( '  --username <name>     Username (default: OS username)' );
		console.log( '  --password <pass>     Password for authentication' );
		console.log( '  --tick <ms>           Tick interval in milliseconds (default: 10000)' );
		console.log( '  --help                Show this help text' );
		console.log( '' );
		process.exit( 0 );
	}

	try
	{
		// Resolve registry path
		var registry_path = options.registry || PATH.join( OS.homedir(), '.hives' );
		var registry = await Registry.Open( registry_path );

		// Resolve username
		var username = options.username || OS.userInfo().username;

		// Resolve hive path
		var hive_path = options.hive || options.path || process.cwd();

		// Open hive (with optional password)
		var password = options.password || null;
		var hive = await Hive.Open( registry, hive_path, username, password );

		// Resolve exchange name
		var exchange_name = options.exchange || 'main';

		// Ensure the Exchange plugin is loaded
		if ( !hive.Plugins.Exchange )
		{
			console.error( 'Exchange plugin not found. Ensure Plugins/Exchange/ is in the registry.' );
			process.exit( 1 );
		}

		// Create exchange entity if it doesn't exist
		var config_result = await hive.InvokeTool( 'Exchange.ConfigEntity', {
			EntityName: exchange_name,
			Settings: {
				Name: exchange_name,
				Description: 'Main exchange',
				TickIntervalMs: parseInt( options.tick ) || 10000,
				LiquidationRate: 0.05,
				StartingEc: 10000,
				BaseAssetPrice: 10,
			},
		} );

		// Create the engine
		var engine = new ExchangeEngine( hive, exchange_name, null );

		// Create the TUI (engine gets wired in after TUI creation)
		var CreateTui = require( './tui.js' );
		var tui = CreateTui( { Engine: engine } );

		// Wire engine to TUI
		engine.Tui = tui;

		// Initialize the engine (seed assets if needed)
		await engine.Initialize();

		tui.Log( '{cyan-fg}Exchange initialized: ' + exchange_name + '{/cyan-fg}' );
		tui.Log( '{cyan-fg}Tick interval: ' + ( engine.TickIntervalMs / 1000 ).toFixed( 1 ) + 's{/cyan-fg}' );
		tui.Log( '' );
		tui.Log( 'Press {bold}p{/bold} to start the exchange, {bold}s{/bold} to step manually.' );
		tui.Log( 'Press {bold}q{/bold} to quit.' );

		// Initial refresh
		await tui.RefreshAll();

		// Don't auto-start — let user press 'p' to begin
	}
	catch ( error )
	{
		console.error( 'Error: ' + error.message );
		process.exitCode = 1;
	}
}


//---------------------------------------------------------------------
main();