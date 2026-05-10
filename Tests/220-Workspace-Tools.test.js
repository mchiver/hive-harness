
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

var WORKSPACE_FOLDER = PATH.join( TEST_HIVE_ROOT, 'workspace-test' );


//---------------------------------------------------------------------
TEST.describe( 'Workspace Tool Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		await FileUtils.EnsureFolder( WORKSPACE_FOLDER );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( WORKSPACE_FOLDER ) )
		{
			await FileUtils.DeleteFolder( WORKSPACE_FOLDER, true );
		}
	} );


	//-----------------------------------------------------------------
	// Helper to open a hive rooted at the workspace test folder.
	async function open_workspace_hive()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, WORKSPACE_FOLDER, TEST_CONFIG.Username, TEST_CONFIG.Password );
		return hive;
	}


	//=================================================================
	// Path Security Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reject paths that escape the workspace root', async function ()
	{
		var hive = await open_workspace_hive();

		var result = await hive.InvokeTool( 'Workspace.ReadFile', {
			Path: '../../../etc/passwd',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( 'outside the workspace root' ) > -1,
			'error should mention workspace root' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject paths that access .hive folder', async function ()
	{
		var hive = await open_workspace_hive();

		var result = await hive.InvokeTool( 'Workspace.ReadFile', {
			Path: '.hive/some-file.json',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( '.hive folder is not allowed' ) > -1,
			'error should mention .hive restriction' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject path traversal into .hive via ../', async function ()
	{
		var hive = await open_workspace_hive();

		var result = await hive.InvokeTool( 'Workspace.ReadFile', {
			Path: 'subdir/../../' + PATH.basename( WORKSPACE_FOLDER ) + '/.hive/data.json',
		} );

		ASSERT.ok( result.Error, 'should return an error for traversal into .hive' );
	} );


	//=================================================================
	// File Operation Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should write and read a file', async function ()
	{
		var hive = await open_workspace_hive();

		var write_result = await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'test-file.txt',
			Content: 'Hello, workspace!',
		} );

		ASSERT.ok( !write_result.Error, write_result.Error );
		ASSERT.ok( write_result.Result.Success, 'write should succeed' );

		var read_result = await hive.InvokeTool( 'Workspace.ReadFile', {
			Path: 'test-file.txt',
		} );

		ASSERT.ok( !read_result.Error, read_result.Error );
		ASSERT.strictEqual( read_result.Result.Content, 'Hello, workspace!' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should append to a file', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'append-test.txt',
			Content: 'Line 1\n',
		} );

		await hive.InvokeTool( 'Workspace.AppendFile', {
			Path: 'append-test.txt',
			Content: 'Line 2\n',
		} );

		var read_result = await hive.InvokeTool( 'Workspace.ReadFile', {
			Path: 'append-test.txt',
		} );

		ASSERT.ok( !read_result.Error, read_result.Error );
		ASSERT.strictEqual( read_result.Result.Content, 'Line 1\nLine 2\n' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should write and read JSON', async function ()
	{
		var hive = await open_workspace_hive();
		var test_data = { Name: 'test', Count: 42, Tags: [ 'a', 'b' ] };

		var write_result = await hive.InvokeTool( 'Workspace.WriteJson', {
			Path: 'data.json',
			Data: test_data,
		} );

		ASSERT.ok( !write_result.Error, write_result.Error );
		ASSERT.ok( write_result.Result.Success, 'write should succeed' );

		var read_result = await hive.InvokeTool( 'Workspace.ReadJson', {
			Path: 'data.json',
		} );

		ASSERT.ok( !read_result.Error, read_result.Error );
		ASSERT.deepStrictEqual( read_result.Result.Data, test_data );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a file', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'delete-me.txt',
			Content: 'temporary',
		} );

		var delete_result = await hive.InvokeTool( 'Workspace.DeleteFile', {
			Path: 'delete-me.txt',
		} );

		ASSERT.ok( !delete_result.Error, delete_result.Error );
		ASSERT.ok( delete_result.Result.Success, 'delete should succeed' );

		var exists_result = await hive.InvokeTool( 'Workspace.FileExists', {
			Path: 'delete-me.txt',
		} );

		ASSERT.ok( !exists_result.Error, exists_result.Error );
		ASSERT.strictEqual( exists_result.Result.Exists, false, 'file should not exist' );
	} );


	//=================================================================
	// Existence Check Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should check path existence', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'exists-check.txt',
			Content: 'exists',
		} );

		var exists_result = await hive.InvokeTool( 'Workspace.PathExists', {
			Path: 'exists-check.txt',
		} );

		ASSERT.ok( !exists_result.Error, exists_result.Error );
		ASSERT.strictEqual( exists_result.Result.Exists, true );

		var missing_result = await hive.InvokeTool( 'Workspace.PathExists', {
			Path: 'no-such-path.txt',
		} );

		ASSERT.ok( !missing_result.Error, missing_result.Error );
		ASSERT.strictEqual( missing_result.Result.Exists, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should check file existence', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'file-exists-check.txt',
			Content: 'yes',
		} );

		var file_result = await hive.InvokeTool( 'Workspace.FileExists', {
			Path: 'file-exists-check.txt',
		} );

		ASSERT.ok( !file_result.Error, file_result.Error );
		ASSERT.strictEqual( file_result.Result.Exists, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should check folder existence', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', {
			Path: 'exists-folder',
		} );

		var folder_result = await hive.InvokeTool( 'Workspace.FolderExists', {
			Path: 'exists-folder',
		} );

		ASSERT.ok( !folder_result.Error, folder_result.Error );
		ASSERT.strictEqual( folder_result.Result.Exists, true );

		var missing_result = await hive.InvokeTool( 'Workspace.FolderExists', {
			Path: 'no-such-folder',
		} );

		ASSERT.ok( !missing_result.Error, missing_result.Error );
		ASSERT.strictEqual( missing_result.Result.Exists, false );
	} );


	//=================================================================
	// Folder Operation Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a folder', async function ()
	{
		var hive = await open_workspace_hive();

		var result = await hive.InvokeTool( 'Workspace.CreateFolder', {
			Path: 'new-folder/nested/deep',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'create folder should succeed' );

		var absolute_path = PATH.join( WORKSPACE_FOLDER, 'new-folder', 'nested', 'deep' );
		var exists = await FileUtils.FolderExists( absolute_path );
		ASSERT.ok( exists, 'nested folder should exist on disk' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a folder', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', {
			Path: 'delete-folder',
		} );

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'delete-folder/file.txt',
			Content: 'content',
		} );

		var result = await hive.InvokeTool( 'Workspace.DeleteFolder', {
			Path: 'delete-folder',
			Recursive: true,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'delete folder should succeed' );

		var exists = await FileUtils.FolderExists( PATH.join( WORKSPACE_FOLDER, 'delete-folder' ) );
		ASSERT.strictEqual( exists, false, 'folder should be gone' );
	} );


	//=================================================================
	// Rename and Copy Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should rename a file', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'rename-source.txt',
			Content: 'rename me',
		} );

		var result = await hive.InvokeTool( 'Workspace.Rename', {
			FromPath: 'rename-source.txt',
			ToPath: 'rename-target.txt',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'rename should succeed' );

		var old_exists = await hive.InvokeTool( 'Workspace.FileExists', { Path: 'rename-source.txt' } );
		ASSERT.strictEqual( old_exists.Result.Exists, false, 'old name should not exist' );

		var new_read = await hive.InvokeTool( 'Workspace.ReadFile', { Path: 'rename-target.txt' } );
		ASSERT.strictEqual( new_read.Result.Content, 'rename me', 'content should be preserved' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should copy a folder tree', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'copy-source/sub' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'copy-source/a.txt', Content: 'aaa' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'copy-source/sub/b.txt', Content: 'bbb' } );

		var result = await hive.InvokeTool( 'Workspace.CopyBranch', {
			SourcePath: 'copy-source',
			TargetPath: 'copy-target',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Success, 'copy should succeed' );

		var read_a = await hive.InvokeTool( 'Workspace.ReadFile', { Path: 'copy-target/a.txt' } );
		ASSERT.strictEqual( read_a.Result.Content, 'aaa' );

		var read_b = await hive.InvokeTool( 'Workspace.ReadFile', { Path: 'copy-target/sub/b.txt' } );
		ASSERT.strictEqual( read_b.Result.Content, 'bbb' );
	} );


	//=================================================================
	// Search and List Tests
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list files in a folder', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'list-test' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'list-test/one.txt', Content: '1' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'list-test/two.txt', Content: '2' } );

		var result = await hive.InvokeTool( 'Workspace.ListFiles', {
			Path: 'list-test',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Files.includes( 'one.txt' ), 'should include one.txt' );
		ASSERT.ok( result.Result.Files.includes( 'two.txt' ), 'should include two.txt' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list folders in a folder', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'list-folders-test/alpha' } );
		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'list-folders-test/beta' } );

		var result = await hive.InvokeTool( 'Workspace.ListFolders', {
			Path: 'list-folders-test',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Folders.includes( 'alpha' ), 'should include alpha' );
		ASSERT.ok( result.Result.Folders.includes( 'beta' ), 'should include beta' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find files with glob pattern', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'find-test' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'find-test/readme.md', Content: '# Hi' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'find-test/notes.md', Content: '# Notes' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'find-test/code.js', Content: '// js' } );

		var result = await hive.InvokeTool( 'Workspace.FindFiles', {
			Path: 'find-test',
			Glob: '*.md',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Files.length, 2, 'should find 2 .md files' );
		ASSERT.ok( result.Result.Files.includes( 'readme.md' ), 'should include readme.md' );
		ASSERT.ok( result.Result.Files.includes( 'notes.md' ), 'should include notes.md' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find files recursively', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'recurse-test/sub' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'recurse-test/top.js', Content: 'top' } );
		await hive.InvokeTool( 'Workspace.WriteFile', { Path: 'recurse-test/sub/deep.js', Content: 'deep' } );

		var result = await hive.InvokeTool( 'Workspace.FindFiles', {
			Path: 'recurse-test',
			Glob: '*.js',
			Recurse: true,
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Files.length, 2, 'should find 2 .js files recursively' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find folders with glob pattern', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'find-folders-test/src-app' } );
		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'find-folders-test/src-lib' } );
		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'find-folders-test/docs' } );

		var result = await hive.InvokeTool( 'Workspace.FindFolders', {
			Path: 'find-folders-test',
			Glob: 'src*',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Folders.length, 2, 'should find 2 src folders' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list files at workspace root when no path given', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'root-level.txt',
			Content: 'root',
		} );

		var result = await hive.InvokeTool( 'Workspace.ListFiles', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Result.Files.includes( 'root-level.txt' ),
			'should include root-level file' );
	} );


	//=================================================================
	// Security Edge Cases
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reject rename into .hive', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.WriteFile', {
			Path: 'sneaky.txt',
			Content: 'nope',
		} );

		var result = await hive.InvokeTool( 'Workspace.Rename', {
			FromPath: 'sneaky.txt',
			ToPath: '.hive/sneaky.txt',
		} );

		ASSERT.ok( result.Error, 'should reject rename into .hive' );
		ASSERT.ok( result.Error.indexOf( '.hive folder is not allowed' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject copy target outside workspace', async function ()
	{
		var hive = await open_workspace_hive();

		await hive.InvokeTool( 'Workspace.CreateFolder', { Path: 'copy-escape-src' } );

		var result = await hive.InvokeTool( 'Workspace.CopyBranch', {
			SourcePath: 'copy-escape-src',
			TargetPath: '../../escape-target',
		} );

		ASSERT.ok( result.Error, 'should reject copy outside workspace' );
		ASSERT.ok( result.Error.indexOf( 'outside the workspace root' ) > -1 );
	} );


} );
