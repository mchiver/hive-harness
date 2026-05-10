/*
	Routes/System.js
---------------------------------------------------------------------
System information routes: info, plugins, tools.
*/


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// GET /api/system/info
	App.get( '/api/system/info', async function ( req, res )
	{
		try
		{
			var result = await req.Hive.InvokeTool( 'System.Info', {} );
			if ( result.Success )
			{
				res.json( result.Result );
			}
			else
			{
				res.status( 500 ).json( { Error: result.Error } );
			}
		}
		catch ( error )
		{
			console.error( 'GET /api/system/info error:', error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/system/plugins
	App.get( '/api/system/plugins', async function ( req, res )
	{
		try
		{
			var result = await req.Hive.InvokeTool( 'System.ListPlugins', {} );
			if ( result.Success )
			{
				res.json( result.Result );
			}
			else
			{
				res.status( 500 ).json( { Error: result.Error } );
			}
		}
		catch ( error )
		{
			console.error( 'GET /api/system/plugins error:', error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/system/tools?plugin=PluginName
	App.get( '/api/system/tools', async function ( req, res )
	{
		try
		{
			var args = {};
			if ( req.query.plugin )
			{
				args.PluginName = req.query.plugin;
			}

			var result = await req.Hive.InvokeTool( 'System.ListTools', args );
			if ( result.Success )
			{
				res.json( result.Result );
			}
			else
			{
				res.status( 500 ).json( { Error: result.Error } );
			}
		}
		catch ( error )
		{
			console.error( 'GET /api/system/tools error:', error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


};
