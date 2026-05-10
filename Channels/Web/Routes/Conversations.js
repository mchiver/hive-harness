/*
	Routes/Conversations.js
---------------------------------------------------------------------
Conversation management routes: list, create, get.
*/

const MONIKER = require( 'moniker' );

var NAME_GENERATOR = MONIKER.generator( [ MONIKER.verb, MONIKER.adjective, MONIKER.noun ] );


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// GET /api/conversations
	// Lists conversations for the authenticated user on the web channel.
	App.get( '/api/conversations', async function ( req, res )
	{
		var result = await req.Hive.InvokeTool( 'Conversation.ListConversations', {
			Username: req.User.Username,
			ChannelName: 'web',
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
	// POST /api/conversations
	// Body: { Name?, ChatLlm? }
	// Creates a new conversation for the authenticated user.
	App.post( '/api/conversations', async function ( req, res )
	{
		try
		{
			var name = req.body.Name || NAME_GENERATOR.choose();
			var chat_llm = req.body.ChatLlm || '';

			// If no ChatLlm specified, try plugin default
			if ( !chat_llm )
			{
				var plugin = req.Hive.Plugins.Conversation;
				if ( plugin && plugin.DefaultChatLlm )
				{
					chat_llm = plugin.DefaultChatLlm;
				}
			}

			var result = await req.Hive.InvokeTool( 'Conversation.ConfigEntity', {
				EntityName: name,
				Settings: {
					Username: req.User.Username,
					ChannelName: 'web',
					ChatLlm: chat_llm,
				},
			} );

			if ( result.Success )
			{
				res.json( { ConversationName: name, Config: result.Result } );
			}
			else
			{
				res.status( 500 ).json( { Error: result.Error } );
			}
		}
		catch ( error )
		{
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/conversations/:name
	App.get( '/api/conversations/:name', async function ( req, res )
	{
		try
		{
			var plugin = req.Hive.Plugins.Conversation;
			var config = await plugin.GetEntityConfig( req.Hive, req.params.name );
			res.json( config );
		}
		catch ( error )
		{
			res.status( 404 ).json( { Error: error.message } );
		}
	} );


};
