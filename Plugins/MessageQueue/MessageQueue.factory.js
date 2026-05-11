/*
	MessageQueue.factory.js
---------------------------------------------------------------------
MessageQueue plugin factory - provides persistent message queues per entity.
Each entity gets its own SQLite database at .hive/MessageQueue/<EntityName>/messages.db.
*/

const PATH = require( 'path' );

class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Persistent message queue with pub/sub and invoke-mode subscriptions.';
		Plugin.RequiredRole = 'user';

		// MessageQueue is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a MessageQueue entity.',
			properties: {
				Name: { type: 'string', description: 'MessageQueue entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this message queue.' },
				MaxRetries: { type: 'number', default: 3, description: 'Maximum number of retry attempts for failed messages.' },
				RetryDelayMs: { type: 'number', default: 1000, description: 'Delay in milliseconds between retry attempts.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Open the queue database for a named entity.
		// Creates tables if they don't exist.
		// Returns a SqlStore helper instance. Caller must call .Close() when done.
		Plugin.OpenDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, 'messages.db' );
			var store = new Hive.Helpers.SqlStore();
			store.Open( db_path, { JournalMode: 'wal', ForeignKeys: true } );

			Plugin.EnsureTables( store );
			return store;
		};


		//---------------------------------------------------------------------
		// Create the required tables if they don't exist.
		Plugin.EnsureTables = function ( Store )
		{
			Store.Execute( `CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				topic TEXT NOT NULL,
				payload TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'pending',
				retry_count INTEGER DEFAULT 0,
				created_at TEXT,
				updated_at TEXT
			)` );

			Store.Execute( `CREATE TABLE IF NOT EXISTS subscriptions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				topic_pattern TEXT NOT NULL,
				mode TEXT NOT NULL,
				tool_call TEXT,
				created_at TEXT
			)` );

			Store.Execute( `CREATE TABLE IF NOT EXISTS dead_letters (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				original_message_id INTEGER,
				topic TEXT NOT NULL,
				payload TEXT NOT NULL,
				error TEXT,
				created_at TEXT
			)` );
		};


		//---------------------------------------------------------------------
		// Get entity config (MaxRetries, RetryDelayMs).
		Plugin.GetEntitySettings = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			var config_path = PATH.join( store_folder, EntityName + '.entity.json' );
			var config = {};
			if ( await Hive.Helpers.FileUtils.FileExists( config_path ) )
			{
				config = await Hive.Helpers.FileUtils.ReadJson( config_path );
			}
			return {
				MaxRetries: ( config.MaxRetries !== undefined ) ? config.MaxRetries : 3,
				RetryDelayMs: ( config.RetryDelayMs !== undefined ) ? config.RetryDelayMs : 1000,
			};
		};


		//---------------------------------------------------------------------
		// Find subscriptions matching a topic.
		Plugin.FindMatchingSubscriptions = function ( Hive, Subscriptions, Topic )
		{
			var matches = [];
			for ( var sub of Subscriptions )
			{
				if ( Hive.Helpers.Strings.MatchGlob( Topic, sub.topic_pattern ) )
				{
					matches.push( sub );
				}
			}
			return matches;
		};


		return Plugin;
	}
}

module.exports = Factory;
