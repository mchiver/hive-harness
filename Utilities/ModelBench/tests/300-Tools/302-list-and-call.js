/*
	01-list-and-call.js
---------------------------------------------------------------------
Tests whether the model can discover tools autonomously by calling
System.ListTools, then selecting and calling the right tool.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-td01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should discover tools and call System.Info autonomously', async function ()
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
			Text: 'Discover the tools in the System plugin by calling System.ListTools '
				+ 'with PluginName "System", then use the appropriate tool to find out '
				+ 'the hive username and tell me what it is.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1,
			'should have made at least one tool call, got ' + ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Should have called System.ListTools
		var list_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'System.ListTools';
		} );
		ASSERT.ok( list_call, 'should have called System.ListTools' );
		ASSERT.ok( list_call.Success, 'System.ListTools should have succeeded' );

		// Should have called System.Info
		var info_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'System.Info';
		} );
		ASSERT.ok( info_call, 'should have called System.Info' );
		ASSERT.ok( info_call.Success, 'System.Info should have succeeded' );

		// Final response should mention the username
		var expected_username = Context.TestConfig.Username;
		ASSERT.ok( result.Result.Response.indexOf( expected_username ) > -1,
			'final response should mention ' + expected_username + ', got: ' + result.Result.Response.substring( 0, 200 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
