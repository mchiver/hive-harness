/*
	03-summarize-results.js
---------------------------------------------------------------------
Tests ability to aggregate multiple tool results: call Test.Calculate
three times with different inputs, then identify the pattern.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-r03-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should make 3 Calculate calls and identify the pattern', async function ()
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
			Text: 'Use Test.Calculate to add 5 to each of these numbers: 10, 20, and 30. '
				+ 'Make three separate calls with Operation "add", B set to 5, '
				+ 'and A set to 10, 20, and 30 respectively. '
				+ 'Then tell me all three results and describe the pattern you see.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );

		// Should have at least 3 Test.Calculate calls
		var calc_calls = result.Result.ToolCalls.filter( function ( c )
		{
			return c.Tool === 'Test.Calculate';
		} );
		ASSERT.ok( calc_calls.length >= 3,
			'should have at least 3 Calculate calls, got ' + calc_calls.length );

		// All should have succeeded
		for ( var index = 0; index < calc_calls.length && index < 3; index++ )
		{
			ASSERT.ok( calc_calls[ index ].Success,
				'Calculate call ' + ( index + 1 ) + ' should succeed' );
		}

		// Response should mention the results: 15, 25, 35
		var response = result.Result.Response;
		ASSERT.ok( response.indexOf( '15' ) > -1,
			'response should mention 15, got: ' + response.substring( 0, 300 ) );
		ASSERT.ok( response.indexOf( '25' ) > -1,
			'response should mention 25, got: ' + response.substring( 0, 300 ) );
		ASSERT.ok( response.indexOf( '35' ) > -1,
			'response should mention 35, got: ' + response.substring( 0, 300 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
