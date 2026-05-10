#!/usr/bin/env node
/*
	Web.js
---------------------------------------------------------------------
Web channel implementation.
Serves a single Hive runtime to multiple users via Express with SSE
streaming. Each request gets its own Hive wrapper over the shared
runtime, carrying the JWT-authenticated user's identity. No shared
mutable identity state — concurrent requests cannot race.
*/

const Channel = require( '../../Source/Channel.js' );
const Hive = require( '../../Source/Hive.js' );
const HiveRuntime = Hive.HiveRuntime;
const EXPRESS = require( 'express' );
const PATH = require( 'path' );
const MINIMIST = require( 'minimist' );

const AuthMiddleware = require( './Middleware/Auth.js' );


//=====================================================================
class WebChannel extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'web';
		this.Runtime = null;
		this.Server = null;
		this.SseClients = new Map();
	}


	//---------------------------------------------------------------------
	// Web channel does not use Channel.Run().
	// It defines its own entry point for multi-user server mode.
	static async Serve()
	{
		var channel = new WebChannel();

		// Parse CLI arguments
		channel.Options = MINIMIST( process.argv.slice( 2 ) );

		// Help
		if ( channel.Options.help )
		{
			channel.ShowHelp();
			return;
		}

		try
		{
			// Initialize Registry + shared Runtime
			await channel.Initialize();

			// Build Express app
			var app = EXPRESS();
			app.use( EXPRESS.json() );

			// Auth middleware (before routes, after body parser)
			app.use( AuthMiddleware( channel ) );

			// Per-request Hive — builds a fresh wrapper over the shared
			// Runtime, carrying the authenticated user's identity. Each
			// request has its own Hive object; no shared mutable state.
			app.use( function ( req, res, next )
			{
				if ( req.User )
				{
					req.Hive = Hive.ForUser( channel.Runtime, {
						UserName: req.User.Username,
						UserRole: req.User.Role,
						Token: req.User.Token || '',
					} );
				}
				else
				{
					// Unauthenticated paths (static, login, SPA) — use a
					// guest Hive over the shared Runtime.
					req.Hive = channel.Hive;
				}
				next();
			} );

			// Static files
			app.use( EXPRESS.static( PATH.join( __dirname, 'public' ) ) );

			// Mount API routes
			require( './Routes/Auth.js' )( app, channel );
			require( './Routes/System.js' )( app, channel );
			require( './Routes/Entities.js' )( app, channel );
			require( './Routes/Chat.js' )( app, channel );
			require( './Routes/Conversations.js' )( app, channel );
			require( './Routes/Tools.js' )( app, channel );
			require( './Routes/Suggest.js' )( app, channel );

			// SPA fallback — serve index.html for all non-API routes
			app.get( '/{*path}', function ( req, res )
			{
				res.sendFile( 'index.html', { root: PATH.join( __dirname, 'public' ) } );
			} );

			// Start server
			var log = new channel.Hive.Helpers.Logger.CreateLogger();
			var port = channel.Options.port || 3000;
			channel.Server = app.listen( port, function ()
			{
				log.Info( 'Hive Web Channel' );
				log.Info( 'Registry: ' + channel.Registry.RegistryPath );
				log.Info( 'Hive: ' + channel.Hive.HiveRoot );
				log.Info( 'Listening on port ' + port );
			} );

			// Store app reference for testing
			channel.App = app;
		}
		catch ( error )
		{
			channel.Output( error.message, 'error' );
			process.exitCode = 1;
		}
	}


	//---------------------------------------------------------------------
	// Override Initialize — open a shared Runtime for the hive folder.
	// Per-request Hives wrap this Runtime with the caller's identity.
	async Initialize()
	{
		var OS = require( 'os' );
		var FileUtils = require( '../../Helpers/FileUtils.js' );
		var Registry = require( '../../Source/Registry.js' );

		// Resolve registry path
		var registry_path = this.Options.registry || PATH.join( OS.homedir(), '.hives' );
		if ( !await FileUtils.FolderExists( registry_path ) )
		{
			throw new Error( 'Registry not found at: ' + registry_path );
		}
		this.Registry = await Registry.Open( registry_path );

		// Resolve hive path
		var hive_path = this.Options.hive || this.Options.path || process.cwd();

		// Open shared Runtime — plugins, events, helpers, paths.
		this.Runtime = await HiveRuntime.OpenRuntime( this.Registry, hive_path );

		// Guest Hive wrapper — used for startup logging and by routes
		// serving unauthenticated paths. No per-user identity.
		this.Hive = Hive.ForUser( this.Runtime, {} );
	}


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		switch ( Type )
		{
			case 'error':
				process.stderr.write( String( Message ) + '\n' );
				break;
			default:
				process.stdout.write( String( Message ) + '\n' );
				break;
		}
	}


	//---------------------------------------------------------------------
	async Prompt()
	{
		throw new Error( 'Prompt() is not supported by the Web channel.' );
	}


	//---------------------------------------------------------------------
	async PromptChoice( Message, Items )
	{
		throw new Error( 'PromptChoice() is not supported by the Web channel.' );
	}


	//---------------------------------------------------------------------
	async Start()
	{
		// Not used — Serve() handles startup.
	}


	//---------------------------------------------------------------------
	async Stop()
	{
		if ( this.Server )
		{
			this.Server.close();
			this.Server = null;
		}
	}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		var lines = [
			'',
			'Usage: hive-web [options]',
			'',
			'Options:',
			'  --registry <path>     Registry path (default: ~/.hives)',
			'  --hive <path>         Hive workspace path (default: cwd)',
			'  --path <path>         Alias for --hive',
			'  --port <number>       HTTP port (default: 3000)',
			'  --help                Show this help text',
			'',
			'Users authenticate via the web login form.',
			'Each request runs under the logged-in user\'s identity.',
			'',
		];
		process.stdout.write( lines.join( '\n' ) + '\n' );
	}


}


//---------------------------------------------------------------------
// Auto-start only when run directly (not when required by tests)
if ( require.main === module )
{
	WebChannel.Serve();
}


//---------------------------------------------------------------------
module.exports = WebChannel;
