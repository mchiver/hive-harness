/*
	04-error-handling.js
---------------------------------------------------------------------
Tests whether the model can handle a tool error gracefully --
specifically a division by zero -- and report the error rather
than fabricating a numeric result.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-tc04-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should report tool error for division by zero', async function ()
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
			Text: 'Call Test.Calculate with Operation "divide", A set to 10, and B set to 0. '
				+ 'Then tell me what happened.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1,
			'should have made at least one tool call' );

		// Should have called Test.Calculate
		var calc_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Calculate';
		} );
		ASSERT.ok( calc_call, 'should have called Test.Calculate' );

		// The tool should have returned an error (not Success)
		ASSERT.ok( !calc_call.Success || ( calc_call.Result && calc_call.Result.Error ),
			'Calculate should have returned an error for division by zero' );

		// The final response should mention the error (not fabricate a number)
		var response_lower = result.Result.Response.toLowerCase();
		var mentions_error = response_lower.indexOf( 'error' ) > -1
			|| response_lower.indexOf( 'zero' ) > -1
			|| response_lower.indexOf( 'division' ) > -1
			|| response_lower.indexOf( 'cannot' ) > -1
			|| response_lower.indexOf( 'undefined' ) > -1
			|| response_lower.indexOf( 'infinity' ) > -1
			|| response_lower.indexOf( 'nan' ) > -1;

		ASSERT.ok( mentions_error,
			'response should mention the error (zero/division/error), got: '
			+ result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
