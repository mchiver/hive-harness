
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const PACKAGE = require( PATH.join( HIVEJS_PROJECT_ROOT, 'package.json' ) );
const TestHive = require( './TestHive.js' );


//---------------------------------------------------------------------
TEST.describe( 'System Tool Tests', function ()
{


	//-----------------------------------------------------------------
	async function open_hive()
	{
		var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );
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
		ASSERT.strictEqual( result.Result.HiveRoot, TestHive.HIVE_ROOT );
		ASSERT.strictEqual( result.Result.UserName, TestHive.TESTUSER_NAME );
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
		ASSERT.strictEqual( system_plugin.ToolCount, 8, 'System should have 8 tools' );
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
		ASSERT.strictEqual( result.Result.Tools.length, 8, 'System should have 8 tools' );

		var tool_names = result.Result.Tools.map( function ( t ) { return t.ToolName; } );
		ASSERT.ok( tool_names.includes( 'Info' ), 'should include Info' );
		ASSERT.ok( tool_names.includes( 'ListPlugins' ), 'should include ListPlugins' );
		ASSERT.ok( tool_names.includes( 'ListTools' ), 'should include ListTools' );
		ASSERT.ok( tool_names.includes( 'GetPluginDocumentation' ), 'should include GetPluginDocumentation' );
		ASSERT.ok( tool_names.includes( 'RunTools' ), 'should include RunTools' );
		ASSERT.ok( tool_names.includes( 'ListAvailablePlugins' ), 'should include ListAvailablePlugins' );
		ASSERT.ok( tool_names.includes( 'InstallPlugin' ), 'should include InstallPlugin' );
		ASSERT.ok( tool_names.includes( 'UninstallPlugin' ), 'should include UninstallPlugin' );
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
		ASSERT.strictEqual( result.Result.Results[ 0 ].Result.Tools.length, 8, 'System should have 8 tools' );
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


	//=================================================================
	// ListAvailablePlugins
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should list available plugins from the catalog', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListAvailablePlugins', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.ok( Array.isArray( result.Result.Plugins ), 'Plugins should be an array' );

		var exchange_entry = result.Result.Plugins.find( function ( p ) { return p.PluginName === 'Exchange'; } );
		if ( exchange_entry )
		{
			ASSERT.strictEqual( exchange_entry.PluginUrl, 'https://github.com/mchiver/hive-plugin-exchange.git', 'should have correct URL' );
			ASSERT.strictEqual( exchange_entry.RequiredRole, 'user', 'should have correct role' );
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should mark installed plugins as IsInstalled', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.ListAvailablePlugins', {} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );

		var system_entry = result.Result.Plugins.find( function ( p ) { return p.PluginName === 'System'; } );
		if ( system_entry )
		{
			ASSERT.strictEqual( system_entry.IsInstalled, true, 'System should be marked installed' );
		}
	} );


	//=================================================================
	// InstallPlugin
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should install Exchange from local sibling repo in development', async function ()
	{
		var hive = await open_hive();

		// Ensure Exchange is not installed in the test registry
		var exchange_link = PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange', 'plugin.link.json' );
		if ( await hive.Helpers.FileUtils.FileExists( exchange_link ) )
		{
			await hive.Helpers.FileUtils.DeleteFolder( PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange' ), true );
		}

		var result = await hive.InvokeTool( 'System.InstallPlugin', {
			PluginName: 'Exchange',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.PluginName, 'Exchange', 'should return Exchange' );
		ASSERT.ok( result.Result.Path, 'should return a path' );

		// Verify the plugin.link.json was created
		var link_exists = await hive.Helpers.FileUtils.FileExists( exchange_link );
		ASSERT.ok( link_exists, 'plugin.link.json should exist after install' );

		// Cleanup
		await hive.Helpers.FileUtils.DeleteFolder( PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange' ), true );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should fail to install an already-installed plugin', async function ()
	{
		var hive = await open_hive();

		// Ensure Exchange is installed first
		var exchange_folder = PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange' );
		var exchange_link = PATH.join( exchange_folder, 'plugin.link.json' );
		if ( !await hive.Helpers.FileUtils.FileExists( exchange_link ) )
		{
			var install_result = await hive.InvokeTool( 'System.InstallPlugin', {
				PluginName: 'Exchange',
			} );
			ASSERT.ok( install_result.Success, 'precondition: Exchange should install successfully' );
		}

		var result = await hive.InvokeTool( 'System.InstallPlugin', {
			PluginName: 'Exchange',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( 'already installed' ) > -1, 'error should mention already installed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should fail to install an unknown plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.InstallPlugin', {
			PluginName: 'NonExistentPlugin',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( 'not found' ) > -1, 'error should mention not found' );
	} );


	//=================================================================
	// UninstallPlugin
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should uninstall an installed plugin', async function ()
	{
		var hive = await open_hive();

		// Install first
		var exchange_link = PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange', 'plugin.link.json' );
		if ( await hive.Helpers.FileUtils.FileExists( exchange_link ) )
		{
			await hive.Helpers.FileUtils.DeleteFolder( PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange' ), true );
		}

		var install_result = await hive.InvokeTool( 'System.InstallPlugin', {
			PluginName: 'Exchange',
		} );
		ASSERT.ok( install_result.Success, 'precondition: install should succeed' );

		// Now uninstall
		var result = await hive.InvokeTool( 'System.UninstallPlugin', {
			PluginName: 'Exchange',
		} );

		ASSERT.ok( !result.Error, result.Error );
		ASSERT.ok( result.Success, 'should succeed' );

		// Verify the folder is gone
		var folder_exists = await hive.Helpers.FileUtils.FolderExists( PATH.join( TestHive.REGISTRY_PATH, 'Plugins', 'Exchange' ) );
		ASSERT.ok( !folder_exists, 'Exchange folder should be removed' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should fail to uninstall a non-existent plugin', async function ()
	{
		var hive = await open_hive();

		var result = await hive.InvokeTool( 'System.UninstallPlugin', {
			PluginName: 'NonExistentPlugin',
		} );

		ASSERT.ok( result.Error, 'should return an error' );
		ASSERT.ok( result.Error.indexOf( 'not installed' ) > -1, 'error should mention not installed' );
	} );


} );
