/*
	05-status-query.js
---------------------------------------------------------------------
Tests whether the model can run a workflow and then query its
status using Workflow.GetWorkflowStatus.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-wf05-' + model_id;
	var workflow_name = 'bench-wf05-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should run a workflow then query its status', async function ()
	{
		var hive = Context.Hive;

		// Create conversation
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conversation_name,
			Settings: {
				Username: Context.TestConfig.Username,
				ChannelName: 'test',
				ChatLlm: Context.LlmEntityName,
				Skills: [ 'System.ToolUsageSkill', 'Workflow.WorkflowSkill' ],
			},
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'Create a workflow named "' + workflow_name + '" with one step: '
				+ 'Step named "echo-hello" calls Test.Echo with Message "status-check". '
				+ 'Use Workflow.ConfigEntity to create it, then Workflow.RunWorkflow to run it. '
				+ 'After it runs, use Workflow.GetWorkflowStatus with the EntityName "' + workflow_name + '" '
				+ 'and the RunId from the run result to check the status. '
				+ 'Tell me the status and when the run started and completed.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );

		// Should have called Workflow.RunWorkflow
		var run_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Workflow.RunWorkflow';
		} );
		ASSERT.ok( run_call, 'should have called Workflow.RunWorkflow' );
		ASSERT.ok( run_call.Success, 'Workflow.RunWorkflow should have succeeded' );

		// Should have called Workflow.GetWorkflowStatus
		var status_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Workflow.GetWorkflowStatus';
		} );
		ASSERT.ok( status_call, 'should have called Workflow.GetWorkflowStatus' );
		ASSERT.ok( status_call.Success, 'Workflow.GetWorkflowStatus should have succeeded' );

		// Status result should show completed
		var status_result = status_call.Result;
		ASSERT.ok( status_result, 'GetWorkflowStatus should have a result' );
		ASSERT.equal( status_result.Status, 'completed',
			'status should be completed, got: ' + ( status_result.Status || 'undefined' ) );
		ASSERT.ok( status_result.StartedAt, 'should have StartedAt timestamp' );
		ASSERT.ok( status_result.CompletedAt, 'should have CompletedAt timestamp' );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		try { await hive.InvokeTool( 'Workflow.DeleteEntity', { EntityName: workflow_name } ); }
		catch ( error ) { /* ignore */ }
	} );

};
