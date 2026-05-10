/*
	03-json-types.js
---------------------------------------------------------------------
Tests whether the model can produce valid JSON in tool arguments
with correct types (booleans, integers, strings) and proper syntax.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-tc03-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should produce valid JSON arguments with correct types for Test.Echo', async function ()
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
			Text: 'Call Test.Echo with Message set to "Hello World", '
				+ 'UpperCase set to true, and Repeat set to 3. '
				+ 'Tell me the echoed result.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1,
			'should have made at least one tool call' );

		// Should have called Test.Echo
		var echo_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Test.Echo';
		} );
		ASSERT.ok( echo_call, 'should have called Test.Echo' );
		ASSERT.ok( echo_call.Success, 'Test.Echo should have succeeded' );
		ASSERT.ok( echo_call.Arguments, 'should have Arguments' );

		// Check Message is a string containing "Hello World"
		ASSERT.ok( typeof echo_call.Arguments.Message === 'string',
			'Message should be a string, got: ' + typeof echo_call.Arguments.Message );
		ASSERT.ok( echo_call.Arguments.Message.toLowerCase().indexOf( 'hello' ) > -1,
			'Message should contain "hello", got: ' + echo_call.Arguments.Message );

		// Check UpperCase is a boolean true
		ASSERT.strictEqual( echo_call.Arguments.UpperCase, true,
			'UpperCase should be boolean true, got: ' + echo_call.Arguments.UpperCase );

		// Check Repeat is a number 3
		ASSERT.strictEqual( echo_call.Arguments.Repeat, 3,
			'Repeat should be 3, got: ' + echo_call.Arguments.Repeat );

		// The Echo result should show 3 repetitions of the uppercase message
		ASSERT.ok( echo_call.Result, 'should have a Result' );
		ASSERT.ok( Array.isArray( echo_call.Result.Echoed ),
			'Result should have Echoed array' );
		ASSERT.strictEqual( echo_call.Result.Echoed.length, 3,
			'Should have 3 echoed items, got: ' + echo_call.Result.Echoed.length );
		ASSERT.strictEqual( echo_call.Result.Echoed[ 0 ], 'HELLO WORLD',
			'Echoed text should be "HELLO WORLD", got: ' + echo_call.Result.Echoed[ 0 ] );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
