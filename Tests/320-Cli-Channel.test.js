
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const CHILD_PROCESS = require( 'child_process' );

const CLI_PATH = PATH.join( __dirname, '..', 'Channels', 'Cli', 'Cli.js' );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
// Helper: run Cli.js with given args, return { stdout, stderr, code }
function run_cli( args, timeout_ms )
{
	return new Promise( function ( resolve, reject )
	{
		var child = CHILD_PROCESS.execFile(
			process.execPath,
			[ CLI_PATH ].concat( args ),
			{ timeout: timeout_ms || 10000 },
			function ( error, stdout, stderr )
			{
				resolve( {
					stdout: stdout,
					stderr: stderr,
					code: error ? error.code : 0,
				} );
			}
		);
	} );
}


//---------------------------------------------------------------------
TEST.describe( 'CLI Channel Integration Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.it( 'should display help text with --help', async function ()
	{
		var result = await run_cli( [ '--help' ] );

		ASSERT.ok( result.stdout.indexOf( 'Usage:' ) > -1, 'should contain Usage' );
		ASSERT.ok( result.stdout.indexOf( '--registry' ) > -1, 'should mention --registry' );
		ASSERT.ok( result.stdout.indexOf( '--username' ) > -1, 'should mention --username' );
		ASSERT.ok( result.stdout.indexOf( '/Help' ) > -1, 'should mention /Help command' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should error when registry path does not exist', async function ()
	{
		var result = await run_cli( [
			'--registry', PATH.join( __dirname, 'nonexistent-registry' ),
			'--path', TEST_HIVE_ROOT,
			'--username', 'testuser',
			'System.Info',
		] );

		ASSERT.ok( result.stderr.indexOf( 'Registry not found' ) > -1, 'should report missing registry' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should execute one-shot tool invocation', async function ()
	{
		var result = await run_cli( [
			'--registry', TEST_REGISTRY_PATH,
			'--path', TEST_HIVE_ROOT,
			'--username', TEST_CONFIG.Username,
			'--password', TEST_CONFIG.Password,
			'--llm', TEST_CONFIG.ChatLlm,
			'System.Info',
		] );

		ASSERT.strictEqual( result.stderr, '', 'should have no errors' );
		var parsed = JSON.parse( result.stdout );
		ASSERT.ok( parsed.HiveRoot, 'should have HiveRoot in System.Info output' );
		ASSERT.ok( parsed.UserName, 'should have UserName' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should produce dry run report with --test', async function ()
	{
		var result = await run_cli( [
			'--registry', TEST_REGISTRY_PATH,
			'--path', TEST_HIVE_ROOT,
			'--username', TEST_CONFIG.Username,
			'--password', TEST_CONFIG.Password,
			'--llm', TEST_CONFIG.ChatLlm,
			'--test',
		] );

		ASSERT.strictEqual( result.stderr, '', 'should have no errors' );
		var report = JSON.parse( result.stdout );
		ASSERT.ok( report.Registry, 'should have Registry path' );
		ASSERT.ok( report.HivePath, 'should have HivePath' );
		ASSERT.strictEqual( report.UserName, TEST_CONFIG.Username );
		ASSERT.strictEqual( report.ChannelName, 'cli' );
		ASSERT.ok( report.ConversationName, 'should have ConversationName' );
		ASSERT.ok( report.Plugins.length > 0, 'should have plugins' );
		ASSERT.ok( report.ToolCount > 0, 'should have tools' );
		ASSERT.strictEqual( report.Authenticated, true, 'should be authenticated' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle one-shot with unknown tool gracefully', async function ()
	{
		var result = await run_cli( [
			'--registry', TEST_REGISTRY_PATH,
			'--path', TEST_HIVE_ROOT,
			'--username', TEST_CONFIG.Username,
			'--password', TEST_CONFIG.Password,
			'--llm', TEST_CONFIG.ChatLlm,
			'hello world',
		], 60000 );

		// Free text routes to Conversation.Chat, which may succeed or fail
		// depending on LLM availability. Either way it should not crash.
		ASSERT.ok( result.stdout.length > 0 || result.stderr.length > 0, 'should produce some output' );
	} );


} );
