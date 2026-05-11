/*
	KeyStore.factory.js
---------------------------------------------------------------------
KeyStore plugin factory - provides key-value storage.
*/

const PATH = require( 'path' );

class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Key-value storage for persistent data.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [];

		// KeyStore is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a KeyStore entity.',
			properties: {
				Name: { type: 'string', description: 'KeyStore entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this key-value store.' },
			},
			required: [ 'Name' ],
		};


		//---------------------------------------------------------------------
		// Load the key-value data for a named store
		Plugin.LoadStore = async function ( Hive, EntityName )
		{
			// var store_path = PATH.join( Hive.DataPath, 'KeyStore', EntityName, EntityName + '.data.json' );
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			var store_path = PATH.join( store_folder, EntityName + '.data.json' );
			if ( !await Hive.Helpers.FileUtils.FileExists( store_path ) ) { throw new Error( `${this.PluginName} entity named [${EntityName}] does not exist.` ); }
			return await Hive.Helpers.FileUtils.ReadJson( store_path );
		};


		//---------------------------------------------------------------------
		// Save the key-value data for a named store
		Plugin.SaveStore = async function ( Hive, EntityName, StoreData )
		{
			// var store_folder = PATH.join( Hive.DataPath, 'KeyStore', EntityName );
			var store_folder = await Hive.GetEntityDataPath( this.PluginName, EntityName );
			await Hive.Helpers.FileUtils.EnsureFolder( store_folder );

			var store_path = PATH.join( store_folder, EntityName + '.data.json' );
			await Hive.Helpers.FileUtils.WriteJson( store_path, StoreData );

			return true;
		};


		return Plugin;
	}
}

module.exports = Factory;
