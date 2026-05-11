/*
	Conversation.factory.js
---------------------------------------------------------------------
Conversation plugin factory - ties together a user, topics, and an
LLM model into a prompt-response pipeline with chat history, context
retrieval, and tool calling.
*/

const PATH = require( 'path' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'AI conversation pipeline with topics, history, and tool calling.';
		Plugin.RequiredRole = 'user';

		// Plugin-level configuration (loaded from .hive/Conversation/Conversation.plugin.json)
		Plugin.ConfigSchema = {
			type: 'object',
			properties: {
				DefaultChatLlm: { type: 'string', default: '' },
			},
			required: [],
		};

		// Conversation is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a Conversation entity.',
			properties: {
				Name: { type: 'string', description: 'Conversation entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this conversation.' },
				Username: { type: 'string', default: '', description: 'Username associated with this conversation.' },
				ChannelName: { type: 'string', default: '', description: 'Channel this conversation belongs to.' },
				Topics: { type: 'array', default: [], description: 'Array of Topic entity names to include as context.' },
				Skills: { type: 'array', default: [], description: 'Array of skill names to inject into the prompt. Use PluginName.SkillName for plugin skills or Skill.EntityName for user-defined skills.' },
				ChatLlm: { type: 'string', default: '', description: 'Name of the Llm entity to use for chat completions.' },
				UsedAt: { type: 'string', default: '', description: 'ISO 8601 timestamp of last activity.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// History table schemas.
		Plugin.MESSAGES_TABLE = 'Messages';
		Plugin.TOOLS_TABLE = 'Tools';

		Plugin.MESSAGES_SCHEMA = `
			MessageID INTEGER PRIMARY KEY AUTOINCREMENT,
			Timestamp TEXT NOT NULL,
			Username TEXT NOT NULL DEFAULT '',
			LlmName TEXT NOT NULL DEFAULT '',
			Context TEXT NOT NULL DEFAULT '',
			Text TEXT NOT NULL
		`;

		Plugin.TOOLS_SCHEMA = `
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			MessageID INTEGER NOT NULL,
			Timestamp TEXT NOT NULL,
			ConversationName TEXT NOT NULL DEFAULT '',
			ToolName TEXT NOT NULL,
			Status TEXT NOT NULL DEFAULT 'ok',
			Arguments TEXT NOT NULL DEFAULT '{}',
			Results TEXT NOT NULL DEFAULT '{}',
			FOREIGN KEY (MessageID) REFERENCES Messages(MessageID)
		`;


		//---------------------------------------------------------------------
		// Open a history database connection for a named entity.
		// Ensures the Messages and Tools tables exist.
		// Returns a SqlStore helper instance. Caller must call .Close() when done.
		Plugin.OpenHistoryDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, 'history.db' );

			var store = new Hive.Helpers.SqlStore();
			store.Open( db_path, { JournalMode: 'wal', BusyTimeout: 5000 } );

			var tables = store.ListTables();
			if ( !tables.includes( Plugin.MESSAGES_TABLE ) )
			{
				store.Execute(
					`CREATE TABLE "${Plugin.MESSAGES_TABLE}" ( ${Plugin.MESSAGES_SCHEMA} )`
				);
			}
			if ( !tables.includes( Plugin.TOOLS_TABLE ) )
			{
				store.Execute(
					`CREATE TABLE "${Plugin.TOOLS_TABLE}" ( ${Plugin.TOOLS_SCHEMA} )`
				);
			}

			return store;
		};


		//---------------------------------------------------------------------
		// Load entity config from disk.
		Plugin.GetEntityConfig = async function ( Hive, EntityName )
		{
			return await Hive.GetEntityConfig( this.PluginName, EntityName );
		};


		//---------------------------------------------------------------------
		// Update the UsedAt timestamp on an entity.
		Plugin.TouchUsedAt = async function ( Hive, EntityName )
		{
			var entity_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			var config_path = PATH.join( entity_folder, EntityName + '.entity.json' );
			var config = await Hive.Helpers.FileUtils.ReadJson( config_path );
			config.UsedAt = new Date().toISOString();
			await Hive.Helpers.FileUtils.WriteJson( config_path, config );
		};


		//---------------------------------------------------------------------
		// Append a message to history.
		// Returns { MessageID } for the inserted row.
		Plugin.AppendMessage = async function ( Hive, EntityName, Username, LlmName, Context, Text )
		{
			var store = await Plugin.OpenHistoryDatabase( Hive, EntityName );
			try
			{
				var now = new Date().toISOString();
				var result = store.Execute(
					`INSERT INTO "${Plugin.MESSAGES_TABLE}" ( Timestamp, Username, LlmName, Context, Text ) VALUES ( ?, ?, ?, ?, ? )`,
					[ now, Username || '', LlmName || '', Context || '', Text ]
				);
				return { MessageID: result.LastInsertId };
			}
			finally
			{
				store.Close();
			}
		};


		//---------------------------------------------------------------------
		// Append a tool call record to history.
		Plugin.AppendToolCall = async function ( Hive, EntityName, MessageID, ConversationName, ToolName, Status, Arguments, Results )
		{
			var store = await Plugin.OpenHistoryDatabase( Hive, EntityName );
			try
			{
				var now = new Date().toISOString();
				var args_json = ( typeof Arguments === 'string' ) ? Arguments : JSON.stringify( Arguments || {} );
				var results_json = ( typeof Results === 'string' ) ? Results : JSON.stringify( Results || {} );
				store.Execute(
					`INSERT INTO "${Plugin.TOOLS_TABLE}" ( MessageID, Timestamp, ConversationName, ToolName, Status, Arguments, Results ) VALUES ( ?, ?, ?, ?, ?, ?, ? )`,
					[ MessageID, now, ConversationName || '', ToolName, Status || 'ok', args_json, results_json ]
				);
			}
			finally
			{
				store.Close();
			}
		};


		//---------------------------------------------------------------------
		// Retrieve recent messages with their tool calls (newest last).
		// Returns array of { MessageID, Timestamp, Username, LlmName, Context, Text, Tools: [...] }
		Plugin.GetRecentMessages = async function ( Hive, EntityName, MaxItems, MaxItemSize )
		{
			var store = await Plugin.OpenHistoryDatabase( Hive, EntityName );
			try
			{
				// Get recent messages
				var limit_clause = '';
				var values = null;
				if ( MaxItems && MaxItems > 0 )
				{
					limit_clause = ' LIMIT ?';
					values = [ MaxItems ];
				}

				var messages_sql = `SELECT * FROM ( `
					+ `SELECT * FROM "${Plugin.MESSAGES_TABLE}" ORDER BY MessageID DESC${limit_clause}`
					+ ` ) ORDER BY MessageID ASC`;

				var messages = store.Query( messages_sql, values );

				if ( messages.length === 0 ) { return messages; }

				// Get tool calls for these messages
				var message_ids = messages.map( function ( m ) { return m.MessageID; } );
				var placeholders = message_ids.map( function () { return '?'; } ).join( ', ' );
				var tools_sql = `SELECT * FROM "${Plugin.TOOLS_TABLE}" WHERE MessageID IN ( ${placeholders} ) ORDER BY id ASC`;
				var tool_rows = store.Query( tools_sql, message_ids );

				// Group tool calls by MessageID
				var tools_by_message = {};
				for ( var t = 0; t < tool_rows.length; t++ )
				{
					var tool_row = tool_rows[ t ];
					if ( !tools_by_message[ tool_row.MessageID ] )
					{
						tools_by_message[ tool_row.MessageID ] = [];
					}
					tools_by_message[ tool_row.MessageID ].push( {
						Timestamp: tool_row.Timestamp,
						ConversationName: tool_row.ConversationName,
						ToolName: tool_row.ToolName,
						Status: tool_row.Status,
						Arguments: tool_row.Arguments,
						Results: tool_row.Results,
					} );
				}

				// Attach tool calls to messages
				for ( var m = 0; m < messages.length; m++ )
				{
					messages[ m ].Tools = tools_by_message[ messages[ m ].MessageID ] || [];

					// Truncate user message text if MaxItemSize is specified
					if ( MaxItemSize && MaxItemSize > 0 && messages[ m ].Text )
					{
						if ( messages[ m ].Text.length > MaxItemSize )
						{
							messages[ m ].Text = messages[ m ].Text.substring( 0, MaxItemSize ) + '...(truncated)';
						}
					}
				}

				return messages;
			}
			finally
			{
				store.Close();
			}
		};


		//---------------------------------------------------------------------
		// Resolve an array of skill names into an array of { Name, Text } objects.
		// Supports two forms:
		//   - "PluginName.SkillName" — looks up a dynamic skill function on the plugin.
		//   - "Skill.EntityName"     — loads a Skill entity and returns its Text.
		// Returns an array of { Name, Text } in the same order as SkillNames.
		// Unresolvable skills are included with an error message as Text.
		Plugin.ResolveSkills = async function ( Hive, SkillNames )
		{
			var results = [];
			for ( var index = 0; index < SkillNames.length; index++ )
			{
				var skill_name = SkillNames[ index ];
				var parts = skill_name.split( '.' );
				if ( parts.length !== 2 )
				{
					results.push( { Name: skill_name, Text: '[Error: Invalid skill name format. Expected PluginName.SkillName]' } );
					continue;
				}

				var plugin_name = parts[ 0 ];
				var local_name = parts[ 1 ];

				// Look up the plugin
				var plugin = Hive.Plugins[ plugin_name ];
				if ( !plugin )
				{
					results.push( { Name: skill_name, Text: '[Error: Plugin not found: ' + plugin_name + ']' } );
					continue;
				}

				// Check for a dynamic skill on the plugin
				if ( plugin.Skills && typeof plugin.Skills[ local_name ] === 'function' )
				{
					var text = plugin.Skills[ local_name ]( Hive );
					results.push( { Name: skill_name, Text: text } );
					continue;
				}

				// Check for an entity-based skill (only on the Skill plugin)
				if ( plugin_name === 'Skill' && plugin.EntitySchema )
				{
					try
					{
						var entity_folder = await Hive.GetEntityDataPath( plugin_name, local_name );
						var config_path = PATH.join( entity_folder, local_name + '.entity.json' );
						var config = await Hive.Helpers.FileUtils.ReadJson( config_path );
						results.push( { Name: skill_name, Text: config.Text || '' } );
					}
					catch ( error )
					{
						results.push( { Name: skill_name, Text: '[Error: Skill entity not found: ' + local_name + ']' } );
					}
					continue;
				}

				results.push( { Name: skill_name, Text: '[Error: Skill not found: ' + skill_name + ']' } );
			}
			return results;
		};


		//---------------------------------------------------------------------
		// Build the prompt XML for a Chat call.
		// ResolvedSkills is an array of { Name, Text } from ResolveSkills().
		Plugin.BuildPrompt = function ( ConversationName, HistoryRows, ContextResults, ResolvedSkills, TaskText )
		{
			var parts = [];

			// Conversation header
			parts.push( '<conversation>' );
			parts.push( `    <name>${ConversationName}</name>` );
			parts.push( '</conversation>' );
			parts.push( '' );

			// Skills sections
			if ( ResolvedSkills && ResolvedSkills.length > 0 )
			{
				for ( var index = 0; index < ResolvedSkills.length; index++ )
				{
					var skill = ResolvedSkills[ index ];
					parts.push( `<skill name="${skill.Name}">` );
					parts.push( skill.Text );
					parts.push( '</skill>' );
					parts.push( '' );
				}
			}

			// Context section
			if ( ContextResults && ContextResults.length > 0 )
			{
				parts.push( '<context>' );
				for ( var index = 0; index < ContextResults.length; index++ )
				{
					var item = ContextResults[ index ];
					parts.push( `[score:${item.Score}] ${item.Text}` );
				}
				parts.push( '</context>' );
				parts.push( '' );
			}

			// History section
			if ( HistoryRows && HistoryRows.length > 0 )
			{
				parts.push( '<history>' );
				for ( var index = 0; index < HistoryRows.length; index++ )
				{
					var row = HistoryRows[ index ];
					var source = row.Username ? 'user' : 'llm';
					parts.push( `[${source}] ${row.Text}` );
				}
				parts.push( '</history>' );
				parts.push( '' );
			}

			// Task section
			parts.push( '<task>' );
			parts.push( TaskText );
			parts.push( '</task>' );

			return parts.join( '\n' );
		};


		//---------------------------------------------------------------------
		// Search all topics configured on this conversation.
		// Returns a flat array of { TopicName, SourceName, Text, Score }.
		Plugin.SearchTopics = async function ( Hive, Config, Text, MinScore, MaxResults )
		{
			var all_results = [];

			for ( var index = 0; index < Config.Topics.length; index++ )
			{
				var topic_name = Config.Topics[ index ];
				var search_result = await Hive.InvokeTool( 'Topic.Search', {
					TopicName: topic_name,
					Text: Text,
					MinScore: MinScore || 0.3,
					MaxResults: 0,
				} );

				if ( search_result.Success && search_result.Result && search_result.Result.Results )
				{
					for ( var r = 0; r < search_result.Result.Results.length; r++ )
					{
						var item = search_result.Result.Results[ r ];
						all_results.push( {
							TopicName: topic_name,
							SourceName: item.SourceName,
							Text: item.ChunkText,
							Score: item.Score,
						} );
					}
				}
			}

			// Sort by score descending
			all_results.sort( function ( a, b ) { return b.Score - a.Score; } );

			// Apply max results
			if ( MaxResults && MaxResults > 0 )
			{
				all_results = all_results.slice( 0, MaxResults );
			}

			return all_results;
		};


		return Plugin;
	}
}

module.exports = Factory;
