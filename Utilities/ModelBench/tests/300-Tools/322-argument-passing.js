/*
	02-argument-passing.js
---------------------------------------------------------------------
Tests whether the model can pass correct structured arguments
to the Test.Calculate tool.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-tc02-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should pass correct arguments to Test.Calculate', async function ()
	{
		var hive = Context.Hive;

		// Create conversation
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conversation_name,
			Settings: {
				Username: Context.TestConfig.Username,
				ChannelName: 'test',
				ChatLlm: Context.LlmEntityName,
				Skills: [ 'System.ToolUsageSkill' ],
			},
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'Call the Test.Calculate tool with Operation "add", A set to 7, '
				+ 'and B set to 5, then tell me the result.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1,
			'should have made at least one tool call, got ' + ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Should have called Test.Calculate
		var calc_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Calculate';
		} );
		ASSERT.ok( calc_call, 'should have called Test.Calculate' );
		ASSERT.ok( calc_call.Success, 'Test.Calculate should have succeeded' );

		// Check arguments
		ASSERT.ok( calc_call.Arguments, 'should have Arguments' );
		ASSERT.strictEqual( calc_call.Arguments.Operation, 'add',
			'Operation should be "add", got: ' + calc_call.Arguments.Operation );
		ASSERT.strictEqual( calc_call.Arguments.A, 7,
			'A should be 7, got: ' + calc_call.Arguments.A );
		ASSERT.strictEqual( calc_call.Arguments.B, 5,
			'B should be 5, got: ' + calc_call.Arguments.B );

		// Result should contain 12
		ASSERT.ok( calc_call.Result, 'should have a Result' );
		ASSERT.strictEqual( calc_call.Result.Result, 12,
			'Calculate result should be 12, got: ' + calc_call.Result.Result );

		// Final response should mention 12
		ASSERT.ok( result.Result.Response.indexOf( '12' ) > -1,
			'final response should contain 12, got: ' + result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
