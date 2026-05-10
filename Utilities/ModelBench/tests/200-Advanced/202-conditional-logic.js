/*
	02-conditional-logic.js
---------------------------------------------------------------------
Tests conditional reasoning with tool use: get the time, check if
the seconds value is even or odd, then echo the appropriate label.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-r02-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should evaluate a condition and call the right tool based on result', async function ()
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
			Text: 'Call Test.GetTime with Format "iso" to get the current time. '
				+ 'Look at the seconds value in the time string. '
				+ 'If the seconds value is even, call Test.Echo with Message "EVEN". '
				+ 'If the seconds value is odd, call Test.Echo with Message "ODD". '
				+ 'Tell me the time and whether the seconds were even or odd.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 2,
			'should have made at least 2 tool calls (GetTime + Echo), got '
			+ ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

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

		// Echo Message should be "EVEN" or "ODD"
		var echo_message = String( echo_call.Arguments.Message ).toUpperCase();
		ASSERT.ok( echo_message === 'EVEN' || echo_message === 'ODD',
			'Echo Message should be "EVEN" or "ODD", got: ' + echo_call.Arguments.Message );

		// Verify the model chose correctly by parsing the time
		var time_result = time_call.Result;
		var time_string = time_result.Time || time_result.Result || '';
		var seconds_match = String( time_string ).match( /(\d{2})(?:\.\d+)?Z?$/ );
		if ( seconds_match )
		{
			var seconds = parseInt( seconds_match[ 1 ], 10 );
			var expected = ( seconds % 2 === 0 ) ? 'EVEN' : 'ODD';
			ASSERT.strictEqual( echo_message, expected,
				'Echo should be ' + expected + ' for seconds=' + seconds + ', got: ' + echo_message );
		}

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
