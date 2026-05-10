
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TEST_DATA = PATH.join( __dirname, '.test-data', 'Data' );
const TEMP_FOLDER = PATH.join( __dirname, '.test-data', '~fileutils-temp' );


//---------------------------------------------------------------------
TEST.describe( 'FileUtils Helper Tests', function ()
{


	//=================================================================
	// Setup / Teardown
	//=================================================================

	TEST.before( async function ()
	{
		await FS.mkdir( TEMP_FOLDER, { recursive: true } );
	} );

	TEST.after( async function ()
	{
		await FS.rm( TEMP_FOLDER, { recursive: true, force: true } );
	} );


	//=================================================================
	// SplitAnyPath
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should split forward-slash paths', function ()
	{
		var parts = FileUtils.SplitAnyPath( 'a/b/c' );
		ASSERT.deepStrictEqual( parts, [ 'a', 'b', 'c' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should split backslash paths', function ()
	{
		var parts = FileUtils.SplitAnyPath( 'a\\b\\c' );
		ASSERT.deepStrictEqual( parts, [ 'a', 'b', 'c' ] );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty array for single segment', function ()
	{
		var parts = FileUtils.SplitAnyPath( 'filename' );
		ASSERT.deepStrictEqual( parts, [] );
	} );


	//=================================================================
	// PathExists / FileExists / FolderExists
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should detect existing path', async function ()
	{
		var exists = await FileUtils.PathExists( TEST_DATA );
		ASSERT.strictEqual( exists, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return false for nonexistent path', async function ()
	{
		var exists = await FileUtils.PathExists( PATH.join( TEST_DATA, 'nope-not-here' ) );
		ASSERT.strictEqual( exists, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should detect existing file', async function ()
	{
		var exists = await FileUtils.FileExists( PATH.join( TEST_DATA, 'test.json' ) );
		ASSERT.strictEqual( exists, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return false when FileExists called on a folder', async function ()
	{
		var exists = await FileUtils.FileExists( TEST_DATA );
		ASSERT.strictEqual( exists, false );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should detect existing folder', async function ()
	{
		var exists = await FileUtils.FolderExists( TEST_DATA );
		ASSERT.strictEqual( exists, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return false when FolderExists called on a file', async function ()
	{
		var exists = await FileUtils.FolderExists( PATH.join( TEST_DATA, 'test.json' ) );
		ASSERT.strictEqual( exists, false );
	} );


	//=================================================================
	// WriteFile / ReadFile / AppendFile / DeleteFile
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should write and read a file', async function ()
	{
		var filepath = PATH.join( TEMP_FOLDER, 'write-test.txt' );
		await FileUtils.WriteFile( filepath, 'hello world' );
		var content = await FileUtils.ReadFile( filepath );
		ASSERT.strictEqual( content, 'hello world' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should append to a file', async function ()
	{
		var filepath = PATH.join( TEMP_FOLDER, 'append-test.txt' );
		await FileUtils.WriteFile( filepath, 'line1' );
		await FileUtils.AppendFile( filepath, '\nline2' );
		var content = await FileUtils.ReadFile( filepath );
		ASSERT.strictEqual( content, 'line1\nline2' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should write and read JSON', async function ()
	{
		var filepath = PATH.join( TEMP_FOLDER, 'json-test.json' );
		var data = { Name: 'Test', Value: 42 };
		await FileUtils.WriteJson( filepath, data );
		var result = await FileUtils.ReadJson( filepath );
		ASSERT.deepStrictEqual( result, data );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a file', async function ()
	{
		var filepath = PATH.join( TEMP_FOLDER, 'delete-me.txt' );
		await FileUtils.WriteFile( filepath, 'temp' );
		ASSERT.strictEqual( await FileUtils.FileExists( filepath ), true );
		var deleted = await FileUtils.DeleteFile( filepath );
		ASSERT.strictEqual( deleted, true );
		ASSERT.strictEqual( await FileUtils.FileExists( filepath ), false );
	} );


	//=================================================================
	// CreateFolder / EnsureFolder / DeleteFolder
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a folder', async function ()
	{
		var folder = PATH.join( TEMP_FOLDER, 'new-folder' );
		var created = await FileUtils.CreateFolder( folder );
		ASSERT.strictEqual( created, true );
		ASSERT.strictEqual( await FileUtils.FolderExists( folder ), true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create nested folders recursively', async function ()
	{
		var folder = PATH.join( TEMP_FOLDER, 'a', 'b', 'c' );
		var created = await FileUtils.CreateFolder( folder );
		ASSERT.strictEqual( created, true );
		ASSERT.strictEqual( await FileUtils.FolderExists( folder ), true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should ensure folder exists without error on existing', async function ()
	{
		var folder = PATH.join( TEMP_FOLDER, 'ensure-folder' );
		await FileUtils.CreateFolder( folder );
		var result = await FileUtils.EnsureFolder( folder );
		ASSERT.strictEqual( result, true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should delete a folder', async function ()
	{
		var folder = PATH.join( TEMP_FOLDER, 'delete-folder' );
		await FileUtils.CreateFolder( folder );
		await FileUtils.WriteFile( PATH.join( folder, 'file.txt' ), 'data' );
		var deleted = await FileUtils.DeleteFolder( folder, true );
		ASSERT.strictEqual( deleted, true );
		ASSERT.strictEqual( await FileUtils.FolderExists( folder ), false );
	} );


	//=================================================================
	// Rename / CopyBranch
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should rename a file', async function ()
	{
		var from_path = PATH.join( TEMP_FOLDER, 'rename-from.txt' );
		var to_path = PATH.join( TEMP_FOLDER, 'rename-to.txt' );
		await FileUtils.WriteFile( from_path, 'renamed content' );
		var renamed = await FileUtils.Rename( from_path, to_path );
		ASSERT.strictEqual( renamed, true );
		ASSERT.strictEqual( await FileUtils.FileExists( from_path ), false );
		ASSERT.strictEqual( await FileUtils.FileExists( to_path ), true );
		var content = await FileUtils.ReadFile( to_path );
		ASSERT.strictEqual( content, 'renamed content' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should copy a folder tree', async function ()
	{
		var source_folder = PATH.join( TEMP_FOLDER, 'copy-source' );
		var target_folder = PATH.join( TEMP_FOLDER, 'copy-target' );
		await FileUtils.CreateFolder( PATH.join( source_folder, 'sub' ) );
		await FileUtils.WriteFile( PATH.join( source_folder, 'root.txt' ), 'root' );
		await FileUtils.WriteFile( PATH.join( source_folder, 'sub', 'child.txt' ), 'child' );

		await FileUtils.CopyBranch( source_folder, target_folder );

		ASSERT.strictEqual( await FileUtils.FolderExists( target_folder ), true );
		var root_content = await FileUtils.ReadFile( PATH.join( target_folder, 'root.txt' ) );
		ASSERT.strictEqual( root_content, 'root' );
		var child_content = await FileUtils.ReadFile( PATH.join( target_folder, 'sub', 'child.txt' ) );
		ASSERT.strictEqual( child_content, 'child' );
	} );


	//=================================================================
	// Find / FindFiles / FindFolders / ListFiles / ListFolders
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should find all entries in a folder', async function ()
	{
		var results = await FileUtils.Find( TEST_DATA, null, false );
		ASSERT.ok( results.length > 0, 'should find entries' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find entries matching a glob', async function ()
	{
		var results = await FileUtils.Find( TEST_DATA, '*.json', false );
		ASSERT.ok( results.length > 0, 'should find json files' );
		for ( var entry of results )
		{
			ASSERT.ok( entry.endsWith( '.json' ) || await FileUtils.FolderExists( PATH.join( TEST_DATA, entry ) ),
				'entry should match glob or be a folder' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find entries recursively', async function ()
	{
		var shallow = await FileUtils.Find( TEST_DATA, null, false );
		var deep = await FileUtils.Find( TEST_DATA, null, true );
		ASSERT.ok( deep.length >= shallow.length, 'recursive should find at least as many entries' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list only files', async function ()
	{
		var files = await FileUtils.ListFiles( TEST_DATA );
		for ( var file of files )
		{
			var is_file = await FileUtils.FileExists( PATH.join( TEST_DATA, file ) );
			ASSERT.strictEqual( is_file, true, file + ' should be a file' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list only folders', async function ()
	{
		var folders = await FileUtils.ListFolders( TEST_DATA );
		for ( var folder of folders )
		{
			var is_folder = await FileUtils.FolderExists( PATH.join( TEST_DATA, folder ) );
			ASSERT.strictEqual( is_folder, true, folder + ' should be a folder' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should find files matching a glob', async function ()
	{
		var files = await FileUtils.FindFiles( TEST_DATA, '*.txt', false );
		ASSERT.ok( files.length > 0, 'should find txt files' );
		for ( var file of files )
		{
			ASSERT.ok( file.endsWith( '.txt' ), file + ' should be a txt file' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty for nonexistent path', async function ()
	{
		var results = await FileUtils.Find( PATH.join( TEST_DATA, 'nonexistent' ), null, false );
		ASSERT.deepStrictEqual( results, [] );
	} );


	//=================================================================
	// Path helpers
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should join paths', function ()
	{
		var result = FileUtils.JoinPath( 'a', 'b', 'c' );
		ASSERT.ok( result.indexOf( 'b' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get parent folder', function ()
	{
		var result = FileUtils.GetParentFolder( PATH.join( 'a', 'b', 'c.txt' ) );
		ASSERT.strictEqual( result, PATH.join( 'a', 'b' ) );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get file name', function ()
	{
		ASSERT.strictEqual( FileUtils.GetFileName( '/a/b/c.txt' ), 'c.txt' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should get file name without extension', function ()
	{
		ASSERT.strictEqual( FileUtils.GetFileNameWithoutExtension( '/a/b/c.txt' ), 'c' );
		ASSERT.strictEqual( FileUtils.GetFileNameWithoutExtension( '/a/b/noext' ), 'noext' );
	} );


} );
