/*
	Routes/Tools.js
---------------------------------------------------------------------
Direct tool invocation route.
*/


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// POST /api/tools/invoke
	// Body: { PluginName, ToolName, Arguments }
	App.post( '/api/tools/invoke', async function ( req, res )
	{
		try
		{
			var plugin_name = req.body.PluginName || '';
			var tool_name = req.body.ToolName || '';
			var arguments_obj = req.body.Arguments || {};

			if ( !plugin_name || !tool_name )
			{
				return res.status( 400 ).json( { Error: 'PluginName and ToolName are required.' } );
			}

			var result = await req.Hive.InvokeTool(
				plugin_name + '.' + tool_name,
				arguments_obj
			);

			res.json( result );
		}
		catch ( error )
		{
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


};
