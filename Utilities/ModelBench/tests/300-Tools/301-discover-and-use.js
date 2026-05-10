/*
	02-discover-and-use.js
---------------------------------------------------------------------
Tests whether the model can discover a tool and chain two dependent
calls: first call System.ListTools to learn the Test.Calculate
schema, then compute 15 * 7 = 105, then compute 105 % 4 = 1.
The second calculation depends on the result of the first.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-td02-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should discover Test.Calculate and chain two dependent calls', async function ()
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
			Text: 'I need you to perform a calculation using the Test plugin. '
				+ 'First, call System.ListTools to discover what tools the Test plugin provides and how to use them. '
				+ 'Then use the appropriate tool to compute 15 multiplied by 7. '
				+ 'Then take that result and use the same tool to compute it modulo 4. '
				+ 'Tell me the final answer.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 3,
			'should have made at least 3 tool calls (1 discovery + 2 calculate), got '
			+ ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Should have two Test.Calculate calls
		var calc_calls = result.Result.ToolCalls.filter( function ( c )
		{
			return c.Tool === 'Test.Calculate';
		} );
		ASSERT.ok( calc_calls.length >= 2,
			'should have at least 2 Calculate calls, got ' + calc_calls.length );

		// First call should be multiply (15 * 7 = 105)
		if ( calc_calls.length >= 1 )
		{
			ASSERT.ok( calc_calls[ 0 ].Success, 'First Calculate should succeed' );
			ASSERT.strictEqual( calc_calls[ 0 ].Arguments.Operation, 'multiply',
				'First call should be multiply, got: ' + calc_calls[ 0 ].Arguments.Operation );
			ASSERT.strictEqual( calc_calls[ 0 ].Arguments.A, 15,
				'First call A should be 15, got: ' + calc_calls[ 0 ].Arguments.A );
			ASSERT.strictEqual( calc_calls[ 0 ].Arguments.B, 7,
				'First call B should be 7, got: ' + calc_calls[ 0 ].Arguments.B );
		}

		// Second call should be modulo (105 % 4 = 1)
		if ( calc_calls.length >= 2 )
		{
			ASSERT.ok( calc_calls[ 1 ].Success, 'Second Calculate should succeed' );
			ASSERT.strictEqual( calc_calls[ 1 ].Arguments.Operation, 'modulo',
				'Second call should be modulo, got: ' + calc_calls[ 1 ].Arguments.Operation );
			ASSERT.strictEqual( calc_calls[ 1 ].Arguments.A, 105,
				'Second call A should be 105, got: ' + calc_calls[ 1 ].Arguments.A );
			ASSERT.strictEqual( calc_calls[ 1 ].Arguments.B, 4,
				'Second call B should be 4, got: ' + calc_calls[ 1 ].Arguments.B );
		}

		// Final response should mention 1
		ASSERT.ok( result.Result.Response.indexOf( '1' ) > -1,
			'final response should contain 1, got: ' + result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
