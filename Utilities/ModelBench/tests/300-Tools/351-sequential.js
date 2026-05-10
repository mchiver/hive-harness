/*
	01-sequential.js
---------------------------------------------------------------------
Tests whether the model can use the result of one tool call
to inform another -- specifically, get the time then echo it.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-ch01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should chain two tool calls: GetTime then Echo', async function ()
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
			Text: 'First, call Test.GetTime with Format "iso" to get the current time. '
				+ 'Then, call Test.Echo with the time string as the Message argument. '
				+ 'Tell me both the time and the echoed result.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 2,
			'should have made at least 2 tool calls, got ' + ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Should have called Test.GetTime
		var time_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.GetTime';
		} );
		ASSERT.ok( time_call, 'should have called Test.GetTime' );
		ASSERT.ok( time_call.Success, 'Test.GetTime should have succeeded' );

		// Should have called Test.Echo
		var echo_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Echo';
		} );
		ASSERT.ok( echo_call, 'should have called Test.Echo' );
		ASSERT.ok( echo_call.Success, 'Test.Echo should have succeeded' );

		// Echo's Message argument should contain time-like data (ISO format has digits and T/Z)
		ASSERT.ok( echo_call.Arguments, 'Echo should have Arguments' );
		ASSERT.ok( echo_call.Arguments.Message, 'Echo should have a Message argument' );
		var message = String( echo_call.Arguments.Message );
		ASSERT.ok( /\d{4}/.test( message ),
			'Echo Message should contain year-like digits, got: ' + message );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
