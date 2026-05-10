# Channel Developer Guide


## Overview

A Channel is a user-facing interface to a Hive.
Channels capture user input and deliver output using a specific modality (console, web, messaging bot, etc.).
All channels share a common base class that handles setup, authentication, conversation management, input routing, and autocomplete.

**Channel implementations focus on I/O.** The base class handles everything else.


## Concepts

**Channel** — A named interface that connects a user to a Hive.
Each channel has a `ChannelName` (e.g. 'cli', 'discord') used to track which conversation belongs to which interface.

**Conversation** — A persistent session between a user and an LLM.
Channels resume or create conversations automatically.
The combination of `Username + ChannelName` identifies a user's session within a Hive.

**Input Routing** — User input is automatically classified and routed:
1. `/Command` — Channel commands (Help, Login, etc.)
2. `Plugin.Tool args` — Direct tool invocation
3. Free text — Forwarded to the LLM via `Conversation.Chat`

**Autocomplete** — The base class provides context-aware suggestions for channel commands, tool names, and entity names.
Each channel decides how to present them (tab-complete, dropdown, etc.).


## Directory Structure

Channels live in `Channels/<ChannelName>/`:

```
Channels/
    Cli/
        Cli.js              # CLI channel (entry point)
    Tui/
        Tui.js              # TUI channel (entry point)
    Web/
        Web.js              # Web channel (entry point)
        public/             # Static web assets
```


## Creating a Channel

### Step 1: Create the Channel File

Each channel is a class that extends the base `Channel` class.
The file must end with the static `Run` call as its boot line:

```js
#!/usr/bin/env node

const Channel = require( '../../Source/Channel.js' );


//---------------------------------------------------------------------
class MyChannel extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'my-channel';
	}


	//---------------------------------------------------------------------
	// Display output to the user.
	// Type is one of: 'text', 'json', 'table', 'error'
	Output( Message, Type )
	{
		// Render the message according to the channel's modality.
	}


	//---------------------------------------------------------------------
	// Read one line of input from the user.
	async Prompt()
	{
		// Return the user's input as a string.
	}


	//---------------------------------------------------------------------
	// Present a list of choices and return the selected item.
	// Used during setup when the user needs to select an LLM entity.
	async PromptChoice( Message, Items )
	{
		// Items is an array of { Name, Description } objects.
		// Return the Name of the selected item.
	}


	//---------------------------------------------------------------------
	// Begin the interactive session loop.
	// Read input, call this.ProcessInput(), repeat.
	async Start()
	{
		// Set up the I/O loop for this channel's modality.
	}


	//---------------------------------------------------------------------
	// Clean up and exit.
	async Stop()
	{
		// Release resources (close connections, etc.).
	}


	//---------------------------------------------------------------------
	// Display help text for this channel.
	ShowHelp()
	{
		// Output usage information.
	}


}


//---------------------------------------------------------------------
Channel.Run( MyChannel );
```


### Step 2: Override the Abstract Hooks

These are the methods your channel must implement:

| Method | When Called | What To Do |
|---|---|---|
| `Output( Message, Type )` | Whenever results need to be shown | Render based on Type and your modality |
| `async Prompt()` | When the system needs user input | Return one line of text |
| `async PromptChoice( Message, Items )` | During setup (e.g. LLM selection) | Show choices, return selected Name |
| `async Start()` | Entering interactive mode | Set up the input loop |
| `async Stop()` | Shutting down | Release resources, exit |
| `ShowHelp()` | User requests help | Display usage text |

**Output Types:**

| Type | Content | Guidance |
|---|---|---|
| `'text'` | Plain text string | Display directly |
| `'json'` | Object or array | Pretty-print or format for the modality |
| `'table'` | Array of objects | Render as a table if possible, else JSON |
| `'error'` | Error string | Highlight as an error (color, icon, etc.) |


### Step 3: Wire Up Autocomplete (Optional)

The base class provides `GetSuggestions( InputText )` which returns an array of suggestion strings.
Call it from your channel's input handler to provide autocomplete:

```js
// Example: wiring suggestions into readline tab-completion
var interface = READLINE.createInterface( {
    input: process.stdin,
    output: process.stdout,
    completer: function ( line, callback )
    {
        channel.GetSuggestions( line ).then( function ( suggestions )
        {
            callback( null, [ suggestions, line ] );
        } );
    },
} );
```

`GetSuggestions` is async because entity name lookups require disk access.

**What gets suggested:**

| User Is Typing | Suggestions Returned |
|---|---|
| `/` or `/He` | Channel commands matching the prefix |
| `System.Li` | Tool names containing the partial text |
| `KeyStore.GetKey ` (after tool name) | Entity names for the tool's plugin |


## Base Class Lifecycle

When `Channel.Run( MyChannel )` is called, the base class orchestrates:

```
1. Parse CLI arguments (via minimist)
2. Set IsInteractive (based on TTY and presence of positional args)
3. --help? → ShowHelp() and exit
4. Initialize()
    → Open Registry (--registry or ~/.hives)
    → Resolve username (--username or OS username)
    → Open Hive (--path or cwd, with --password if provided)
5. ResolveConversation()
    → Use --conversation, or GetLastConversation, or create new
6. --test? → RunTest() and exit (dry run report)
7. Positional args? → ProcessInput() and Stop() (one-shot mode)
8. No args? → Start() (interactive mode)
```

Your channel does not need to manage any of this.
Just implement the hooks and the base class handles the rest.


## Input Processing

The base class `ProcessInput( InputText )` method handles routing:

1. **Channel commands** — Input starting with `/` is dispatched to built-in command handlers.
2. **Tool calls** — If the first token exactly matches a loaded `Plugin.Tool`, the text is parsed and the tool is invoked via CommandProcessor.
3. **Chat** — Everything else is sent to `Conversation.Chat` for the LLM to handle.

Your channel calls `this.ProcessInput( text )` from its input loop.
The base class routes the input and calls `this.Output()` with the result.


## Built-in Channel Commands

These are handled by the base class. All channels get them for free:

| Command | Description |
|---|---|
| `/Help` | Calls `this.ShowHelp()` |
| `/Login <username> [password]` | Reopens the Hive with new credentials, re-resolves conversation |
| `/Conversation [name]` | Switch to a named conversation, or list conversations if no name given |
| `/NewConversation [name]` | Create a new conversation (auto-names via moniker if no name given) |


## CLI Arguments

The base class parses these from `process.argv` via minimist.
All channels inherit them automatically:

| Flag | Description | Default |
|---|---|---|
| `--registry <path>` | Path to the Registry | `~/.hives` |
| `--path <path>` | Path to the Hive workspace | Current directory |
| `--username <name>` | Username | OS login name |
| `--password <pass>` | Authentication password | None (guest mode) |
| `--conversation <name>` | Resume a specific conversation | Most recent, or create new |
| `--llm <name>` | Override the ChatLlm for new conversations | Plugin default |
| `--test` | Dry run: resolve everything, report, exit | — |
| `--help` | Display help and exit | — |

Positional arguments (anything after flags) are joined as input text for one-shot execution.


## Conversation Management

The base class manages conversations automatically:

1. On startup, it finds the user's most recent conversation for this channel.
2. If none exists, it creates a new one with a generated name (verb-adjective-noun).
3. New conversations need a ChatLlm. The resolution order is:
   - `--llm` CLI flag
   - `DefaultChatLlm` from the Conversation plugin config (`.hive/Conversation/Conversation.plugin.json`)
   - Interactive prompt (if the channel supports it)

The active conversation is stored in `this.ConversationName`.
Channel commands can switch it at runtime.


## One-Shot Mode

When positional arguments are provided on the command line, the channel runs in one-shot mode:

```bash
# Tool call
node Channels/Cli/Cli.js System.Info

# Chat message
node Channels/Cli/Cli.js "Why is the sky blue?"
```

The input is processed through the same routing pipeline as interactive mode.
After output, the channel shuts down.


## Dry Run Mode

The `--test` flag runs all initialization (auth, conversation resolution) but skips execution.
A JSON report is printed showing all resolved state:

```json
{
    "Registry": "/home/user/.hives",
    "HivePath": "/home/user/myproject",
    "DataPath": "/home/user/myproject/.hive",
    "UserName": "alice",
    "UserRole": "user",
    "Authenticated": true,
    "ChannelName": "cli",
    "ConversationName": "running-bold-falcon",
    "Plugins": [ "System", "Conversation", "Llm", "Topic" ],
    "ToolCount": 42
}
```


## Minimal Example: Echo Channel

A channel that echoes input back to the user (for testing):

```js
#!/usr/bin/env node

const Channel = require( '../../Source/Channel.js' );
const READLINE = require( 'readline' );


//---------------------------------------------------------------------
class EchoChannel extends Channel
{


	//---------------------------------------------------------------------
	constructor()
	{
		super();
		this.ChannelName = 'echo';
		this.Interface = null;
	}


	//---------------------------------------------------------------------
	Output( Message, Type )
	{
		if ( Type === 'error' )
		{
			console.error( '[ERROR]', Message );
		}
		else
		{
			console.log( Message );
		}
	}


	//---------------------------------------------------------------------
	async Prompt()
	{
		return new Promise( function ( resolve )
		{
			process.stdout.write( '> ' );
			process.stdin.once( 'data', function ( data )
			{
				resolve( data.toString().trim() );
			} );
		} );
	}


	//---------------------------------------------------------------------
	async PromptChoice( Message, Items )
	{
		this.Output( Message, 'text' );
		for ( var index = 0; index < Items.length; index++ )
		{
			this.Output( ( index + 1 ) + '. ' + ( Items[ index ].Name || Items[ index ] ), 'text' );
		}
		var answer = await this.Prompt();
		var selection = parseInt( answer, 10 ) - 1;
		return Items[ selection ].Name || Items[ selection ];
	}


	//---------------------------------------------------------------------
	async Start()
	{
		this.Output( 'Echo Channel — Conversation: ' + this.ConversationName, 'text' );
		while ( true )
		{
			var input = await this.Prompt();
			if ( !input ) { continue; }
			await this.ProcessInput( input );
		}
	}


	//---------------------------------------------------------------------
	async Stop()
	{
		process.exit( 0 );
	}


	//---------------------------------------------------------------------
	ShowHelp()
	{
		this.Output( 'Echo Channel: echoes all input. Type /Help for commands.', 'text' );
	}


}


//---------------------------------------------------------------------
Channel.Run( EchoChannel );
```


## Key APIs Available in Channels

### From the Base Class

| Property / Method | Description |
|---|---|
| `this.Hive` | The active Hive instance |
| `this.Registry` | The Registry instance |
| `this.UserName` | Current username |
| `this.ConversationName` | Active conversation entity name |
| `this.IsInteractive` | Whether this is an interactive session |
| `this.Options` | Parsed CLI arguments |
| `this.ProcessInput( text )` | Route and execute input |
| `this.GetSuggestions( text )` | Get context-aware autocomplete suggestions |
| `this.HandleCommand( text )` | Execute a channel command |
| `this.CreateNewConversation( name )` | Create a new conversation |

### From the Hive

| Path | Description |
|---|---|
| `this.Hive.InvokeTool( name, args )` | Execute any plugin tool |
| `this.Hive.Helpers.CommandProcessor` | Parse, validate, suggest tools/entities |
| `this.Hive.Helpers.FileUtils` | File and folder operations |
| `this.Hive.Helpers.Logger` | Logging utility |
| `this.Hive.Events` | EventBus for tool lifecycle events |
