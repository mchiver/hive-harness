/*
	04-conversation-recall.js
---------------------------------------------------------------------
Tests whether the model can use conversation history from the
<history> section of the prompt.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-b04-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should recall information from conversation history', async function ()
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

		// First message: establish a fact
		var first_result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'My favorite color is blue. Just acknowledge that.',
		} );

		ASSERT.ok( first_result.Success, 'First chat call should succeed' );
		ASSERT.ok( !first_result.Result.Error, 'First chat should not have error' );

		// Second message: ask about the fact from history
		var second_result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'What is my favorite color? Reply with just the color name.',
		} );

		ASSERT.ok( second_result.Success, 'Second chat call should succeed' );
		ASSERT.ok( !second_result.Result.Error, 'Second chat should not have error: ' + ( second_result.Result.Error || '' ) );
		ASSERT.ok( second_result.Result.Response, 'should have a response' );

		// Response should contain "blue"
		var response_lower = second_result.Result.Response.toLowerCase();
		ASSERT.ok( response_lower.indexOf( 'blue' ) > -1,
			'response should mention "blue", got: ' + second_result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
