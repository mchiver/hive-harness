/*
	01-simple-response.js
---------------------------------------------------------------------
Tests whether the model can respond to a simple prompt at all.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-b01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should respond to a simple prompt', async function ()
	{
		var hive = Context.Hive;

		// Create conversation
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conversation_name,
			Settings: {
				Username: Context.TestConfig.Username,
				ChannelName: 'test',
				ChatLlm: Context.LlmEntityName,
			},
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'Reply with exactly the word hello and nothing else.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.Response, 'should have a response' );
		ASSERT.ok( result.Result.Response.length > 0, 'response should not be empty' );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
