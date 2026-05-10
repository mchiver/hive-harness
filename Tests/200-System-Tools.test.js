
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const PACKAGE = require( PATH.join( HIVEJS_PROJECT_ROOT, 'package.json' ) );
const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );


//---------------------------------------------------------------------
TEST.describe( 'System Tool Tests', function ()
{


	//-----------------------------------------------------------------
	async function open_hive()
	{
		var registry = await Registry.Open( TEST_REGISTRY_PATH );
		var hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );
		return hive;
	}


	//=================================================================
	// Info
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return hive info', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.Info', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.HiveRoot, TEST_HIVE_ROOT );
		ASSERT.strictEqual( result.Result.UserName, TEST_CONFIG.Username );
		ASSERT.strictEqual( result.Result.UserRole, 'admin' );
		ASSERT.strictEqual( result.Result.Version, PACKAGE.version );
	} );


	//=================================================================
	// ListPlugins
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list loaded plugins', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListPlugins', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Plugins ), 'Plugins should be an array' );

		var names = result.Result.Plugins.map( function ( p ) { return p.PluginName; } );
		ASSERT.ok( names.includes( 'System' ), 'should include System plugin' );
		ASSERT.ok( names.includes( 'Workspace' ), 'should include Workspace plugin' );
		ASSERT.ok( names.includes( 'KeyStore' ), 'should include KeyStore plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should include tool counts per plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListPlugins', {} );

		var system_plugin = result.Result.Plugins.find( function ( p ) { return p.PluginName === 'System'; } );
		ASSERT.ok( system_plugin, 'System plugin should be in the list' );
		ASSERT.strictEqual( system_plugin.ToolCount, 5, 'System should have 5 tools' );
	} );


	//=================================================================
	// ListTools
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list all tools', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListTools', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Tools ), 'Tools should be an array' );
		ASSERT.ok( result.Result.Tools.length > 3, 'should list tools from multiple plugins' );

		// Verify tools span multiple plugins
		var plugin_names = [ ...new Set( result.Result.Tools.map( function ( t ) { return t.PluginName; } ) ) ];
		ASSERT.ok( plugin_names.length > 1, 'should include tools from more than one plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should filter tools by plugin name', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListTools', {
			PluginName: 'System',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Tools.length, 5, 'System should have 5 tools' );

		var tool_names = result.Result.Tools.map( function ( t ) { return t.ToolName; } );
		ASSERT.ok( tool_names.includes( 'Info' ), 'should include Info' );
		ASSERT.ok( tool_names.includes( 'ListPlugins' ), 'should include ListPlugins' );
		ASSERT.ok( tool_names.includes( 'ListTools' ), 'should include ListTools' );
		ASSERT.ok( tool_names.includes( 'GetPluginDocumentation' ), 'should include GetPluginDocumentation' );
		ASSERT.ok( tool_names.includes( 'RunTools' ), 'should include RunTools' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should include parameter and return schemas', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListTools', {
			PluginName: 'System',
		} );

		var info_tool = result.Result.Tools.find( function ( t ) { return t.ToolName === 'Info'; } );
		ASSERT.ok( info_tool, 'Info tool should be in the list' );
		ASSERT.ok( info_tool.Parameters, 'should have Parameters schema' );
		ASSERT.ok( info_tool.Returns, 'should have Returns schema' );
		ASSERT.strictEqual( info_tool.Parameters.type, 'object' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty array for unknown plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListTools', {
			PluginName: 'NonExistentPlugin',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Tools.length, 0, 'should return empty array' );
	} );


	//=================================================================
	// GetPluginDocumentation
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return documentation for a known plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.GetPluginDocumentation', {
			PluginName: 'System',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Content.length > 0, 'should have content' );
		ASSERT.ok( result.Result.Content.indexOf( '# System Plugin Reference' ) > -1,
			'should contain the reference doc heading' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return error for unknown plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.GetPluginDocumentation', {
			PluginName: 'NonExistentPlugin',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( 'not found' ) > -1 );
	} );


	//=================================================================
	// RunTools
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should run multiple tools and return results', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
				{ PluginName: 'System', ToolName: 'ListPlugins', Arguments: {} },
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Results.length, 2, 'should have 2 results' );

		ASSERT.strictEqual( result.Result.Results[ 0 ].PluginName, 'System' );
		ASSERT.strictEqual( result.Result.Results[ 0 ].ToolName, 'Info' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'first call should succeed' );
		ASSERT.ok( result.Result.Results[ 0 ].Result.HiveRoot, 'first call should have HiveRoot' );

		ASSERT.strictEqual( result.Result.Results[ 1 ].PluginName, 'System' );
		ASSERT.strictEqual( result.Result.Results[ 1 ].ToolName, 'ListPlugins' );
		ASSERT.ok( result.Result.Results[ 1 ].Success, 'second call should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Results[ 1 ].Result.Plugins ), 'second call should have Plugins' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should continue on error by default', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
				{ PluginName: 'NoSuchPlugin', ToolName: 'Fake', Arguments: {} },
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Results.length, 3, 'should have 3 results' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'first call should succeed' );
		ASSERT.ok( !result.Result.Results[ 1 ].Success, 'second call should fail' );
		ASSERT.ok( result.Result.Results[ 1 ].Error, 'second call should have error message' );
		ASSERT.ok( result.Result.Results[ 2 ].Success, 'third call should still succeed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should stop on error when ExitOnError is true', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
				{ PluginName: 'NoSuchPlugin', ToolName: 'Fake', Arguments: {}, ExitOnError: true },
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Results.length, 2, 'should stop after the failed call' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'first call should succeed' );
		ASSERT.ok( !result.Result.Results[ 1 ].Success, 'second call should fail' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return empty results for empty ToolCalls', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Results.length, 0, 'should have 0 results' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should accept an array of command strings', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				'System.Info',
				'System.ListPlugins',
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Results.length, 2, 'should have 2 results' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'first call should succeed' );
		ASSERT.strictEqual( result.Result.Results[ 0 ].PluginName, 'System' );
		ASSERT.strictEqual( result.Result.Results[ 0 ].ToolName, 'Info' );
		ASSERT.ok( result.Result.Results[ 1 ].Success, 'second call should succeed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should accept a newline-delimited text block', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: 'System.Info\nSystem.ListPlugins',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.Results.length, 2, 'should have 2 results' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'first call should succeed' );
		ASSERT.ok( result.Result.Results[ 1 ].Success, 'second call should succeed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should parse arguments from command strings', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				'System.ListTools --PluginName System',
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( result.Result.Results[ 0 ].Success, 'call should succeed' );
		ASSERT.strictEqual( result.Result.Results[ 0 ].Result.Tools.length, 5, 'System should have 5 tools' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should allow mixed object and string entries in array', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: [
				{ PluginName: 'System', ToolName: 'Info', Arguments: {} },
				'System.ListPlugins',
			],
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Results.length, 2 );
		ASSERT.ok( result.Result.Results[ 0 ].Success );
		ASSERT.ok( result.Result.Results[ 1 ].Success );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should skip blank lines in text block', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.RunTools', {
			ToolCalls: '\nSystem.Info\n\n\nSystem.ListPlugins\n',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.strictEqual( result.Result.Results.length, 2, 'should have 2 results, ignoring blank lines' );
	} );


} );
