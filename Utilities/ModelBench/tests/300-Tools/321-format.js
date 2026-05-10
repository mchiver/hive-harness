/*
	01-format.js
---------------------------------------------------------------------
Tests whether the model can produce a valid <tool-call> XML block
when given a direct hint with the exact format.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-tc01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should produce a valid tool-call block when given a direct hint', async function ()
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
			Text: 'Call the System.Info tool. '
				+ 'Use this exact format when calling a tool: '
				+ '`<tool-call>{"Tool":"System.Info","Arguments":{}}</tool-call>`',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );
		ASSERT.ok( result.Result.ToolCalls.length >= 1,
			'should have made at least one tool call, got ' + ( result.Result.ToolCalls ? result.Result.ToolCalls.length : 0 ) );

		// Verify the call was to System.Info
		var info_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'System.Info';
		} );
		ASSERT.ok( info_call, 'should have called System.Info' );
		ASSERT.ok( info_call.Success, 'System.Info should have succeeded' );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
	} );

};
