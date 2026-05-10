
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Logger = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'Logger.js' ) );


//---------------------------------------------------------------------
TEST.describe( 'Logger Helper Tests', function ()
{


	//=================================================================
	// CreateLogger
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create a logger with default settings', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		ASSERT.ok( log, 'logger should be created' );
		ASSERT.ok( log.Trace, 'should have Trace' );
		ASSERT.ok( log.Debug, 'should have Debug' );
		ASSERT.ok( log.Info, 'should have Info' );
		ASSERT.ok( log.Warn, 'should have Warn' );
		ASSERT.ok( log.Error, 'should have Error' );
		ASSERT.ok( log.Message, 'should have Message' );
	} );


	//=================================================================
	// Message formatting
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should include timestamp and severity in output', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		var result = log.Info( 'test message' );
		ASSERT.ok( result.indexOf( 'info' ) > -1, 'should contain severity' );
		ASSERT.ok( result.indexOf( 'test message' ) > -1, 'should contain message' );
		ASSERT.ok( result.indexOf( '|' ) > -1, 'should contain separator' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should pad severity to fixed width', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		var info_result = log.Info( 'x' );
		var warn_result = log.Warn( 'x' );
		// Both "info " and "warn " should be 5 chars wide
		ASSERT.ok( info_result.indexOf( 'info ' ) > -1, 'info should be padded' );
		ASSERT.ok( warn_result.indexOf( 'warn ' ) > -1, 'warn should be padded' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should truncate messages exceeding MaxLength', function ()
	{
		var log = Logger.CreateLogger( { Silent: true, MaxLength: 20 } );
		var long_message = 'a'.repeat( 50 );
		var result = log.Info( long_message );
		ASSERT.ok( result.indexOf( '...' ) > -1, 'should have truncation marker' );
		ASSERT.ok( result.indexOf( 'a'.repeat( 50 ) ) === -1, 'should not contain full message' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should not truncate messages within MaxLength', function ()
	{
		var log = Logger.CreateLogger( { Silent: true, MaxLength: 200 } );
		var short_message = 'hello world';
		var result = log.Info( short_message );
		ASSERT.ok( result.indexOf( short_message ) > -1, 'should contain full message' );
		ASSERT.strictEqual( result.indexOf( '...' ), -1, 'should not have truncation marker' );
	} );


	//=================================================================
	// Timestamp formatting
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should include formatted timestamp', function ()
	{
		var log = Logger.CreateLogger( { Silent: true, Timestamp: 'YYYY-MM-DD' } );
		var result = log.Info( 'ts test' );
		var year = String( new Date().getFullYear() );
		ASSERT.ok( result.indexOf( year ) > -1, 'should contain current year' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should omit timestamp when Timestamp is null', function ()
	{
		var log = Logger.CreateLogger( { Silent: true, Timestamp: null } );
		var result = log.Info( 'no ts' );
		// With no timestamp, the first part should be the severity
		var parts = result.split( ' | ' );
		ASSERT.ok( parts[ 0 ].trim().indexOf( 'info' ) > -1, 'first part should be severity' );
	} );


	//=================================================================
	// Severity convenience functions
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should use correct severity for each level', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		ASSERT.ok( log.Trace( 'x' ).indexOf( 'trace' ) > -1 );
		ASSERT.ok( log.Debug( 'x' ).indexOf( 'debug' ) > -1 );
		ASSERT.ok( log.Info( 'x' ).indexOf( 'info' ) > -1 );
		ASSERT.ok( log.Warn( 'x' ).indexOf( 'warn' ) > -1 );
		ASSERT.ok( log.Error( 'x' ).indexOf( 'error' ) > -1 );
	} );


	//=================================================================
	// Value stringification
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should stringify null and undefined', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		ASSERT.ok( log.Info( null ).indexOf( 'null' ) > -1 );
		ASSERT.ok( log.Info( undefined ).indexOf( 'undefined' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should stringify objects as JSON', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		var result = log.Info( { Key: 'Value' } );
		ASSERT.ok( result.indexOf( 'Key' ) > -1 );
		ASSERT.ok( result.indexOf( 'Value' ) > -1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should stringify numbers', function ()
	{
		var log = Logger.CreateLogger( { Silent: true } );
		var result = log.Info( 42 );
		ASSERT.ok( result.indexOf( '42' ) > -1 );
	} );


	//=================================================================
	// DEFAULT_COLORS export
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should export DEFAULT_COLORS', function ()
	{
		ASSERT.ok( Logger.DEFAULT_COLORS, 'should have DEFAULT_COLORS' );
		ASSERT.ok( Logger.DEFAULT_COLORS.trace, 'should have trace color' );
		ASSERT.ok( Logger.DEFAULT_COLORS.error, 'should have error color' );
	} );


} );
