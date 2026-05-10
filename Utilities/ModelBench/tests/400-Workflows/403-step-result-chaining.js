/*
	03-step-result-chaining.js
---------------------------------------------------------------------
Tests whether the model can create a workflow where a later step
references the result of an earlier step via $Steps interpolation.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-wf03-' + model_id;
	var workflow_name = 'bench-wf03-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should chain step results using $Steps interpolation', async function ()
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
				+ 'Step 1 named "calc" calls Test.Calculate with Operation "add", A set to 10, and B set to 25. '
				+ 'Step 2 named "echo-result" calls Test.Echo with Message set to "$Steps.calc.Result" '
				+ 'so that it echoes the calculation result from step 1. '
				+ 'Use Workflow.ConfigEntity to create it, then Workflow.RunWorkflow to run it. '
				+ 'Tell me what value was echoed.',
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

		// Run should have completed with 2 steps
		var run_result = run_call.Result;
		ASSERT.ok( run_result, 'RunWorkflow should have a result' );
		ASSERT.equal( run_result.Status, 'completed',
			'workflow should have completed, got: ' + ( run_result.Status || 'undefined' ) );

		var step_results = run_result.StepResults || [];
		ASSERT.ok( step_results.length === 2,
			'should have 2 step results, got ' + step_results.length );

		// Step 1 (calc) should have succeeded with result 35
		ASSERT.ok( step_results[ 0 ].Success, 'calc step should have succeeded' );

		// The response should mention 35 (10 + 25)
		var response = result.Result.Response || '';
		ASSERT.ok( response.indexOf( '35' ) > -1,
			'response should mention 35, got: ' + response.substring( 0, 300 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		try { await hive.InvokeTool( 'Workflow.DeleteEntity', { EntityName: workflow_name } ); }
		catch ( error ) { /* ignore */ }
	} );

};
