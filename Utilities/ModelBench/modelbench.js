/*
	modelbench.js
---------------------------------------------------------------------
ModelBench - TUI application for benchmarking LLM models.
Bootstraps a Hive instance, loads model definitions, and provides
an interactive interface for running capability tests.

Usage: node Utilities/ModelBench/modelbench.js
*/

const PATH = require( 'path' );
const FS = require( 'fs' ).promises;

var PROJECT_ROOT = PATH.join( __dirname, '..', '..' );
var Registry = require( PATH.join( PROJECT_ROOT, 'Source', 'Registry.js' ) );
var Hive = require( PATH.join( PROJECT_ROOT, 'Source', 'Hive.js' ) );
var FileUtils = require( PATH.join( PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );

var ResultsStore = require( './results-store.js' );
var TestRunner = require( './test-runner.js' );
var CreateTui = require( './tui.js' );


//---------------------------------------------------------------------
// Paths
//---------------------------------------------------------------------

var BENCH_DATA = PATH.join( __dirname, '~data' );
var REGISTRY_PATH = PATH.join( BENCH_DATA, 'Registry' );
var HIVE_ROOT = PATH.join( BENCH_DATA, 'Data' );
var DB_PATH = PATH.join( BENCH_DATA, 'results.db' );
var MODELS_PATH = PATH.join( __dirname, 'models.json' );

var USERNAME = 'benchuser';
var PASSWORD = 'bench123';

// Plugins required for running tests
var REQUIRED_PLUGINS = [ 'System', 'Test', 'Conversation', 'Llm', 'Workflow' ];


//---------------------------------------------------------------------
// Ensure the registry folder structure exists with plugin links.
//---------------------------------------------------------------------

async function ensure_registry()
{
	var config_path = PATH.join( REGISTRY_PATH, 'registry.config.json' );
	if ( await FileUtils.FileExists( config_path ) )
	{
		return;
	}

	// Create folder structure
	await FileUtils.EnsureFolder( REGISTRY_PATH );
	await FileUtils.EnsureFolder( PATH.join( REGISTRY_PATH, 'Users' ) );
	await FileUtils.EnsureFolder( PATH.join( REGISTRY_PATH, 'Plugins' ) );

	// Write registry config
	await FileUtils.WriteJson( config_path, {
		Version: '1.0.0',
		DefaultRole: 'guest',
	} );

	// Write bench user (same hash as testuser for password 'bench123')
	// Generated via: bcrypt.hashSync( 'bench123', 10 )
	var BCRYPT = require( 'bcrypt' );
	var password_hash = BCRYPT.hashSync( PASSWORD, 10 );

	await FileUtils.WriteJson( PATH.join( REGISTRY_PATH, 'Users', USERNAME + '.json' ), {
		Name: 'Bench User',
		Description: 'ModelBench test runner',
		Role: 'admin',
		PasswordHash: password_hash,
	} );

	// Create plugin links
	for ( var index = 0; index < REQUIRED_PLUGINS.length; index++ )
	{
		var plugin_name = REQUIRED_PLUGINS[ index ];
		var plugin_folder = PATH.join( REGISTRY_PATH, 'Plugins', plugin_name );
		await FileUtils.EnsureFolder( plugin_folder );

		var plugin_path = PATH.join( PROJECT_ROOT, 'Plugins', plugin_name );
		// Normalize to forward slashes for consistency
		var normalized_path = plugin_path.replace( /\\/g, '/' );

		await FileUtils.WriteJson( PATH.join( plugin_folder, 'plugin.link.json' ), {
			Path: normalized_path,
		} );
	}
}


//---------------------------------------------------------------------
// Main
//---------------------------------------------------------------------

async function main()
{
	// Ensure data folders exist
	await FileUtils.EnsureFolder( BENCH_DATA );
	await FileUtils.EnsureFolder( HIVE_ROOT );
	await ensure_registry();

	// Open results database
	var results_store = new ResultsStore();
	results_store.Open( DB_PATH );

	// Open Hive
	var registry = await Registry.Open( REGISTRY_PATH );
	var hive = await Hive.Open( registry, HIVE_ROOT, USERNAME, PASSWORD );

	// Load models
	var models = [];
	if ( await FileUtils.FileExists( MODELS_PATH ) )
	{
		models = await FileUtils.ReadJson( MODELS_PATH );
	}

	// Create test runner (log function will be wired after TUI creation)
	var log_fn = function () {};
	var test_runner = new TestRunner( hive, results_store, log_fn );
	test_runner.LoadTests();

	var test_groups = test_runner.GetTestGroups();
	var test_names = test_runner.GetTestNames();

	// Create TUI
	var tui = CreateTui( {
		Models: models,
		TestGroups: test_groups,

		//-------------------------------------------------------------
		OnRunTest: async function ( ModelIndex, GroupName, TestName )
		{
			if ( test_runner.running )
			{
				tui.Log( 'Tests already running. Press x to cancel.' );
				return;
			}

			var model = models[ ModelIndex ];
			if ( !model ) { return; }

			var full_name = GroupName + '/' + TestName;

			// Find the test module
			var test_module = null;
			for ( var i = 0; i < test_runner.test_modules.length; i++ )
			{
				if ( test_runner.test_modules[ i ].Name === full_name )
				{
					test_module = test_runner.test_modules[ i ];
					break;
				}
			}
			if ( !test_module ) { return; }

			tui.SetTestStatus( full_name, 'running', 0 );

			test_runner.running = true;
			tui.Log( 'Running ' + full_name + ' on ' + model.ModelName + ' ...' );

			var result = await test_runner.RunTest( model, test_module );

			// Save result
			results_store.SaveResult( {
				Platform: model.Platform,
				ModelName: model.ModelName,
				TestGroup: result.TestGroup,
				TestName: result.TestShortName,
				DurationMs: result.DurationMs,
				Passed: result.Passed,
				Result: result.Details,
			} );

			var status = result.Passed ? 'pass' : 'fail';
			tui.SetTestStatus( full_name, status, result.DurationMs );
			tui.SetTestInterchange( result.TestName, result.Interchange );
			test_runner.running = false;
		},

		//-------------------------------------------------------------
		OnRunGroup: async function ( ModelIndex, GroupName )
		{
			if ( test_runner.running )
			{
				tui.Log( 'Tests already running. Press x to cancel.' );
				return;
			}

			var model = models[ ModelIndex ];
			if ( !model ) { return; }

			// Mark group tests as pending
			for ( var i = 0; i < test_runner.test_modules.length; i++ )
			{
				if ( test_runner.test_modules[ i ].Group === GroupName )
				{
					tui.SetTestStatus( test_runner.test_modules[ i ].Name, 'pending', 0 );
				}
			}

			await test_runner.RunGroup( model, GroupName, function ( Result, Index, Total )
			{
				var status = Result.Passed ? 'pass' : 'fail';
				tui.SetTestStatus( Result.TestName, status, Result.DurationMs );
				tui.SetTestInterchange( Result.TestName, Result.Interchange );
			} );
		},

		//-------------------------------------------------------------
		OnRunAll: async function ( ModelIndex )
		{
			if ( test_runner.running )
			{
				tui.Log( 'Tests already running. Press x to cancel.' );
				return;
			}

			var model = models[ ModelIndex ];
			if ( !model ) { return; }

			tui.ResetTestStatuses();

			await test_runner.RunAll( model, null, function ( Result, Index, Total )
			{
				var status = Result.Passed ? 'pass' : 'fail';
				tui.SetTestStatus( Result.TestName, status, Result.DurationMs );
				tui.SetTestInterchange( Result.TestName, Result.Interchange );
			} );
		},

		//-------------------------------------------------------------
		OnCompare: function ()
		{
			var comparison = results_store.GetComparisonData();
			tui.ShowComparison( comparison );
		},

		//-------------------------------------------------------------
		OnResults: function ( ModelIndex )
		{
			var model = models[ ModelIndex ];
			if ( !model ) { return; }

			var rows = results_store.GetModelResults( model.Platform, model.ModelName );
			tui.ShowResults( rows );
		},

		//-------------------------------------------------------------
		OnCancel: function ()
		{
			if ( test_runner.running )
			{
				test_runner.Cancel();
				tui.Log( 'Cancelling...' );
			}
		},

		//-------------------------------------------------------------
		OnClear: function ()
		{
			results_store.ClearResults();
		},
	} );

	// Wire log function to TUI
	log_fn = tui.Log;
	test_runner.log = tui.Log;

	tui.Log( 'ModelBench ready. ' + models.length + ' models loaded, ' + test_names.length + ' tests available.' );
}


//---------------------------------------------------------------------
// Entry point
//---------------------------------------------------------------------

main().catch( function ( error )
{
	console.error( 'ModelBench failed to start:', error.message );
	console.error( error.stack );
	process.exit( 1 );
} );
