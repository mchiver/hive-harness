#!/usr/bin/env node
/*
	Discord.js
---------------------------------------------------------------------
Discord channel implementation.
Connects a Hive to Discord as a bot. Each Discord user gets their own
conversation. Messages are processed sequentially via a promise queue
to prevent context interleaving across users.
*/

const Channel = require( '../../Source/Channel.js' );
const { Client, GatewayIntentBits, Partials, Events } = require( 'discord.js' );
const READLINE = require( 'readline' );


//---------------------------------------------------------------------
var DISCORD_MAX_LENGTH = 2000;

var DISCORD_INTENTS = [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.DirectMessages,
];

var DISCORD_PARTIALS = [
	Partials.Channel,
];


//=====================================================================
class DiscordChannel extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'discord';
		this.Client = null;
		this.ActiveMessage = null;
		this.UserConversations = {};
		this.ProcessingQueue = Promise.resolve();
	}


	//---------------------------------------------------------------------
	ResolveToken()
	{
		// 1. CLI flag
		if ( this.Options.token )
		{
			return String( this.Options.token );
		}

		// 2. Environment variable
		if ( process.env.DISCORD_BOT_TOKEN )
		{
			return process.env.DISCORD_BOT_TOKEN;
		}

		// 3. Not found
		throw new Error(
			'Discord bot token not provided.\n'
			+ 'Supply it via --token <token> or set the DISCORD_BOT_TOKEN environment variable.'
		);
	}


	//---------------------------------------------------------------------
	async ResolveUserConversation( DiscordUser )
	{
		// Check cache
		if ( this.UserConversations[ DiscordUser.id ] )
		{
			this.ConversationName = this.UserConversations[ DiscordUser.id ];
			this.UserName = 'discord:' + DiscordUser.username;
			this.Hive.UserName = this.UserName;
			return;
		}

		// Set user context
		this.UserName = 'discord:' + DiscordUser.username;
		this.Hive.UserName = this.UserName;

		// Try to resume last conversation for this user + channel
		var last_result = await this.Hive.InvokeTool( 'Conversation.GetLastConversation', {
			Username: this.UserName,
			ChannelName: this.ChannelName,
		} );

		if ( last_result.Success )
		{
			this.ConversationName = last_result.Result.ConversationName;
			this.UserConversations[ DiscordUser.id ] = this.ConversationName;
			return;
		}

		// Create a new conversation
		await this.CreateNewConversation( this.Hive );
		this.UserConversations[ DiscordUser.id ] = this.ConversationName;
	}


	//---------------------------------------------------------------------
	SplitMessage( Text )
	{
		var text = String( Text );
		if ( text.length <= DISCORD_MAX_LENGTH )
		{
			return [ text ];
		}

		var chunks = [];
		while ( text.length > 0 )
		{
			if ( text.length <= DISCORD_MAX_LENGTH )
			{
				chunks.push( text );
				break;
			}

			// Try to split at a newline boundary
			var slice = text.substring( 0, DISCORD_MAX_LENGTH );
			var split_index = slice.lastIndexOf( '\n' );
			if ( split_index < 1 )
			{
				split_index = DISCORD_MAX_LENGTH;
			}

			chunks.push( text.substring( 0, split_index ) );
			text = text.substring( split_index );
			if ( text.startsWith( '\n' ) )
			{
				text = text.substring( 1 );
			}
		}

		return chunks;
	}


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		// When not processing a Discord message, use plain console output
		if ( !this.ActiveMessage )
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
					var error_text = ( typeof Message === 'string' ) ? Message : JSON.stringify( Message );
					if ( process.stderr.isTTY )
					{
						process.stderr.write( '\x1b[31m' + error_text + '\x1b[0m\n' );
					}
					else
					{
						process.stderr.write( error_text + '\n' );
					}
					break;

				default:
					process.stdout.write( String( Message ) + '\n' );
					break;
			}
			return;
		}

		// Discord message formatting
		var formatted = '';

		switch ( Type )
		{
			case 'text':
				formatted = String( Message );
				break;

			case 'json':
				formatted = '```json\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				break;

			case 'table':
				if ( Array.isArray( Message ) && Message.length > 0 )
				{
					formatted = '```\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				}
				else
				{
					formatted = '```json\n' + JSON.stringify( Message, null, 2 ) + '\n```';
				}
				break;

			case 'error':
				formatted = '**Error:** ' + ( ( typeof Message === 'string' ) ? Message : JSON.stringify( Message ) );
				break;

			default:
				formatted = String( Message );
				break;
		}

		var chunks = this.SplitMessage( formatted );
		var discord_channel = this.ActiveMessage.channel;
		for ( var index = 0; index < chunks.length; index++ )
		{
			discord_channel.send( chunks[ index ] );
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
		var token = this.ResolveToken();

		this.Client = new Client( {
			intents: DISCORD_INTENTS,
			partials: DISCORD_PARTIALS,
		} );

		// Bot ready
		this.Client.once( Events.ClientReady, function ( ready_client )
		{
			console.log( 'Discord bot online: ' + ready_client.user.tag );
			console.log( 'Guilds: ' + ready_client.guilds.cache.size );
		} );

		// Message handler
		this.Client.on( Events.MessageCreate, function ( message )
		{
			// Ignore bot messages
			if ( message.author.bot ) { return; }

			// Queue for sequential processing
			self.ProcessingQueue = self.ProcessingQueue.then( async function ()
			{
				self.ActiveMessage = message;
				try
				{
					await self.ResolveUserConversation( message.author );
					await self.ProcessInput( self.Hive, message.content );
				}
				catch ( error )
				{
					self.Output( error.message, 'error' );
				}
				self.ActiveMessage = null;
			} );
		} );

		// Connect
		await this.Client.login( token );
	}


	//---------------------------------------------------------------------
	async Stop()
	{
		if ( this.Client )
		{
			this.Client.destroy();
			this.Client = null;
		}
		process.exit( 0 );
	}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		var lines = [
			'',
			'Usage: hive-discord [options]',
			'',
			'Options:',
			'  --registry <path>     Registry path (default: ~/.hives)',
			'  --hive <path>         Hive workspace path (default: cwd)',
			'  --path <path>         Alias for --hive',
			'  --username <name>     Default username (default: OS username)',
			'  --password <pass>     Password for authentication',
			'  --conversation <name> Default conversation name',
			'  --llm <name>          ChatLlm entity name override',
			'  --token <token>       Discord bot token',
			'  --test                Dry run: resolve all state, print report, exit',
			'  --help                Show this help text',
			'',
			'Environment:',
			'  DISCORD_BOT_TOKEN     Discord bot token (alternative to --token)',
			'',
			'The bot responds to all messages in channels it can see',
			'and to direct messages. Each Discord user gets their own',
			'conversation automatically.',
			'',
			'Interactive commands (sent as Discord messages):',
			'  /Help                       Show help',
			'  /Login <user> [pass]        Switch user',
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
Channel.Run( DiscordChannel );
