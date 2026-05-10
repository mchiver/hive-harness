/*
	02-input-interpolation.js
---------------------------------------------------------------------
Tests whether the model can create a workflow that uses $Input
variable interpolation and run it with specific input parameters.
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-wf02-' + model_id;
	var workflow_name = 'bench-wf02-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should create a workflow with $Input interpolation and run it', async function ()
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
				+ 'Step named "echo-input" calls Test.Echo with Message set to "$Input.Message". '
				+ 'Use Workflow.ConfigEntity to create it. '
				+ 'Then run it with Workflow.RunWorkflow, passing Input: { "Message": "hello-workflow" }. '
				+ 'Respond with just the return value of the echo step and nothing else.',
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

		// Run should have completed
		var run_result = run_call.Result;
		ASSERT.ok( run_result, 'RunWorkflow should have a result' );
		ASSERT.equal( run_result.Status, 'completed',
			'workflow should have completed, got: ' + ( run_result.Status || 'undefined' ) );

		// The echo step should have received the interpolated input
		var step_results = run_result.StepResults || [];
		ASSERT.ok( step_results.length >= 1, 'should have at least 1 step result' );

		var echo_step = step_results[ 0 ];
		ASSERT.ok( echo_step.Success, 'echo step should have succeeded' );

		// The response should mention "hello-workflow"
		var response = result.Result.Response || '';
		ASSERT.ok( response.indexOf( 'hello-workflow' ) > -1,
			'response should mention hello-workflow, got: ' + response.substring( 0, 300 ) );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		try { await hive.InvokeTool( 'Workflow.DeleteEntity', { EntityName: workflow_name } ); }
		catch ( error ) { /* ignore */ }
	} );

};
