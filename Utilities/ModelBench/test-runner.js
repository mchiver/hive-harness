/*
	test-runner.js
---------------------------------------------------------------------
Loads and executes benchmark test modules against LLM models.
Provides a mock test harness that captures results instead of
using node:test, so tests can run inside the TUI.
*/

const PATH = require( 'path' );
const ASSERT = require( 'node:assert/strict' );
const FS = require( 'fs' );

var TESTS_FOLDER = PATH.join( __dirname, 'tests' );
var USERNAME = 'benchuser';


//=====================================================================
class TestRunner
{


	//---------------------------------------------------------------------
	constructor( Hive, ResultsStore, LogFn )
	{
		this.hive = Hive;
		this.results_store = ResultsStore;
		this.log = LogFn || function () {};
		this.test_modules = [];
		this.cancelled = false;
		this.running = false;
	}


	//---------------------------------------------------------------------
	// Load all test modules from the tests/ folder.
	// Scans subdirectories as groups. Builds both test_groups (tree)
	// and test_modules (flat, with group-qualified names).
	LoadTests()
	{
		this.test_groups = [];
		this.test_modules = [];

		var entries = FS.readdirSync( TESTS_FOLDER, { withFileTypes: true } );
		var group_dirs = entries
			.filter( function ( e ) { return e.isDirectory(); } )
			.map( function ( e ) { return e.name; } )
			.sort();

		for ( var g = 0; g < group_dirs.length; g++ )
		{
			var group_name = group_dirs[ g ];
			var group_path = PATH.join( TESTS_FOLDER, group_name );
			var files = FS.readdirSync( group_path )
				.filter( function ( f ) { return f.endsWith( '.js' ); } )
				.sort();

			var group = { Name: group_name, Tests: [] };

			for ( var f = 0; f < files.length; f++ )
			{
				var file = files[ f ];
				var test_name = file.replace( /\.js$/, '' );
				var module_path = PATH.join( group_path, file );
				var test_module = require( module_path );

				var entry = {
					Name: group_name + '/' + test_name,
					Group: group_name,
					TestName: test_name,
					Module: test_module,
				};

				group.Tests.push( { Name: test_name, Module: test_module } );
				this.test_modules.push( entry );
			}

			this.test_groups.push( group );
		}

		return this.test_groups;
	}


	//---------------------------------------------------------------------
	// Get test names for display (group-qualified).
	GetTestNames()
	{
		return this.test_modules.map( function ( t ) { return t.Name; } );
	}


	//---------------------------------------------------------------------
	// Get test groups for TUI display.
	GetTestGroups()
	{
		return this.test_groups.map( function ( g )
		{
			return {
				Name: g.Name,
				Tests: g.Tests.map( function ( t ) { return { Name: t.Name }; } ),
			};
		} );
	}


	//---------------------------------------------------------------------
	// Run a single test module against a model.
	// Returns { TestName, Passed, DurationMs, Error, Details }
	async RunTest( Model, TestModule )
	{
		var self = this;
		var model_id = sanitize_model_name( Model.ModelName );
		var llm_entity_name = 'bench-' + model_id;

		// Collect test cases from the module
		var test_cases = [];
		var before_fn = null;
		var after_fn = null;

		var mock_test = {
			describe: function ( Name, Fn ) { Fn(); },
			before: function ( Fn ) { before_fn = Fn; },
			after: function ( Fn ) { after_fn = Fn; },
			beforeEach: function () {},
			afterEach: function () {},
			it: function ( Name, Fn ) { test_cases.push( { Name: Name, Fn: Fn } ); },
		};

		// Build context matching what Tests/ModelTests expects
		var context = {
			Model: Model,
			LlmEntityName: llm_entity_name,
			TestConfig: { Username: USERNAME },
			Hive: self.hive,
		};

		// Create LLM entity for this model
		try
		{
			await self.hive.InvokeTool( 'Llm.ConfigEntity', {
				EntityName: llm_entity_name,
				Settings: {
					Platform: Model.Platform,
					ModelName: Model.ModelName,
					ModelTemperature: Model.ModelTemperature || 0,
					ContextSize: Model.ContextSize || 8192,
					CanEmbed: Model.CanEmbed || false,
				},
			} );
		}
		catch ( error )
		{
			return {
				TestName: TestModule.Name,
				TestShortName: TestModule.TestName || TestModule.Name,
				TestGroup: TestModule.Group || '',
				Passed: false,
				DurationMs: 0,
				Error: 'Failed to create LLM entity: ' + error.message,
				Details: {},
			};
		}

		// Register test cases by calling the module
		try
		{
			TestModule.Module( mock_test, ASSERT, context );
		}
		catch ( error )
		{
			await cleanup_llm_entity( self.hive, llm_entity_name );
			return {
				TestName: TestModule.Name,
				TestShortName: TestModule.TestName || TestModule.Name,
				TestGroup: TestModule.Group || '',
				Passed: false,
				DurationMs: 0,
				Error: 'Failed to register test cases: ' + error.message,
				Details: {},
			};
		}

		// Run before hook
		if ( before_fn )
		{
			try { await before_fn(); }
			catch ( error )
			{
				self.log( '  before hook failed: ' + error.message );
			}
		}

		// Install an InvokeTool wrapper to capture Conversation.Chat interchanges
		var interchange = [];
		var original_invoke = self.hive.InvokeTool.bind( self.hive );
		self.hive.InvokeTool = async function ( ToolName, Arguments )
		{
			var result = await original_invoke( ToolName, Arguments );

			if ( ToolName === 'Conversation.Chat' && result.Success && result.Result )
			{
				var chat_result = result.Result;
				var entry = {
					Text: Arguments.Text || '',
					Prompt: chat_result.Prompt || '',
					Response: chat_result.Response || '',
					ToolCalls: ( chat_result.ToolCalls || [] ).map( function ( tc )
					{
						return {
							Tool: tc.Tool,
							Arguments: tc.Arguments,
							Success: tc.Success,
							Result: tc.Result,
							Error: tc.Error,
							Duration: tc.Duration,
						};
					} ),
				};
				interchange.push( entry );
			}

			return result;
		};

		// Execute each test case
		var all_passed = true;
		var total_duration = 0;
		var case_results = [];
		var first_error = null;

		for ( var index = 0; index < test_cases.length; index++ )
		{
			var test_case = test_cases[ index ];
			var case_start = Date.now();
			var case_passed = false;
			var case_error = null;

			try
			{
				await test_case.Fn();
				case_passed = true;
			}
			catch ( error )
			{
				case_passed = false;
				case_error = error.message;
				if ( !first_error ) { first_error = case_error; }
			}

			var case_duration = Date.now() - case_start;
			total_duration += case_duration;

			case_results.push( {
				Name: test_case.Name,
				Passed: case_passed,
				DurationMs: case_duration,
				Error: case_error,
			} );

			if ( !case_passed ) { all_passed = false; }

			var status_label = case_passed ? 'PASS' : 'FAIL';
			var duration_label = ( case_duration / 1000 ).toFixed( 1 ) + 's';
			self.log( '  ' + status_label + '  ' + test_case.Name + '  (' + duration_label + ')' );
			if ( case_error )
			{
				self.log( '    Error: ' + case_error );
			}
		}

		// Restore original InvokeTool
		self.hive.InvokeTool = original_invoke;

		// Run after hook
		if ( after_fn )
		{
			try { await after_fn(); }
			catch ( error )
			{
				self.log( '  after hook failed: ' + error.message );
			}
		}

		// Cleanup LLM entity
		await cleanup_llm_entity( self.hive, llm_entity_name );

		return {
			TestName: TestModule.Name,
			TestShortName: TestModule.TestName || TestModule.Name,
			TestGroup: TestModule.Group || '',
			Passed: all_passed,
			DurationMs: total_duration,
			Error: first_error,
			Details: { Cases: case_results },
			Interchange: interchange,
		};
	}


	//---------------------------------------------------------------------
	// Run all tests (or a subset) against a model.
	// OnProgress( result, index, total ) is called after each test completes.
	async RunAll( Model, TestIndices, OnProgress )
	{
		this.cancelled = false;
		this.running = true;
		var results = [];

		var modules_to_run = [];
		if ( TestIndices && TestIndices.length > 0 )
		{
			for ( var i = 0; i < TestIndices.length; i++ )
			{
				modules_to_run.push( this.test_modules[ TestIndices[ i ] ] );
			}
		}
		else
		{
			modules_to_run = this.test_modules.slice();
		}

		this.log( 'Running ' + modules_to_run.length + ' tests on ' + Model.ModelName );
		this.log( 'Platform: ' + Model.Platform + '  Params: ' + ( Model.ModelParameters || '?' ) + 'B' );
		this.log( '' );

		var run_start = Date.now();

		for ( var index = 0; index < modules_to_run.length; index++ )
		{
			if ( this.cancelled ) { break; }

			var test_module = modules_to_run[ index ];
			this.log( 'Running ' + test_module.Name + ' ...' );

			var result = await this.RunTest( Model, test_module );
			results.push( result );

			// Save to database
			this.results_store.SaveResult( {
				Platform: Model.Platform,
				ModelName: Model.ModelName,
				TestGroup: result.TestGroup,
				TestName: result.TestShortName,
				DurationMs: result.DurationMs,
				Passed: result.Passed,
				Result: result.Details,
			} );

			if ( OnProgress )
			{
				OnProgress( result, index, modules_to_run.length );
			}
		}

		var run_duration = ( ( Date.now() - run_start ) / 1000 ).toFixed( 1 );
		var passed_count = results.filter( function ( r ) { return r.Passed; } ).length;

		this.log( '' );
		this.log( 'Completed: ' + passed_count + '/' + results.length + ' passed  (' + run_duration + 's total)' );

		this.running = false;
		return results;
	}


	//---------------------------------------------------------------------
	// Run all tests in a specific group.
	// OnProgress( result, index, total ) is called after each test completes.
	async RunGroup( Model, GroupName, OnProgress )
	{
		var group_modules = this.test_modules.filter( function ( t )
		{
			return t.Group === GroupName;
		} );

		if ( group_modules.length === 0 )
		{
			this.log( 'No tests found in group: ' + GroupName );
			return [];
		}

		this.cancelled = false;
		this.running = true;
		var results = [];

		this.log( 'Running ' + group_modules.length + ' tests in ' + GroupName + ' on ' + Model.ModelName );
		this.log( '' );

		var run_start = Date.now();

		for ( var index = 0; index < group_modules.length; index++ )
		{
			if ( this.cancelled ) { break; }

			var test_module = group_modules[ index ];
			this.log( 'Running ' + test_module.Name + ' ...' );

			var result = await this.RunTest( Model, test_module );
			results.push( result );

			// Save to database
			this.results_store.SaveResult( {
				Platform: Model.Platform,
				ModelName: Model.ModelName,
				TestGroup: result.TestGroup,
				TestName: result.TestShortName,
				DurationMs: result.DurationMs,
				Passed: result.Passed,
				Result: result.Details,
			} );

			if ( OnProgress )
			{
				OnProgress( result, index, group_modules.length );
			}
		}

		var run_duration = ( ( Date.now() - run_start ) / 1000 ).toFixed( 1 );
		var passed_count = results.filter( function ( r ) { return r.Passed; } ).length;

		this.log( '' );
		this.log( 'Completed: ' + passed_count + '/' + results.length + ' passed  (' + run_duration + 's total)' );

		this.running = false;
		return results;
	}


	//---------------------------------------------------------------------
	Cancel()
	{
		this.cancelled = true;
	}


}


//---------------------------------------------------------------------
function sanitize_model_name( ModelName )
{
	return ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
}


//---------------------------------------------------------------------
async function cleanup_llm_entity( Hive, EntityName )
{
	try
	{
		await Hive.InvokeTool( 'Llm.DeleteEntity', { EntityName: EntityName } );
	}
	catch ( error ) { /* ignore */ }
}


module.exports = TestRunner;
