
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Strings = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'Strings.js' ) );


//---------------------------------------------------------------------
TEST.describe( 'Strings Helper Tests', function ()
{


	//=================================================================
	// GlobToRegex
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should convert * to match any sequence', function ()
	{
		var regex = Strings.GlobToRegex( '*.txt' );
		ASSERT.ok( regex.test( 'readme.txt' ) );
		ASSERT.ok( regex.test( '.txt' ) );
		ASSERT.ok( !regex.test( 'readme.md' ) );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should convert ? to match a single character', function ()
	{
		var regex = Strings.GlobToRegex( 'file?.txt' );
		ASSERT.ok( regex.test( 'file1.txt' ) );
		ASSERT.ok( regex.test( 'fileA.txt' ) );
		ASSERT.ok( !regex.test( 'file12.txt' ) );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should be case-insensitive', function ()
	{
		var regex = Strings.GlobToRegex( '*.TXT' );
		ASSERT.ok( regex.test( 'readme.txt' ) );
		ASSERT.ok( regex.test( 'README.TXT' ) );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should escape regex special characters', function ()
	{
		var regex = Strings.GlobToRegex( 'file[1].txt' );
		ASSERT.ok( regex.test( 'file[1].txt' ) );
		ASSERT.ok( !regex.test( 'file1.txt' ) );
	} );


	//=================================================================
	// MatchGlob
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should match strings against a glob pattern', function ()
	{
		ASSERT.ok( Strings.MatchGlob( 'readme.md', '*.md' ) );
		ASSERT.ok( Strings.MatchGlob( 'test.js', 'test.*' ) );
		ASSERT.ok( !Strings.MatchGlob( 'readme.md', '*.txt' ) );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should match exact strings', function ()
	{
		ASSERT.ok( Strings.MatchGlob( 'hello', 'hello' ) );
		ASSERT.ok( !Strings.MatchGlob( 'hello', 'world' ) );
	} );


	//=================================================================
	// GlobToSqlLike
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should convert * to %', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( '*.txt' ), '%.txt' );
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'docs/*' ), 'docs/%' );
		ASSERT.strictEqual( Strings.GlobToSqlLike( '*' ), '%' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should convert ? to _', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'file?.txt' ), 'file_.txt' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should escape literal % characters', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( '100%' ), '100\\%' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should escape literal _ characters', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'my_file' ), 'my\\_file' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should escape literal backslash characters', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'path\\to' ), 'path\\\\to' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should handle combined patterns', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'docs/*.md' ), 'docs/%.md' );
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'file_?' ), 'file\\__' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should pass through plain strings unchanged', function ()
	{
		ASSERT.strictEqual( Strings.GlobToSqlLike( 'readme.md' ), 'readme.md' );
		ASSERT.strictEqual( Strings.GlobToSqlLike( '' ), '' );
	} );


} );
