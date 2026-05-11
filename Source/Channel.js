/*
	Channel.js
---------------------------------------------------------------------
Base class for all Hive channels.
Handles CLI arg parsing, Registry/Hive initialization, conversation
management, input routing, autocomplete suggestions, and dry run.
Subclasses override abstract hooks for channel-specific I/O.

User-scoped methods take a Hive parameter so that channels serving
multiple users (Web) can pass a per-request Hive wrapper without
mutating shared state. CLI/Discord pass this.Hive.
*/

const OS = require( 'os' );
const PATH = require( 'path' );
const MINIMIST = require( 'minimist' );
const MONIKER = require( 'moniker' );

const Registry = require( './Registry.js' );
const Hive = require( './Hive.js' );
const FileUtils = require( '../Helpers/FileUtils.js' );


//---------------------------------------------------------------------
// Moniker generator: verb-adjective-noun
var NAME_GENERATOR = MONIKER.generator( [ MONIKER.verb, MONIKER.adjective, MONIKER.noun ] );


//---------------------------------------------------------------------
// Built-in channel commands
var CHANNEL_COMMANDS = [ '/Help', '/Login', '/Conversation', '/NewConversation' ];


//=====================================================================
class Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		this.ChannelName = '';
		this.Registry = null;
		this.Hive = null;
		this.UserName = '';
		this.ConversationName = '';
		this.IsInteractive = false;
		this.Options = {};
	}


	//---------------------------------------------------------------------
	// Static entry point. Instantiates the channel, parses args, and runs.
	static async Run( ChannelClass )
	{
		var channel = new ChannelClass();

		// Parse CLI arguments
		channel.Options = MINIMIST( process.argv.slice( 2 ) );

		// Determine interactivity before any setup
		var positional = channel.Options._ || [];
		channel.IsInteractive = ( positional.length === 0 && process.stdin.isTTY === true );

		// Help — show and exit
		if ( channel.Options.help )
		{
			channel.ShowHelp();
			return;
		}

		try
		{
			// Initialize Registry and Hive
			await channel.Initialize();

			// Resolve conversation
			await channel.ResolveConversation( channel.Hive );

			// Dry run — report and exit
			if ( channel.Options.test )
			{
				await channel.RunTest( channel.Hive );
				return;
			}

			// One-shot mode
			if ( positional.length > 0 )
			{
				var input_text = positional.join( ' ' );
				await channel.ProcessInput( channel.Hive, input_text );
				await channel.Stop();
				return;
			}

			// Interactive mode
			await channel.Start();
		}
		catch ( error )
		{
			channel.Output( error.message, 'error' );
			process.exitCode = 1;
		}
	}


	//---------------------------------------------------------------------
	// Open Registry and Hive. Does NOT resolve conversation.
	//   --registry <path>   Explicit registry path. Defaults to HIVE_REGISTRY env or ~/.hives.
	//                       The registry is auto-initialized if missing.
	//   --hive <name>       Opens the named global hive at <registry>/Hives/<name>/.
	//   --path <path>       Opens the given folder as a project-scoped hive.
	//   (no flag)           Opens the current working directory as a project-scoped hive.
	async Initialize()
	{
		// Resolve the registry path.
		// - Explicit --registry <path>: must already exist; do not auto-create.
		// - Default location (no flag): auto-initialize if missing.
		if ( this.Options.registry )
		{
			var explicit_path = this.Options.registry;
			if ( !await FileUtils.FolderExists( explicit_path ) )
			{
				throw new Error( 'Registry not found: ' + explicit_path );
			}
			this.Registry = await Registry.Open( explicit_path );
		}
		else
		{
			this.Registry = await Registry.EnsureDefault( Registry.DefaultPath() );
		}

		// Optional credentials. Username defaults inside Hive.Open to the registry's 'default' user.
		var username = this.Options.username || '';
		var password = this.Options.password || null;

		if ( this.Options.hive )
		{
			// Named global hive
			this.Hive = await Hive.OpenGlobal( this.Options.hive, username, password, this.Registry );
		}
		else
		{
			var hive_path = this.Options.path || process.cwd();
			this.Hive = await Hive.Open( this.Registry, hive_path, username, password );
		}

		// Reflect the resolved identity (may have come from the default user).
		this.UserName = this.Hive.UserName;
	}


	//---------------------------------------------------------------------
	// Find or create a conversation for this user + channel.
	async ResolveConversation( Hive )
	{
		// Option 1: Explicit --conversation flag
		if ( this.Options.conversation )
		{
			var plugin = Hive.Plugins.Conversation;
			try
			{
				await plugin.GetEntityConfig( Hive, this.Options.conversation );
			}
			catch ( error )
			{
				throw new Error( 'Conversation not found: ' + this.Options.conversation );
			}
			this.ConversationName = this.Options.conversation;
			return;
		}

		// Option 2: Resume most recent conversation for this user + channel
		var last_result = await Hive.InvokeTool( 'Conversation.GetLastConversation', {
			Username: Hive.UserName,
			ChannelName: this.ChannelName,
		} );
		if ( last_result.Success )
		{
			this.ConversationName = last_result.Result.ConversationName;
			return;
		}

		// Option 3: Create a new conversation
		await this.CreateNewConversation( Hive );
	}


	//---------------------------------------------------------------------
	// Create a new conversation entity.
	async CreateNewConversation( Hive, Name )
	{
		var conversation_name = Name || NAME_GENERATOR.choose();

		// Resolve which LLM to use
		var chat_llm = await this.ResolveChatLlm( Hive );

		var result = await Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conversation_name,
			Settings: {
				Username: Hive.UserName,
				ChannelName: this.ChannelName,
				ChatLlm: chat_llm,
			},
		} );

		if ( !result.Success )
		{
			throw new Error( 'Failed to create conversation: ' + result.Error );
		}

		this.ConversationName = conversation_name;
	}


	//---------------------------------------------------------------------
	// Resolve the ChatLlm for a new conversation.
	async ResolveChatLlm( Hive )
	{
		// 1. CLI flag override
		if ( this.Options.llm )
		{
			return this.Options.llm;
		}

		// 2. Plugin config DefaultChatLlm
		var plugin = Hive.Plugins.Conversation;
		if ( plugin && plugin.DefaultChatLlm )
		{
			return plugin.DefaultChatLlm;
		}

		// 3. Interactive: prompt user to select
		if ( this.IsInteractive )
		{
			var llm_list = await Hive.InvokeTool( 'Llm.ListEntities', {} );
			if ( !llm_list.Success || !llm_list.Result || llm_list.Result.length === 0 )
			{
				throw new Error( 'No Llm entities configured. Create one with Llm.ConfigEntity.' );
			}
			return await this.PromptChoice( 'Select a ChatLlm:', llm_list.Result );
		}

		// 4. Non-interactive: error
		throw new Error( 'No ChatLlm configured. Use --llm flag or set DefaultChatLlm in Conversation plugin config.' );
	}


	//---------------------------------------------------------------------
	// Route user input to the appropriate handler.
	async ProcessInput( Hive, InputText )
	{
		var text = InputText.trim();
		if ( text.length === 0 ) { return; }

		// 1. Channel commands (starts with /)
		if ( text.startsWith( '/' ) )
		{
			await this.HandleCommand( Hive, text );
			return;
		}

		// 2. Tool invocation (first token matches Plugin.Tool)
		var command_processor = Hive.Helpers.CommandProcessor;
		var parsed = command_processor.Parse( text );
		if ( parsed.PluginName && parsed.ToolName )
		{
			var validation = command_processor.Validate( Hive, parsed.PluginName, parsed.ToolName, {} );
			if ( validation.Valid )
			{
				var coerced = command_processor.Coerce( parsed.Arguments, validation.Tool.Parameters );
				var result = await command_processor.Invoke( Hive, parsed.PluginName, parsed.ToolName, coerced );
				if ( result.Success )
				{
					this.Output( result.Result, 'json' );
				}
				else
				{
					this.Output( result.Error, 'error' );
				}
				return;
			}
		}

		// 3. Chat — forward to Conversation.Chat
		var chat_result = await Hive.InvokeTool( 'Conversation.Chat', {
			EntityName: this.ConversationName,
			Text: text,
		} );

		if ( chat_result.Success && chat_result.Result && chat_result.Result.Response )
		{
			this.Output( chat_result.Result.Response, 'text' );
		}
		else
		{
			this.Output( chat_result.Error || 'Unknown error', 'error' );
		}
	}


	//---------------------------------------------------------------------
	// Dispatch a channel command.
	async HandleCommand( Hive, CommandText )
	{
		var trimmed = CommandText.substring( 1 ).trim();
		var space_index = trimmed.indexOf( ' ' );
		var command_name = ( space_index > -1 ) ? trimmed.substring( 0, space_index ) : trimmed;
		var command_args = ( space_index > -1 ) ? trimmed.substring( space_index + 1 ).trim() : '';

		switch ( command_name.toLowerCase() )
		{
			case 'help':
				this.ShowHelp();
				break;
			case 'login':
				await this.CommandLogin( command_args );
				break;
			case 'conversation':
				await this.CommandConversation( Hive, command_args );
				break;
			case 'newconversation':
				await this.CommandNewConversation( Hive, command_args );
				break;
			default:
				this.Output( 'Unknown command: /' + command_name, 'error' );
				break;
		}
	}


	//---------------------------------------------------------------------
	// /Login <username> [password]
	// CLI/Discord only — rebinds this.Hive for the single-user session.
	async CommandLogin( ArgsText )
	{
		var parts = ArgsText.trim().split( /\s+/ );
		var username = parts[ 0 ] || '';
		var password = parts[ 1 ] || null;

		if ( !username )
		{
			this.Output( 'Usage: /Login <username> [password]', 'error' );
			return;
		}

		this.Hive = await Hive.Open( this.Registry, this.Hive.HiveRoot, username, password );
		this.UserName = username;
		await this.ResolveConversation( this.Hive );
		this.Output( 'Logged in as ' + this.UserName + ', conversation: ' + this.ConversationName, 'text' );
	}


	//---------------------------------------------------------------------
	// /Conversation [name]
	async CommandConversation( Hive, ArgsText )
	{
		var name = ArgsText.trim();

		if ( name.length === 0 )
		{
			// List conversations
			var list_result = await Hive.InvokeTool( 'Conversation.ListConversations', {
				Username: Hive.UserName,
				ChannelName: this.ChannelName,
			} );
			if ( list_result.Success )
			{
				this.Output( list_result.Result.Conversations, 'table' );
			}
			else
			{
				this.Output( list_result.Error, 'error' );
			}
			return;
		}

		// Switch to named conversation
		var config_result = await Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: name,
		} );
		if ( !config_result.Success )
		{
			this.Output( 'Conversation not found: ' + name, 'error' );
			return;
		}
		this.ConversationName = name;
		this.Output( 'Switched to conversation: ' + name, 'text' );
	}


	//---------------------------------------------------------------------
	// /NewConversation [name]
	async CommandNewConversation( Hive, ArgsText )
	{
		var name = ArgsText.trim() || null;
		await this.CreateNewConversation( Hive, name );
		this.Output( 'Created conversation: ' + this.ConversationName, 'text' );
	}


	//---------------------------------------------------------------------
	// Context-aware autocomplete suggestions.
	async GetSuggestions( Hive, InputText )
	{
		var text = InputText || '';
		var suggestions = [];

		// State 1: Channel commands (starts with / or empty)
		if ( text.length === 0 || text.startsWith( '/' ) )
		{
			var search = text.toLowerCase();
			for ( var index = 0; index < CHANNEL_COMMANDS.length; index++ )
			{
				if ( CHANNEL_COMMANDS[ index ].toLowerCase().startsWith( search ) )
				{
					suggestions.push( CHANNEL_COMMANDS[ index ] );
				}
			}
			if ( text.startsWith( '/' ) )
			{
				return suggestions;
			}
		}

		// State 2: Typing tool name (no space yet)
		if ( text.indexOf( ' ' ) === -1 )
		{
			var tool_suggestions = Hive.Helpers.CommandProcessor.SuggestTools( Hive, text );
			suggestions = suggestions.concat( tool_suggestions );
			return suggestions;
		}

		// State 3: Tool name complete, typing arguments
		var command_processor = Hive.Helpers.CommandProcessor;
		var parsed = command_processor.Parse( text );
		if ( parsed.PluginName && parsed.ToolName )
		{
			// Look up plugin and tool directly (skip argument validation)
			var plugin = Hive.Plugins[ parsed.PluginName ];
			var tool = plugin && plugin.Tools[ parsed.ToolName ];
			if ( tool && tool.Parameters )
			{
				var properties = tool.Parameters.properties || {};
				var has_entity_param = false;
				for ( var key in properties )
				{
					if ( key.endsWith( 'Name' ) && key !== 'ToolName' && key !== 'PluginName' )
					{
						has_entity_param = true;
						break;
					}
				}

				if ( has_entity_param )
				{
					// Extract partial entity text from the argument portion
					var argument_text = text.substring( text.indexOf( ' ' ) + 1 ).trim();
					var entity_suggestions = await command_processor.SuggestEntities(
						Hive, parsed.PluginName, argument_text
					);
					for ( var index = 0; index < entity_suggestions.length; index++ )
					{
						suggestions.push( parsed.PluginName + '.' + parsed.ToolName + ' ' + entity_suggestions[ index ] );
					}
				}
			}
		}

		return suggestions;
	}


	//---------------------------------------------------------------------
	// Dry run: resolve all state and report.
	async RunTest( Hive )
	{
		var report = {
			Registry: this.Registry.RegistryPath,
			HivePath: Hive.HiveRoot,
			DataPath: Hive.DataPath,
			UserName: Hive.UserName,
			UserRole: Hive.UserRole,
			Authenticated: ( Hive.Token !== '' ),
			ChannelName: this.ChannelName,
			ConversationName: this.ConversationName,
			Plugins: Object.keys( Hive.Plugins ),
			ToolCount: Hive.Helpers.CommandProcessor.SuggestTools( Hive, '' ).length,
		};

		this.Output( report, 'json' );
	}


	//=====================================================================
	// Abstract hooks — override in subclass
	//=====================================================================


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		// Override in subclass
	}


	//---------------------------------------------------------------------
	async Prompt()
	{
		// Override in subclass
		throw new Error( 'Prompt() not implemented by channel.' );
	}


	//---------------------------------------------------------------------
	async PromptChoice( Message, Items )
	{
		// Override in subclass
		throw new Error( 'PromptChoice() not implemented by channel.' );
	}


	//---------------------------------------------------------------------
	async Start()
	{
		// Override in subclass
		throw new Error( 'Start() not implemented by channel.' );
	}


	//---------------------------------------------------------------------
	async Stop()
	{
		// Override in subclass
	}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		// Override in subclass
	}


} // end class Channel


//---------------------------------------------------------------------
module.exports = Channel;
