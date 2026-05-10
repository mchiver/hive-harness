/*
	01-multi-step-math.js
---------------------------------------------------------------------
Tests pure reasoning: a word problem requiring multiple arithmetic
steps without any tool calls. Answer: 15 - 7 + 12 = 20.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-r01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should solve a multi-step word problem without tools', async function ()
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
			Text: 'A store has 15 apples. 7 are sold. Then 3 more shipments of 4 apples each arrive. '
				+ 'How many apples does the store have now? Reply with just the number.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.Response, 'should have a response' );

		// Response should contain 20
		ASSERT.ok( result.Result.Response.indexOf( '20' ) > -1,
			'response should contain 20, got: ' + result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
