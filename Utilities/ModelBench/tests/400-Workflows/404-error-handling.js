/*
	04-error-handling.js
---------------------------------------------------------------------
Tests whether the model can create a workflow with OnError set to
'continue', so that a failing step does not abort the workflow.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-wf04-' + model_id;
	var workflow_name = 'bench-wf04-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should continue workflow execution despite a failing step', async function ()
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
			Text: 'Create a workflow named "' + workflow_name + '" with OnError set to "continue" '
				+ 'and three steps: '
				+ 'Step 1 named "echo-start" calls Test.Echo with Message "starting". '
				+ 'Step 2 named "bad-calc" calls Test.Calculate with Operation "divide", A set to 10, and B set to 0 '
				+ '(this will fail because of division by zero). '
				+ 'Step 3 named "echo-end" calls Test.Echo with Message "finished". '
				+ 'Use Workflow.ConfigEntity to create it, then Workflow.RunWorkflow to run it. '
				+ 'Tell me the final status and which steps succeeded or failed.',
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

		// With OnError:'continue', workflow should complete despite step 2 failing
		var run_result = run_call.Result;
		ASSERT.ok( run_result, 'RunWorkflow should have a result' );
		ASSERT.equal( run_result.Status, 'completed',
			'workflow should have completed (OnError=continue), got: ' + ( run_result.Status || 'undefined' ) );

		// All 3 steps should have results
		var step_results = run_result.StepResults || [];
		ASSERT.ok( step_results.length === 3,
			'should have 3 step results, got ' + step_results.length );

		// Step 1 should succeed, step 2 should fail, step 3 should succeed
		ASSERT.ok( step_results[ 0 ].Success, 'step 1 (echo-start) should have succeeded' );
		ASSERT.ok( !step_results[ 1 ].Success, 'step 2 (bad-calc) should have failed' );
		ASSERT.ok( step_results[ 2 ].Success, 'step 3 (echo-end) should have succeeded' );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		try { await hive.InvokeTool( 'Workflow.DeleteEntity', { EntityName: workflow_name } ); }
		catch ( error ) { /* ignore */ }
	} );

};
