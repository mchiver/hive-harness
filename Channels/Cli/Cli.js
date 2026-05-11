#!/usr/bin/env node
/*
	Cli.js
---------------------------------------------------------------------
CLI channel implementation.
Supports one-shot command execution and interactive readline sessions
with tab-completion for tool names, entity names, and channel commands.
*/

const Channel = require( '../../Source/Channel.js' );
const READLINE = require( 'readline' );


//=====================================================================
class CliChannel extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'cli';
		this.Interface = null;
	}


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		switch ( Type )
		{
			case 'text':
				process.stdout.write( String( Message ) + '\n' );
				break;

			case 'json':
				process.stdout.write( JSON.stringify( Message, null, 2 ) + '\n' );
				break;

			case 'table':
				if ( Array.isArray( Message ) && Message.length > 0 )
				{
					console.table( Message );
				}
				else
				{
					process.stdout.write( JSON.stringify( Message, null, 2 ) + '\n' );
				}
				break;

			case 'error':
				var text = ( typeof Message === 'string' ) ? Message : JSON.stringify( Message );
				if ( process.stderr.isTTY )
				{
					process.stderr.write( '\x1b[31m' + text + '\x1b[0m\n' );
				}
				else
				{
					process.stderr.write( text + '\n' );
				}
				break;

			default:
				process.stdout.write( String( Message ) + '\n' );
				break;
		}
	}


	//---------------------------------------------------------------------
	async Prompt()
	{
		return new Promise( function ( resolve )
		{
			var rl = READLINE.createInterface( {
				input: process.stdin,
				output: process.stdout,
			} );
			rl.question( '> ', function ( answer )
			{
				rl.close();
				resolve( answer );
			} );
		} );
	}


	//---------------------------------------------------------------------
	async PromptChoice( Message, Items )
	{
		this.Output( Message, 'text' );
		for ( var index = 0; index < Items.length; index++ )
		{
			var label = Items[ index ].Name || String( Items[ index ] );
			var description = Items[ index ].Description || '';
			var line = '  ' + ( index + 1 ) + '. ' + label;
			if ( description ) { line += ' — ' + description; }
			this.Output( line, 'text' );
		}

		var answer = await this.Prompt();
		var selection = parseInt( answer, 10 ) - 1;
		if ( selection >= 0 && selection < Items.length )
		{
			return Items[ selection ].Name || String( Items[ selection ] );
		}
		throw new Error( 'Invalid selection.' );
	}


	//---------------------------------------------------------------------
	async Start()
	{
		var self = this;

		this.Output( 'Conversation: ' + this.ConversationName, 'text' );
		this.Output( 'Type /Help for commands. Press Ctrl+C to exit.', 'text' );

		this.Interface = READLINE.createInterface( {
			input: process.stdin,
			output: process.stdout,
			prompt: '> ',
			completer: function ( line, callback )
			{
				self.GetSuggestions( self.Hive, line ).then( function ( suggestions )
				{
					callback( null, [ suggestions, line ] );
				} ).catch( function ()
				{
					callback( null, [ [], line ] );
				} );
			},
		} );

		this.Interface.prompt();

		this.Interface.on( 'line', async function ( line )
		{
			try
			{
				await self.ProcessInput( self.Hive, line );
			}
			catch ( error )
			{
				self.Output( error.message, 'error' );
			}
			self.Interface.prompt();
		} );

		this.Interface.on( 'close', async function ()
		{
			await self.Stop();
		} );
	}


	//---------------------------------------------------------------------
	async Stop()
	{
		if ( this.Interface )
		{
			this.Interface.close();
			this.Interface = null;
		}
		process.exit( 0 );
	}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		var lines = [
			'',
			'Usage: hive [options] [text or command]',
			'',
			'Options:',
			'  --registry <path>     Registry path (default: HIVE_REGISTRY env or ~/.hives, auto-initialized)',
			'  --hive <name>         Open a named global hive at <registry>/Hives/<name>/',
			'  --path <path>         Open the given folder as a project-scoped hive (default: cwd)',
			'  --username <name>     Username (default: the registry\'s `default` user)',
			'  --password <pass>     Password for authentication (omit for passwordless users)',
			'  --conversation <name> Resume a named conversation',
			'  --llm <name>          ChatLlm entity name override',
			'  --test                Dry run: resolve all state, print report, exit',
			'  --help                Show this help text',
			'',
			'Interactive commands:',
			'  /Help                       Show this help',
			'  /Login <user> [pass]        Switch user (reopens session)',
			'  /Conversation [name]        Switch or list conversations',
			'  /NewConversation [name]     Create new conversation',
			'',
			'Input routing:',
			'  /Command       -> Channel command',
			'  Plugin.Tool    -> Direct tool invocation',
			'  anything else  -> Conversation.Chat (LLM)',
			'',
		];
		process.stdout.write( lines.join( '\n' ) + '\n' );
	}


}


//---------------------------------------------------------------------
Channel.Run( CliChannel );
