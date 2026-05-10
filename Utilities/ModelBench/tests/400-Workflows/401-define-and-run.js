/*
	01-define-and-run.js
---------------------------------------------------------------------
Tests whether the model can create a workflow definition using
Workflow.ConfigEntity and then execute it with Workflow.RunWorkflow.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-wf01-' + model_id;
	var workflow_name = 'bench-wf01-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should define a 2-step workflow and run it', async function ()
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
			Text: 'Create a workflow named "' + workflow_name + '" with two steps: '
				+ 'Step 1 named "get-time" calls Test.GetTime with Format "iso". '
				+ 'Step 2 named "echo-msg" calls Test.Echo with Message "workflow-done". '
				+ 'Use Workflow.ConfigEntity to create it, then use Workflow.RunWorkflow to run it. '
				+ 'Tell me the run status and how many steps completed.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.ToolCalls, 'should have ToolCalls array' );

		// Should have called Workflow.ConfigEntity
		var config_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Workflow.ConfigEntity';
		} );
		ASSERT.ok( config_call, 'should have called Workflow.ConfigEntity' );
		ASSERT.ok( config_call.Success, 'Workflow.ConfigEntity should have succeeded' );

		// Should have called Workflow.RunWorkflow
		var run_call = result.Result.ToolCalls.find( function ( c )
		{
			return c.Tool === 'Workflow.RunWorkflow';
		} );
		ASSERT.ok( run_call, 'should have called Workflow.RunWorkflow' );
		ASSERT.ok( run_call.Success, 'Workflow.RunWorkflow should have succeeded' );

		// Run result should show completed with 2 steps
		var run_result = run_call.Result;
		ASSERT.ok( run_result, 'RunWorkflow should have a result' );
		ASSERT.equal( run_result.Status, 'completed',
			'workflow should have completed, got: ' + ( run_result.Status || 'undefined' ) );
		ASSERT.ok( run_result.StepResults && run_result.StepResults.length === 2,
			'should have 2 step results, got ' + ( run_result.StepResults ? run_result.StepResults.length : 0 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		try { await hive.InvokeTool( 'Workflow.DeleteEntity', { EntityName: workflow_name } ); }
		catch ( error ) { /* ignore */ }
	} );

};
