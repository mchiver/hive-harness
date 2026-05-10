/*
	Routes/Chat.js
---------------------------------------------------------------------
Chat routes: send message, SSE event stream, history retrieval.
*/

const Logger = require( '../../../Helpers/Logger' );
var LOG = Logger.CreateLogger();


//---------------------------------------------------------------------
var SSE_COUNTER = 0;


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// POST /api/chat
	// Body: { ConversationName, Text }
	// Returns: { MessageID, Response, ToolCalls }
	App.post( '/api/chat', async function ( req, res )
	{
		try
		{
			var conversation_name = req.body.ConversationName || '';
			var text = req.body.Text || '';

			if ( !conversation_name || !text )
			{
				return res.status( 400 ).json( { Error: 'ConversationName and Text are required.' } );
			}

			LOG.Info( 'Chat [' + conversation_name + '] user=' + req.User.Username + ': ' + text.substring( 0, 100 ) );

			var result = await req.Hive.InvokeTool( 'Conversation.Chat', {
				EntityName: conversation_name,
				Text: text,
			} );

			if ( result.Success )
			{
				LOG.Info( 'Chat [' + conversation_name + '] response: ' + ( result.Result.Response || '' ).substring( 0, 100 ) );
				res.json( result.Result );
			}
			else
			{
				LOG.Error( 'Chat [' + conversation_name + '] tool error: ' + result.Error );
				res.status( 500 ).json( { Error: result.Error } );
			}
		}
		catch ( error )
		{
			LOG.Error( 'Chat POST error: ' + error.message );
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/chat/stream?conversation=ConversationName
	// SSE endpoint — streams conversation events in real time.
	App.get( '/api/chat/stream', async function ( req, res )
	{
		var conversation_name = req.query.conversation || '';
		if ( !conversation_name )
		{
			return res.status( 400 ).json( { Error: 'conversation query parameter is required.' } );
		}

		// Set SSE headers
		res.setHeader( 'Content-Type', 'text/event-stream' );
		res.setHeader( 'Cache-Control', 'no-cache' );
		res.setHeader( 'Connection', 'keep-alive' );
		res.flushHeaders();

		// Generate connection ID
		SSE_COUNTER++;
		var connection_id = 'sse-' + SSE_COUNTER;

		LOG.Info( 'SSE [' + connection_id + '] connected: ' + conversation_name + ' (user=' + req.User.Username + ')' );

		// Subscribe to conversation events
		var subscription_id = await req.Hive.Events.Subscribe( 'conversation.**', function ( data )
		{
			// Filter to the requested conversation
			if ( data && data.ConversationName === conversation_name )
			{
				LOG.Debug( 'SSE [' + connection_id + '] event: ' + JSON.stringify( data ).substring( 0, 200 ) );
				res.write( 'data: ' + JSON.stringify( data ) + '\n\n' );
			}
		} );

		// Track connection
		Channel.SseClients.set( connection_id, {
			Response: res,
			Username: req.User.Username,
			ConversationName: conversation_name,
			SubscriptionId: subscription_id,
		} );

		// Send initial connected event
		res.write( 'data: ' + JSON.stringify( { Type: 'connected', ConversationName: conversation_name } ) + '\n\n' );

		// Clean up on disconnect
		req.on( 'close', function ()
		{
			LOG.Info( 'SSE [' + connection_id + '] disconnected: ' + conversation_name );
			req.Hive.Events.Unsubscribe( subscription_id );
			Channel.SseClients.delete( connection_id );
		} );
	} );


	//---------------------------------------------------------------------
	// GET /api/chat/history?conversation=ConversationName&limit=N
	App.get( '/api/chat/history', async function ( req, res )
	{
		var conversation_name = req.query.conversation || '';
		if ( !conversation_name )
		{
			return res.status( 400 ).json( { Error: 'conversation query parameter is required.' } );
		}

		var max_items = parseInt( req.query.limit, 10 ) || 0;

		var result = await req.Hive.InvokeTool( 'Conversation.GetHistory', {
			EntityName: conversation_name,
			MaxItems: max_items,
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


};
