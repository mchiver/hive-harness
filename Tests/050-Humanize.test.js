
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Humanize = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'Humanize.js' ) );


//---------------------------------------------------------------------
TEST.describe( 'Humanize Helper Tests', function ()
{


	//=================================================================
	// ParseDuration
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should parse simple duration values', function ()
	{
		ASSERT.strictEqual( Humanize.ParseDuration( '30s' ), 30 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '5m' ), 5 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '2h' ), 2 * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '3d' ), 3 * 24 * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '1w' ), 7 * 24 * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '1y' ), 365 * 24 * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '2y' ), 2 * 365 * 24 * 60 * 60 * 1000 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse compound duration values', function ()
	{
		ASSERT.strictEqual( Humanize.ParseDuration( '1h30m' ), ( 60 + 30 ) * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '1d12h' ), ( 24 + 12 ) * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '1w2d3h' ),
			( 7 * 24 + 2 * 24 + 3 ) * 60 * 60 * 1000 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse case-insensitively', function ()
	{
		ASSERT.strictEqual( Humanize.ParseDuration( '30M' ), 30 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '2H' ), 2 * 60 * 60 * 1000 );
		ASSERT.strictEqual( Humanize.ParseDuration( '1D' ), 24 * 60 * 60 * 1000 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should throw on invalid input', function ()
	{
		ASSERT.throws( function () { Humanize.ParseDuration( 'abc' ); } );
		ASSERT.throws( function () { Humanize.ParseDuration( '' ); } );
		ASSERT.throws( function () { Humanize.ParseDuration( '30x' ); } );
		ASSERT.throws( function () { Humanize.ParseDuration( null ); } );
		ASSERT.throws( function () { Humanize.ParseDuration( undefined ); } );
	} );


	//=================================================================
	// FormatDuration
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should format round values', function ()
	{
		ASSERT.strictEqual( Humanize.FormatDuration( 1000 ), '1s' );
		ASSERT.strictEqual( Humanize.FormatDuration( 60 * 1000 ), '1m' );
		ASSERT.strictEqual( Humanize.FormatDuration( 60 * 60 * 1000 ), '1h' );
		ASSERT.strictEqual( Humanize.FormatDuration( 24 * 60 * 60 * 1000 ), '1d' );
		ASSERT.strictEqual( Humanize.FormatDuration( 7 * 24 * 60 * 60 * 1000 ), '1w' );
		ASSERT.strictEqual( Humanize.FormatDuration( 365 * 24 * 60 * 60 * 1000 ), '1y' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should format compound values', function ()
	{
		ASSERT.strictEqual( Humanize.FormatDuration( 90 * 60 * 1000 ), '1h 30m' );
		ASSERT.strictEqual( Humanize.FormatDuration( 36 * 60 * 60 * 1000 ), '1d 12h' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return 0s for zero', function ()
	{
		ASSERT.strictEqual( Humanize.FormatDuration( 0 ), '0s' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should round-trip with ParseDuration', function ()
	{
		var durations = [ '30s', '5m', '2h', '3d', '1w', '1h 30m', '2d 12h' ];
		for ( var index = 0; index < durations.length; index++ )
		{
			var original = durations[ index ];
			var ms = Humanize.ParseDuration( original );
			var formatted = Humanize.FormatDuration( ms );
			ASSERT.strictEqual( formatted, original, 'round-trip for ' + original );
		}
	} );


} );
