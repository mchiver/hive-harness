#!/usr/bin/env node
/*
	server.js (ConsensusWeb)
---------------------------------------------------------------------
Express HTTP server that exposes ConsensusLib over a small REST API
plus an SSE stream of live run events. Authentication is HTTP Basic
against the HiveJS Registry; each request opens its own per-user Hive
wrapper over a single shared Runtime.
*/


const PATH = require( 'path' );
const OS = require( 'os' );
const EXPRESS = require( 'express' );

const Registry = require( '../../Source/Registry.js' );
const HiveModule = require( '../../Source/Hive.js' );
const HiveRuntime = HiveModule.HiveRuntime;

const ConsensusLib = require( '../ConsensusLib' );
const SessionRegistryModule = require( './Lib/session_registry.js' );


//---------------------------------------------------------------------
function expand_home( Path )
{
	if ( !Path ) { return Path; }
	if ( Path.startsWith( '~' ) ) { return PATH.join( OS.homedir(), Path.slice( 1 ) ); }
	return Path;
}


//---------------------------------------------------------------------
function parse_args( Argv )
{
	var args = { _: [], flags: {} };
	for ( var i = 0; i < Argv.length; i++ )
	{
		var token = Argv[ i ];
		if ( token.startsWith( '--' ) )
		{
			var key = token.slice( 2 );
			var value = Argv[ i + 1 ];
			if ( value === undefined || value.startsWith( '--' ) )
			{
				args.flags[ key ] = true;
			}
			else
			{
				args.flags[ key ] = value;
				i++;
			}
		}
		else
		{
			args._.push( token );
		}
	}
	return args;
}


//---------------------------------------------------------------------
function require_auth( Res )
{
	Res.set( 'WWW-Authenticate', 'Basic realm="Consensus"' );
	Res.status( 401 ).send( 'Authentication required' );
}


//---------------------------------------------------------------------
async function basic_auth( Req, Res, RegistryInstance, Runtime )
{
	var hdr = Req.headers.authorization || '';
	if ( !hdr.startsWith( 'Basic ' ) )
	{
		require_auth( Res );
		return false;
	}
	var decoded = Buffer.from( hdr.slice( 6 ), 'base64' ).toString( 'utf8' );
	var idx = decoded.indexOf( ':' );
	var username = idx < 0 ? decoded : decoded.slice( 0, idx );
	var password = idx < 0 ? '' : decoded.slice( idx + 1 );

	try
	{
		var user = await RegistryInstance.Authenticate( username, password );
		Req.User = {
			UserName: ( user && ( user.Username || user.UserName ) ) || username,
			UserRole: ( user && user.Role ) || 'user',
		};
		Req.Hive = HiveModule.ForUser( Runtime, {
			UserName: Req.User.UserName,
			UserRole: Req.User.UserRole,
			Token: '',
		} );
		return true;
	}
	catch ( e )
	{
		require_auth( Res );
		return false;
	}
}


//---------------------------------------------------------------------
function show_help()
{
	process.stdout.write( [
		'',
		'Usage: consensus-web [options]',
		'',
		'Options:',
		'  --registry <path>     Default: ~/.hives',
		'  --hive <path>         Default: cwd',
		'  --port <number>       Default: 3030',
		'  --help                Show this help',
		'',
	].join( '\n' ) + '\n' );
}


//---------------------------------------------------------------------
async function main()
{
	var args = parse_args( process.argv.slice( 2 ) );
	if ( args.flags.help ) { show_help(); return; }

	var registry_path = expand_home( args.flags.registry || '~/.hives' );
	var hive_path = expand_home( args.flags.hive || process.cwd() );
	var port = Number( args.flags.port || 3030 );

	var registry = await Registry.Open( registry_path );
	var runtime = await HiveRuntime.OpenRuntime( registry, hive_path );

	var sessions = new SessionRegistryModule.SessionRegistry();

	var app = EXPRESS();
	app.use( EXPRESS.json() );
	app.use( EXPRESS.static( PATH.join( __dirname, 'public' ) ) );

	app.use( '/api', function ( Req, Res, Next )
	{
		basic_auth( Req, Res, registry, runtime ).then( function ( ok )
		{
			if ( ok ) { Next(); }
		} ).catch( function ( e )
		{
			require_auth( Res );
		} );
	} );

	require( './Routes/runs.js' )( app, {
		ConsensusLib: ConsensusLib,
		SessionRegistry: sessions,
	} );

	app.use( function ( Err, Req, Res, Next )
	{
		process.stderr.write( 'API error: ' + ( Err && Err.message ? Err.message : Err ) + '\n' );
		if ( Res.headersSent ) { return; }
		Res.status( 500 ).json( { error: Err && Err.message ? Err.message : String( Err ) } );
	} );

	app.listen( port, function ()
	{
		process.stdout.write( 'ConsensusWeb listening on http://localhost:' + port + '\n' );
		process.stdout.write( '  Registry: ' + registry_path + '\n' );
		process.stdout.write( '  Hive:     ' + hive_path + '\n' );
	} );
}


//---------------------------------------------------------------------
main().catch( function ( e )
{
	process.stderr.write( 'consensus-web: ' + ( e && e.message ? e.message : e ) + '\n' );
	process.exit( 1 );
} );
