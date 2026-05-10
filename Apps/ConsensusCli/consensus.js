#!/usr/bin/env node
/*
	consensus.js (CLI)
---------------------------------------------------------------------
Thin command-line wrapper over ConsensusLib. All engine logic lives
in ../ConsensusLib; this file just routes argv, opens a Hive, and
attaches a console UI to the Session events.
*/


const PATH = require( 'path' );
const OS = require( 'os' );
const READLINE = require( 'readline' );

const Registry = require( '../../Source/Registry.js' );
const Hive = require( '../../Source/Hive.js' );

const ConsensusLib = require( '../ConsensusLib' );


//---------------------------------------------------------------------
function log( Message )
{
	process.stdout.write( String( Message ) + '\n' );
}


//---------------------------------------------------------------------
function err( Message )
{
	process.stderr.write( String( Message ) + '\n' );
}


//---------------------------------------------------------------------
var COLORS = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	bold: '\x1b[1m',
	cyan: '\x1b[36m',
	yellow: '\x1b[33m',
	green: '\x1b[32m',
	magenta: '\x1b[35m',
	red: '\x1b[31m',
};


//---------------------------------------------------------------------
function colorize( Text, Color )
{
	if ( !process.stdout.isTTY ) { return Text; }
	return ( COLORS[ Color ] || '' ) + Text + COLORS.reset;
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
function expand_home( Path )
{
	if ( !Path ) { return Path; }
	if ( Path.startsWith( '~' ) ) { return PATH.join( OS.homedir(), Path.slice( 1 ) ); }
	return Path;
}


//---------------------------------------------------------------------
async function open_hive( Flags )
{
	var registry_path = expand_home( Flags.registry || '~/.hives' );
	var hive_path = expand_home( Flags.hive || process.cwd() );
	var username = Flags.username || OS.userInfo().username;
	var password = Flags.password || '';

	var registry = await Registry.Open( registry_path );
	return await Hive.Open( registry, hive_path, username, password );
}


//---------------------------------------------------------------------
function prompt_line( PromptText )
{
	return new Promise( function ( resolve )
	{
		var rl = READLINE.createInterface( { input: process.stdin, output: process.stdout } );
		rl.question( PromptText, function ( answer )
		{
			rl.close();
			resolve( answer );
		} );
	} );
}


//---------------------------------------------------------------------
// Captures p / r / q keystrokes and routes them into the Session.
class KeyboardController
{

	constructor( SessionInstance )
	{
		this.session = SessionInstance;
		this.raw = false;
		this.handler = null;
	}

	Start()
	{
		if ( !process.stdin.isTTY ) { return; }
		var self = this;
		process.stdin.setRawMode( true );
		process.stdin.resume();
		process.stdin.setEncoding( 'utf8' );
		this.handler = function ( key )
		{
			if ( key === 'p' || key === 'P' ) { self._on_pause(); }
			else if ( key === 'q' || key === 'Q' || key === '\u0003' )
			{
				self.session.Abort();
			}
		};
		process.stdin.on( 'data', this.handler );
		this.raw = true;
	}

	Stop()
	{
		if ( !this.raw ) { return; }
		process.stdin.removeListener( 'data', this.handler );
		try { process.stdin.setRawMode( false ); } catch ( e ) { /* ignore */ }
		process.stdin.pause();
		this.raw = false;
	}

	async _on_pause()
	{
		this.session.Pause();
		if ( this.raw )
		{
			process.stdin.removeListener( 'data', this.handler );
			try { process.stdin.setRawMode( false ); } catch ( e ) { /* ignore */ }
		}
		log( '' );
		log( colorize( '== PAUSED ==', 'yellow' ) );
		log( colorize( 'Type a directive (or just press Enter to resume).', 'dim' ) );
		var directive = await prompt_line( '> ' );
		if ( directive && directive.trim() ) { this.session.SetDirective( directive.trim() ); }
		else { this.session.Resume(); }
		if ( this.raw )
		{
			try { process.stdin.setRawMode( true ); } catch ( e ) { /* ignore */ }
			process.stdin.resume();
			process.stdin.on( 'data', this.handler );
		}
	}

}


//---------------------------------------------------------------------
function attach_console( SessionInstance )
{
	SessionInstance.on( 'decision', function ( d )
	{
		log( '' );
		var head = colorize( '[Moderator]', 'cyan' ) + ' ' + colorize( d.Action, 'bold' );
		if ( d.NodeId ) { head += ' on ' + colorize( d.NodeId, 'magenta' ); }
		if ( d.ParticipantId ) { head += ' -> ' + colorize( d.ParticipantId, 'green' ); }
		log( head );
		if ( d.Rationale ) { log( colorize( '  why: ' + d.Rationale, 'dim' ) ); }
		if ( d.Instruction ) { log( colorize( '  ask: ' + d.Instruction, 'dim' ) ); }
		if ( d.NewQuestion ) { log( colorize( '  new question: ' + d.NewQuestion, 'dim' ) ); }
		if ( d.ProposedResolution ) { log( colorize( '  proposal: ' + d.ProposedResolution, 'dim' ) ); }
	} );

	SessionInstance.on( 'contribution', function ( ev )
	{
		if ( ev.Contribution.Skipped ) { return; }
		log( colorize( '[' + ( ev.Decision.ParticipantId || 'system' ) + ']', 'green' ) );
		var lines = String( ev.Contribution.Content || '' ).split( '\n' );
		for ( var i = 0; i < lines.length; i++ ) { log( '  ' + lines[ i ] ); }
	} );

	SessionInstance.on( 'resumed', function () { log( colorize( 'Resumed.', 'dim' ) ); } );
	SessionInstance.on( 'aborted', function () { log( colorize( 'Aborting...', 'yellow' ) ); } );
	SessionInstance.on( 'concluded', function ( ev ) { log( colorize( 'Run concluded (' + ev.Reason + ').', 'green' ) ); } );
	SessionInstance.on( 'stopped', function ( ev ) { log( colorize( 'Run stopped (' + ev.Reason + ').', 'yellow' ) ); } );
	SessionInstance.on( 'error', function ( e )
	{
		err( colorize( 'Error: ' + ( e && e.message ? e.message : e ), 'red' ) );
	} );
}


//---------------------------------------------------------------------
async function drive( HiveInstance, RunId )
{
	var session = new ConsensusLib.Session( HiveInstance, RunId );
	attach_console( session );
	var keyboard = new KeyboardController( session );
	keyboard.Start();
	log( colorize( 'Controls: [p] pause/directive  [q] abort', 'dim' ) );
	try { await session.Run(); }
	finally { keyboard.Stop(); }
}


//---------------------------------------------------------------------
async function command_init( Args )
{
	if ( !Args.flags.llm ) { throw new Error( 'init requires --llm <entity-name>' ); }
	var hive = await open_hive( Args.flags );
	await ConsensusLib.EnsureApp( hive, Args.flags.llm, log );
}


//---------------------------------------------------------------------
async function command_new( Args )
{
	var issue = Args._[ 1 ];
	if ( !issue ) { throw new Error( 'new requires a quoted issue' ); }
	if ( !Args.flags.llm ) { throw new Error( 'new requires --llm <entity-name>' ); }
	var hive = await open_hive( Args.flags );
	var run = await ConsensusLib.NewRun( hive, {
		Issue: issue,
		Llm: Args.flags.llm,
		MaxTurns: Number( Args.flags[ 'max-turns' ] || 40 ),
	} );
	log( 'Run created: ' + run.RunId );
	await drive( hive, run.RunId );
}


//---------------------------------------------------------------------
async function command_resume( Args )
{
	var run_id = Args._[ 1 ];
	if ( !run_id ) { throw new Error( 'resume requires a run-id' ); }
	var hive = await open_hive( Args.flags );
	await ConsensusLib.ResumeRun( hive, run_id );
	log( 'Resuming ' + run_id );
	await drive( hive, run_id );
}


//---------------------------------------------------------------------
async function command_list( Args )
{
	var hive = await open_hive( Args.flags );
	var runs = await ConsensusLib.ListRuns( hive );
	if ( !runs.length ) { log( '(no runs)' ); return; }
	for ( var i = 0; i < runs.length; i++ )
	{
		var r = runs[ i ];
		log( [ r.RunId, r.Status, r.Phase || '-', 'turn=' + r.TurnCounter, r.CreatedAt, r.Issue ].join( '  ' ) );
	}
}


//---------------------------------------------------------------------
async function command_report( Args )
{
	var run_id = Args._[ 1 ];
	if ( !run_id ) { throw new Error( 'report requires a run-id' ); }
	var hive = await open_hive( Args.flags );
	var report = await ConsensusLib.RenderReport( hive, run_id );
	log( report );
}


//---------------------------------------------------------------------
async function command_delete( Args )
{
	var run_id = Args._[ 1 ];
	if ( !run_id ) { throw new Error( 'delete requires a run-id' ); }
	var hive = await open_hive( Args.flags );
	var result = await ConsensusLib.DeleteRun( hive, run_id );
	for ( var i = 0; i < result.DeletedConversations.length; i++ )
	{
		log( '  deleted conversation: ' + result.DeletedConversations[ i ] );
	}
	for ( var s = 0; s < result.SkippedConversations.length; s++ )
	{
		log( '  (skip) ' + result.SkippedConversations[ s ].Name + ': ' + result.SkippedConversations[ s ].Error );
	}
	log( 'Run deleted: ' + run_id );
}


//---------------------------------------------------------------------
function show_help()
{
	log( '' );
	log( 'Usage: consensus <subcommand> [options]' );
	log( '' );
	log( 'Subcommands:' );
	log( '  init                  Provision app state (idempotent).' );
	log( '  new "<issue>"         Start a new run.' );
	log( '  resume <run-id>       Resume a run.' );
	log( '  list                  List runs.' );
	log( '  report <run-id>       Print run report.' );
	log( '  delete <run-id>       Delete a run and its conversations.' );
	log( '' );
	log( 'Options:' );
	log( '  --registry <path>     Default: ~/.hives' );
	log( '  --hive <path>         Default: cwd' );
	log( '  --username <name>     Default: OS username' );
	log( '  --password <pass>' );
	log( '  --llm <name>          Llm entity name (init / new)' );
	log( '  --max-turns <n>       Default: 40' );
	log( '' );
	log( 'Interactive (during a run): p = pause, q = abort.' );
	log( '' );
}


//---------------------------------------------------------------------
async function main()
{
	var args = parse_args( process.argv.slice( 2 ) );
	var cmd = args._[ 0 ];

	if ( !cmd || cmd === 'help' || args.flags.help )
	{
		show_help();
		return;
	}

	switch ( cmd )
	{
		case 'init':    await command_init( args );    break;
		case 'new':     await command_new( args );     break;
		case 'list':    await command_list( args );    break;
		case 'resume':  await command_resume( args );  break;
		case 'report':  await command_report( args );  break;
		case 'delete':  await command_delete( args );  break;
		default:
			err( 'Unknown subcommand: ' + cmd );
			show_help();
			process.exit( 1 );
	}
}


//---------------------------------------------------------------------
main().then( function ()
{
	process.exit( 0 );
} ).catch( function ( e )
{
	err( 'consensus: ' + ( e && e.message ? e.message : e ) );
	process.exit( 1 );
} );
