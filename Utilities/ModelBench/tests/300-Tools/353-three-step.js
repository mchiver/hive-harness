/*
	03-three-step.js
---------------------------------------------------------------------
Tests a three-step dependency chain: GetTime (iso), then Calculate
the length of the time string modulo 10, then Echo the result.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-ch03-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should chain three dependent tool calls: GetTime, Calculate, Echo', async function ()
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
			Text: 'Perform the following steps in order: '
				+ '1. Call Test.GetTime with Format "iso" to get the current time string. '
				+ '2. Count the number of characters in that time string. '
				+ 'Then call Test.Calculate with Operation "modulo", A set to the character count, and B set to 10. '
				+ '3. Call Test.Echo with the calculation result as the Message. '
				+ 'Tell me the final echoed result.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 3,
			'should have made at least 3 tool calls, got '
			+ ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Should have called Test.GetTime
		var time_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.GetTime';
		} );
		ASSERT.ok( time_call, 'should have called Test.GetTime' );
		ASSERT.ok( time_call.Success, 'Test.GetTime should have succeeded' );

		// Should have called Test.Calculate
		var calc_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Calculate';
		} );
		ASSERT.ok( calc_call, 'should have called Test.Calculate' );
		ASSERT.ok( calc_call.Success, 'Test.Calculate should have succeeded' );
		ASSERT.strictEqual( calc_call.Arguments.Operation, 'modulo',
			'Calculate operation should be modulo, got: ' + calc_call.Arguments.Operation );
		ASSERT.strictEqual( calc_call.Arguments.B, 10,
			'Calculate B should be 10, got: ' + calc_call.Arguments.B );

		// Should have called Test.Echo
		var echo_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Echo';
		} );
		ASSERT.ok( echo_call, 'should have called Test.Echo' );
		ASSERT.ok( echo_call.Success, 'Test.Echo should have succeeded' );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
