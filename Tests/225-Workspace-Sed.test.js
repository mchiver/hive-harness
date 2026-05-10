
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

var SED_TEST_DIR = 'sed-test';
var SED_TEST_ABS = PATH.join( TEST_HIVE_ROOT, SED_TEST_DIR );


//---------------------------------------------------------------------
TEST.describe( 'Workspace.Sed Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		await FileUtils.EnsureFolder( SED_TEST_ABS );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( SED_TEST_ABS ) )
		{
			await FileUtils.DeleteFolder( SED_TEST_ABS, true );
		}
	} );


	//-----------------------------------------------------------------
	// Helper to write a test file and return its relative path
	async function write_test_file( Name, Content )
	{
		var abs = PATH.join( SED_TEST_ABS, Name );
		await FileUtils.WriteFile( abs, Content );
		return SED_TEST_DIR + '/' + Name;
	}


	//-----------------------------------------------------------------
	TEST.it( 'should substitute single occurrence per line', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'sub1.txt', 'hello world\nhello there' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/hello/goodbye/',
			Path: path,
		} );

		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 2 );

		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'goodbye world\ngoodbye there' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should substitute globally with g flag', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'sub2.txt', 'aaa bbb aaa' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/aaa/ccc/g',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'ccc bbb ccc' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should substitute case-insensitively with i flag', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'sub3.txt', 'Hello HELLO hello' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/hello/bye/gi',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'bye bye bye' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should substitute with alternate delimiter', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'sub4.txt', 'path/to/file' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's|path/to|new/dir|',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'new/dir/file' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete lines matching pattern', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'del1.txt', 'keep this\n# comment\nkeep this too\n# another comment' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 'd/^#/',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 2 );

		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'keep this\nkeep this too' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should insert text before matching lines', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'ins1.txt', 'alpha\nbeta\ngamma' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 'i/beta/--- marker ---',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 1 );

		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'alpha\n--- marker ---\nbeta\ngamma' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should append text after matching lines', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'app1.txt', 'alpha\nbeta\ngamma' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 'a/beta/--- marker ---',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 1 );

		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'alpha\nbeta\n--- marker ---\ngamma' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should apply multiple commands in order', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'multi.txt', '# header\nfoo bar\nbaz qux' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: [ 'd/^#/', 's/foo/FOO/' ],
			Path: path,
		} );

		ASSERT.ok( result.Success );
		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'FOO bar\nbaz qux' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should operate on multiple files with Glob option', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		await write_test_file( 'glob_a.txt', 'old value' );
		await write_test_file( 'glob_b.txt', 'old value' );

		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/old/new/',
			Path: SED_TEST_DIR + '/glob_*.txt',
			Options: { Glob: true },
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Files.length, 2, 'should process 2 files' );

		for ( var file of result.Result.Files )
		{
			ASSERT.ok( file.Modified, file.Path + ' should be modified' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should not write to disk in DryRun mode', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'dry.txt', 'original content' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/original/modified/',
			Path: path,
			Options: { DryRun: true },
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.Files[ 0 ].Modified, 'should report as modified' );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 1 );

		// File should be unchanged on disk
		var content = await FileUtils.ReadFile( PATH.join( TEST_HIVE_ROOT, path ) );
		ASSERT.strictEqual( content, 'original content', 'file should be unchanged' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject paths outside workspace', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/a/b/',
			Path: '../../etc/passwd',
		} );

		ASSERT.ok( result.Error, 'should error for path traversal' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should report zero changes when no match', async function ()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		var path = await write_test_file( 'nomatch.txt', 'nothing to change here' );
		var result = await hive.InvokeTool( 'Workspace.Sed', {
			Command: 's/zzzzz/yyyyy/',
			Path: path,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Modified, false );
		ASSERT.strictEqual( result.Result.Files[ 0 ].Changes, 0 );
	} );


} );
