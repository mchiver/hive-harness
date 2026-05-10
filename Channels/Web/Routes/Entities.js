/*
	Routes/Entities.js
---------------------------------------------------------------------
Generic entity CRUD routes driven by plugin EntitySchema.
*/


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// Validate that the plugin exists and has EntitySchema.
	function validate_plugin( req, res )
	{
		var plugin_name = req.params.plugin;
		var plugin = req.Hive.Plugins[ plugin_name ];
		if ( !plugin )
		{
			res.status( 404 ).json( { Error: 'Plugin not found: ' + plugin_name } );
			return null;
		}
		if ( !plugin.EntitySchema )
		{
			res.status( 400 ).json( { Error: 'Plugin does not support entities: ' + plugin_name } );
			return null;
		}
		return plugin_name;
	}


	//---------------------------------------------------------------------
	// GET /api/plugins/:plugin/schema
	// Returns the EntitySchema for the plugin.
	App.get( '/api/plugins/:plugin/schema', function ( req, res )
	{
		var plugin_name = validate_plugin( req, res );
		if ( !plugin_name ) { return; }

		var plugin = req.Hive.Plugins[ plugin_name ];
		res.json( plugin.EntitySchema );
	} );


	//---------------------------------------------------------------------
	// GET /api/plugins/:plugin/config-schema
	// Returns the ConfigSchema for the plugin (plugin-level settings).
	App.get( '/api/plugins/:plugin/config-schema', function ( req, res )
	{
		var plugin_name = req.params.plugin;
		var plugin = req.Hive.Plugins[ plugin_name ];
		if ( !plugin )
		{
			return res.status( 404 ).json( { Error: 'Plugin not found: ' + plugin_name } );
		}
		res.json( plugin.ConfigSchema || null );
	} );


	//---------------------------------------------------------------------
	// GET /api/plugins/:plugin/config
	// Returns the current plugin config values.
	App.get( '/api/plugins/:plugin/config', async function ( req, res )
	{
		try
		{
			var plugin_name = req.params.plugin;
			var plugin = req.Hive.Plugins[ plugin_name ];
			if ( !plugin )
			{
				return res.status( 404 ).json( { Error: 'Plugin not found: ' + plugin_name } );
			}

			var PATH = require( 'path' );
			var FileUtils = require( '../../../Helpers/FileUtils.js' );
			var plugin_folder = PATH.join( req.Hive.DataPath, plugin_name );
			var config_filename = PATH.join( plugin_folder, plugin_name + '.plugin.json' );

			if ( await FileUtils.FileExists( config_filename ) )
			{
				var config = await FileUtils.ReadJson( config_filename );
				res.json( { Settings: config } );
			}
			else
			{
				res.json( { Settings: {} } );
			}
		}
		catch ( error )
		{
			console.error( 'GET /api/plugins/' + req.params.plugin + '/config error:', error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// PUT /api/plugins/:plugin/config
	// Updates the plugin config.
	App.put( '/api/plugins/:plugin/config', async function ( req, res )
	{
		try
		{
			var plugin_name = req.params.plugin;
			var plugin = req.Hive.Plugins[ plugin_name ];
			if ( !plugin )
			{
				return res.status( 404 ).json( { Error: 'Plugin not found: ' + plugin_name } );
			}

			var PATH = require( 'path' );
			var FileUtils = require( '../../../Helpers/FileUtils.js' );
			var plugin_folder = PATH.join( req.Hive.DataPath, plugin_name );
			var config_filename = PATH.join( plugin_folder, plugin_name + '.plugin.json' );

			await FileUtils.EnsureFolder( plugin_folder );
			await FileUtils.WriteJson( config_filename, req.body );

			// Merge new config into the live plugin object
			Object.assign( plugin, req.body );

			res.json( { Success: true } );
		}
		catch ( error )
		{
			console.error( 'PUT /api/plugins/' + req.params.plugin + '/config error:', error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/plugins/:plugin/entities
	App.get( '/api/plugins/:plugin/entities', async function ( req, res )
	{
		var plugin_name = validate_plugin( req, res );
		if ( !plugin_name ) { return; }

		var result = await req.Hive.InvokeTool( plugin_name + '.ListEntities', {} );
		if ( result.Success )
		{
			res.json( result.Result );
		}
		else
		{
			res.status( 500 ).json( { Error: result.Error } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/plugins/:plugin/entities/:name
	App.get( '/api/plugins/:plugin/entities/:name', async function ( req, res )
	{
		var plugin_name = validate_plugin( req, res );
		if ( !plugin_name ) { return; }

		var result = await req.Hive.InvokeTool( plugin_name + '.ConfigEntity', {
			EntityName: req.params.name,
		} );
		if ( result.Success )
		{
			res.json( result.Result );
		}
		else
		{
			res.status( 500 ).json( { Error: result.Error } );
		}
	} );


	//---------------------------------------------------------------------
	// PUT /api/plugins/:plugin/entities/:name
	App.put( '/api/plugins/:plugin/entities/:name', async function ( req, res )
	{
		var plugin_name = validate_plugin( req, res );
		if ( !plugin_name ) { return; }

		var result = await req.Hive.InvokeTool( plugin_name + '.ConfigEntity', {
			EntityName: req.params.name,
			Settings: req.body,
		} );
		if ( result.Success )
		{
			res.json( result.Result );
		}
		else
		{
			res.status( 500 ).json( { Error: result.Error } );
		}
	} );


	//---------------------------------------------------------------------
	// DELETE /api/plugins/:plugin/entities/:name
	App.delete( '/api/plugins/:plugin/entities/:name', async function ( req, res )
	{
		var plugin_name = validate_plugin( req, res );
		if ( !plugin_name ) { return; }

		var result = await req.Hive.InvokeTool( plugin_name + '.DeleteEntity', {
			EntityName: req.params.name,
		} );
		if ( result.Success )
		{
			res.json( { Success: true } );
		}
		else
		{
			res.status( 500 ).json( { Error: result.Error } );
		}
	} );


};
