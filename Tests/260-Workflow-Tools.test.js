
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );

var WORKFLOW_NAME = 'wf-test';
var WORKFLOW_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Workflow', WORKFLOW_NAME );

// Also need a KeyStore for workflow steps to target
var STORE_NAME = 'wf-data-store';
var STORE_DATA_FOLDER = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'KeyStore', STORE_NAME );


//---------------------------------------------------------------------
TEST.describe( 'Workflow Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create the KeyStore entity for workflow steps to use
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: STORE_NAME } );
		var data_path = PATH.join( STORE_DATA_FOLDER, STORE_NAME + '.data.json' );
		await FileUtils.EnsureFolder( STORE_DATA_FOLDER );
		await FileUtils.WriteJson( data_path, { Values: {} } );

		// Create workflow entity with a multi-step definition
		await hive.InvokeTool( 'Workflow.ConfigEntity', {
			EntityName: WORKFLOW_NAME,
			Settings: {
				Description: 'Test workflow',
				OnError: 'stop',
				Steps: [
					{
						Name: 'get-info',
						Tool: 'System.Info',
						Arguments: {},
					},
					{
						Name: 'set-key',
						Tool: 'KeyStore.SetKey',
						Arguments: {
							EntityName: STORE_NAME,
							Key: '$Input.KeyName',
							Value: '$Steps.get-info.UserName',
						},
					},
				],
			},
		} );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( WORKFLOW_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( WORKFLOW_DATA_FOLDER, true );
		}
		if ( await FileUtils.FolderExists( STORE_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( STORE_DATA_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should run a multi-step workflow with variable interpolation', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Workflow.RunWorkflow', {
			EntityName: WORKFLOW_NAME,
			Input: { KeyName: 'wf_result' },
		} );

		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Status, 'completed' );
		ASSERT.ok( result.Result.RunId >= 1 );
		ASSERT.strictEqual( result.Result.StepResults.length, 2 );

		// Step 1: System.Info should succeed
		ASSERT.ok( result.Result.StepResults[ 0 ].Success, 'get-info step should succeed' );
		ASSERT.strictEqual( result.Result.StepResults[ 0 ].Name, 'get-info' );

		// Step 2: KeyStore.SetKey should have used interpolated values
		ASSERT.ok( result.Result.StepResults[ 1 ].Success, 'set-key step should succeed' );

		// Verify the key was actually set with the interpolated value
		var get_key = await hive.InvokeTool( 'KeyStore.GetKey', {
			EntityName: STORE_NAME,
			Key: 'wf_result',
		} );
		ASSERT.strictEqual( get_key.Result.Value, TEST_CONFIG.Username, 'value should be the username from System.Info' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get workflow status by run ID', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Run workflow
		var run = await hive.InvokeTool( 'Workflow.RunWorkflow', {
			EntityName: WORKFLOW_NAME,
			Input: { KeyName: 'status_test' },
		} );

		// Get status
		var status = await hive.InvokeTool( 'Workflow.GetWorkflowStatus', {
			EntityName: WORKFLOW_NAME,
			RunId: run.Result.RunId,
		} );

		ASSERT.ok( status.Success );
		ASSERT.strictEqual( status.Result.Status, 'completed' );
		ASSERT.strictEqual( status.Result.RunId, run.Result.RunId );
		ASSERT.ok( status.Result.StartedAt );
		ASSERT.ok( status.Result.CompletedAt );
		ASSERT.strictEqual( status.Result.StepResults.length, 2 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list workflow runs', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Workflow.ListWorkflowRuns', {
			EntityName: WORKFLOW_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.Runs.length >= 2, 'should have at least 2 runs from prior tests' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter runs by status', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Workflow.ListWorkflowRuns', {
			EntityName: WORKFLOW_NAME,
			Status: 'completed',
		} );

		ASSERT.ok( result.Success );
		for ( var run of result.Result.Runs )
		{
			ASSERT.strictEqual( run.Status, 'completed' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should stop on error with OnError=stop', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create a workflow with a failing step
		await hive.InvokeTool( 'Workflow.ConfigEntity', {
			EntityName: WORKFLOW_NAME + '-fail',
			Settings: {
				OnError: 'stop',
				Steps: [
					{
						Name: 'will-fail',
						Tool: 'KeyStore.GetKey',
						Arguments: { EntityName: 'nonexistent-store', Key: 'x' },
					},
					{
						Name: 'should-not-run',
						Tool: 'System.Info',
						Arguments: {},
					},
				],
			},
		} );

		var result = await hive.InvokeTool( 'Workflow.RunWorkflow', {
			EntityName: WORKFLOW_NAME + '-fail',
		} );

		ASSERT.ok( result.Success, 'tool call itself should succeed' );
		ASSERT.strictEqual( result.Result.Status, 'failed' );
		// Should have only 1 step result (stopped after failure)
		ASSERT.strictEqual( result.Result.StepResults.length, 1 );
		ASSERT.ok( !result.Result.StepResults[ 0 ].Success );

		// Clean up
		var fail_folder = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Workflow', WORKFLOW_NAME +'-fail' );
		if ( await FileUtils.FolderExists( fail_folder ) )
		{
			await FileUtils.DeleteFolder( fail_folder, true );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should continue on error with OnError=continue', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Create a workflow with OnError=continue
		await hive.InvokeTool( 'Workflow.ConfigEntity', {
			EntityName: WORKFLOW_NAME + '-cont',
			Settings: {
				OnError: 'continue',
				Steps: [
					{
						Name: 'will-fail',
						Tool: 'KeyStore.GetKey',
						Arguments: { EntityName: 'nonexistent-store', Key: 'x' },
					},
					{
						Name: 'should-still-run',
						Tool: 'System.Info',
						Arguments: {},
					},
				],
			},
		} );

		var result = await hive.InvokeTool( 'Workflow.RunWorkflow', {
			EntityName: WORKFLOW_NAME + '-cont',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Status, 'completed' );
		ASSERT.strictEqual( result.Result.StepResults.length, 2, 'both steps should run' );
		ASSERT.ok( !result.Result.StepResults[ 0 ].Success, 'first step should fail' );
		ASSERT.ok( result.Result.StepResults[ 1 ].Success, 'second step should succeed' );

		// Clean up
		var cont_folder = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Workflow', WORKFLOW_NAME +'-cont' );
		if ( await FileUtils.FolderExists( cont_folder ) )
		{
			await FileUtils.DeleteFolder( cont_folder, true );
		}
	} );


} );
