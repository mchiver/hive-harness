/*
	SqlStore.factory.js
---------------------------------------------------------------------
SqlStore plugin factory - provides SQLite database storage per entity.
*/

const PATH = require( 'path' );

class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'SQLite database storage per entity.';
		Plugin.RequiredRole = 'user';

		// SqlStore is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a SqlStore entity.',
			properties: {
				Name: { type: 'string', description: 'SqlStore entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this database store.' },
				JournalMode: { type: 'string', default: 'wal', description: 'SQLite journal mode: "wal", "delete", "truncate", "persist", "memory", or "off".' },
				ForeignKeys: { type: 'boolean', default: true, description: 'Whether to enforce foreign key constraints.' },
				CacheSize: { type: 'number', default: -2000, description: 'SQLite cache size. Negative values are in KiB, positive values are in pages.' },
				BusyTimeout: { type: 'number', default: 5000, description: 'Milliseconds to wait when the database is locked before returning a busy error.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Open a database connection for a named entity.
		// Returns a SqlStore helper instance. Caller must call .Close() when done.
		Plugin.OpenDatabase = async function ( Hive, EntityName )
		{
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var db_path = PATH.join( store_folder, EntityName + '.db' );

			// Read entity config to get pragma options
			var config_path = PATH.join( store_folder, EntityName + '.entity.json' );
			var entity_config = {};
			if ( await Hive.Helpers.FileUtils.FileExists( config_path ) )
			{
				entity_config = await Hive.Helpers.FileUtils.ReadJson( config_path );
			}
			var options = {
				JournalMode: ( entity_config && entity_config.JournalMode ) || 'wal',
				ForeignKeys: ( entity_config && entity_config.ForeignKeys !== undefined ) ? entity_config.ForeignKeys : true,
				CacheSize: ( entity_config && entity_config.CacheSize ) || -2000,
				BusyTimeout: ( entity_config && entity_config.BusyTimeout ) || 5000,
			};

			var store = new Hive.Helpers.SqlStore();
			store.Open( db_path, options );
			return store;
		};


		return Plugin;
	}
}

module.exports = Factory;
