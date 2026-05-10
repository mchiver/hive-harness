
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );
const FS = require( 'fs' ).promises;
const HTTP = require( 'http' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Registry = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Registry.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const EXPRESS = require( 'express' );

const TEST_CONFIG = require( PATH.join( __dirname, '.test-data', 'test-config.json' ) );
const TEST_REGISTRY_PATH = PATH.join( __dirname, '.test-data', 'Registry' );
const TEST_HIVE_ROOT = PATH.join( __dirname, '.test-data', 'Data' );
const CONVERSATION_DATA_PATH = PATH.join( TEST_HIVE_ROOT, '.hive', 'Entities', TEST_CONFIG.Username, 'Conversation' );


//---------------------------------------------------------------------
// Helper: HTTP request against the test server
function request( Options, Body )
{
	return new Promise( function ( resolve, reject )
	{
		var req = HTTP.request( Options, function ( res )
		{
			var chunks = [];
			res.on( 'data', function ( chunk ) { chunks.push( chunk ); } );
			res.on( 'end', function ()
			{
				var raw = Buffer.concat( chunks ).toString();
				var json = null;
				try { json = JSON.parse( raw ); }
				catch ( e ) { json = null; }
				resolve( { Status: res.statusCode, Headers: res.headers, Body: raw, Json: json } );
			} );
		} );
		req.on( 'error', reject );
		if ( Body )
		{
			req.write( typeof Body === 'string' ? Body : JSON.stringify( Body ) );
		}
		req.end();
	} );
}


//---------------------------------------------------------------------
TEST.describe( 'Web Channel Tests', function ()
{
	var server;
	var port;
	var registry;
	var hive;
	var token;


	//-------------------------------------------------------------
	TEST.before( async function ()
	{
		// Open registry and hive
		registry = await Registry.Open( TEST_REGISTRY_PATH );
		hive = await Hive.Open( registry, TEST_HIVE_ROOT, TEST_CONFIG.Username, TEST_CONFIG.Password );

		// Build Express app (same as Web.js but without WebChannel class)
		var Channel = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Channel.js' ) );
		var channel = {
			Registry: registry,
			Hive: hive,
			SseClients: new Map(),
			GetSuggestions: Channel.prototype.GetSuggestions,
		};

		var AuthMiddleware = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Middleware', 'Auth.js' ) );

		var app = EXPRESS();
		app.use( EXPRESS.json() );
		app.use( AuthMiddleware( channel ) );

		// Per-request Hive wrapper (same shape as Web.js).
		app.use( function ( req, res, next )
		{
			if ( req.User )
			{
				req.Hive = Hive.ForUser( hive.Runtime, {
					UserName: req.User.Username,
					UserRole: req.User.Role,
					Token: req.User.Token || '',
				} );
			}
			else
			{
				req.Hive = hive;
			}
			next();
		} );

		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Auth.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'System.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Entities.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Chat.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Conversations.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Tools.js' ) )( app, channel );
		require( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'Routes', 'Suggest.js' ) )( app, channel );

		// Static files
		app.use( EXPRESS.static( PATH.join( HIVEJS_PROJECT_ROOT, 'Channels', 'Web', 'public' ) ) );

		// Start on random port
		await new Promise( function ( resolve )
		{
			server = app.listen( 0, function ()
			{
				port = server.address().port;
				resolve();
			} );
		} );
	} );


	TEST.after( async function ()
	{
		// Shutdown server
		if ( server )
		{
			await new Promise( function ( resolve ) { server.close( resolve ); } );
		}
		// Clean up conversation entities
		try { await FS.rm( CONVERSATION_DATA_PATH, { recursive: true, force: true } ); }
		catch {}
	} );


	//=================================================================
	// Auth
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should reject requests without a token', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/system/info',
			method: 'GET',
		} );
		ASSERT.strictEqual( res.Status, 401 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject login with bad credentials', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/auth/login',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		}, { Username: TEST_CONFIG.Username, Password: 'wrongpassword' } );
		ASSERT.strictEqual( res.Status, 401 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should login with valid credentials', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/auth/login',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		}, { Username: TEST_CONFIG.Username, Password: TEST_CONFIG.Password } );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Json.Token, 'should return a token' );
		ASSERT.strictEqual( res.Json.UserName, TEST_CONFIG.Username );
		ASSERT.ok( res.Json.UserRole, 'should return a role' );

		// Store token for subsequent tests
		token = res.Json.Token;
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return user info via /api/auth/me', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/auth/me',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.strictEqual( res.Json.UserName, TEST_CONFIG.Username );
	} );


	//=================================================================
	// System
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return system info', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/system/info',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Json, 'should return system info object' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list plugins', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/system/plugins',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( Array.isArray( res.Json.Plugins ), 'should return array of plugins' );
		ASSERT.ok( res.Json.Plugins.length > 0, 'should have at least one plugin' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list tools', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/system/tools',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( Array.isArray( res.Json.Tools ), 'should return array of tools' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should list tools filtered by plugin', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/system/tools?plugin=System',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( Array.isArray( res.Json.Tools ) );
		// All returned tools should be System.* tools
		for ( var i = 0; i < res.Json.Tools.length; i++ )
		{
			ASSERT.ok( res.Json.Tools[ i ].ToolName.startsWith( 'System.' ) || res.Json.Tools[ i ].PluginName === 'System' );
		}
	} );


	//=================================================================
	// Entities
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return schema for a plugin', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/schema',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Json.properties, 'should return schema with properties' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create, read, and delete an entity', async function ()
	{
		// Create
		var create_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities/test-web-entity',
			method: 'PUT',
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json',
			},
		}, { Description: 'Test entity for web channel tests' } );

		ASSERT.strictEqual( create_res.Status, 200, 'should create entity' );

		// List
		var list_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( list_res.Status, 200 );
		ASSERT.ok( Array.isArray( list_res.Json ), 'should return array of entities' );
		var entity_names = list_res.Json.map( function ( e ) { return e.Name; } );
		ASSERT.ok( entity_names.indexOf( 'test-web-entity' ) >= 0, 'entity should appear in list' );

		// Read
		var read_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities/test-web-entity',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( read_res.Status, 200 );

		// Delete
		var delete_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities/test-web-entity',
			method: 'DELETE',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( delete_res.Status, 200 );
		ASSERT.ok( delete_res.Json.Success, 'should return success' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should return 404 for unknown plugin', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/NonExistent/entities',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 404 );
	} );


	//=================================================================
	// Conversations
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should create and list conversations', async function ()
	{
		// Create
		var create_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/conversations',
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json',
			},
		}, { Name: 'test-web-conv' } );

		ASSERT.strictEqual( create_res.Status, 200 );
		ASSERT.strictEqual( create_res.Json.ConversationName, 'test-web-conv' );

		// List
		var list_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/conversations',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( list_res.Status, 200 );

		// Get
		var get_res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/conversations/test-web-conv',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( get_res.Status, 200 );
	} );


	//=================================================================
	// Chat History
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return chat history', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/chat/history?conversation=test-web-conv',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( Array.isArray( res.Json.Messages ), 'should return Messages array' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should require conversation param for history', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/chat/history',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 400 );
	} );


	//=================================================================
	// Tools
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should invoke a tool directly', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/tools/invoke',
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json',
			},
		}, { PluginName: 'System', ToolName: 'Info', Arguments: {} } );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Json, 'should return tool result' );
	} );


	//=================================================================
	// Suggest
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should return suggestions', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/suggest?input=sys',
			method: 'GET',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( Array.isArray( res.Json.Suggestions ), 'should return Suggestions array' );
	} );


	//=================================================================
	// Per-request Hive isolation (no identity race)
	//=================================================================


	//-----------------------------------------------------------------
	// Fires many concurrent authenticated requests alternating between
	// two users and asserts every response reflects the caller's own
	// identity. If identity ever leaked across requests, we'd see a
	// mismatch under load.
	TEST.it( 'should not leak user identity across concurrent requests', async function ()
	{
		// Login as user2
		var user2_login = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/auth/login',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		}, { Username: 'user2', Password: TEST_CONFIG.Password } );

		ASSERT.strictEqual( user2_login.Status, 200, 'user2 should log in' );
		var token2 = user2_login.Json.Token;

		// Fire N concurrent System.Info invocations alternating tokens.
		// System.Info returns Hive.UserName from inside Execute — the
		// strongest check that per-request Hive identity is intact.
		var N = 40;
		var calls = [];
		for ( var i = 0; i < N; i++ )
		{
			var use_token = ( i % 2 === 0 ) ? token : token2;
			var expected = ( i % 2 === 0 ) ? TEST_CONFIG.Username : 'user2';
			calls.push( request( {
				hostname: '127.0.0.1', port: port,
				path: '/api/tools/invoke',
				method: 'POST',
				headers: {
					Authorization: 'Bearer ' + use_token,
					'Content-Type': 'application/json',
				},
			}, { PluginName: 'System', ToolName: 'Info', Arguments: {} } )
				.then( function ( expected_user )
				{
					return function ( res )
					{
						return { Expected: expected_user, Response: res };
					};
				}( expected ) ) );
		}

		var results = await Promise.all( calls );

		for ( var index = 0; index < results.length; index++ )
		{
			var entry = results[ index ];
			ASSERT.strictEqual( entry.Response.Status, 200, 'request ' + index + ' should return 200' );
			ASSERT.ok( entry.Response.Json && entry.Response.Json.Result, 'request ' + index + ' should have Result' );
			ASSERT.strictEqual(
				entry.Response.Json.Result.UserName,
				entry.Expected,
				'request ' + index + ' should see its own UserName (expected ' + entry.Expected + ')'
			);
		}
	} );


	//=================================================================
	// SSE
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should connect to SSE stream with query token', async function ()
	{
		// First create a conversation for SSE
		await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/conversations',
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json',
			},
		}, { Name: 'test-sse-conv' } );

		// Connect to SSE with token as query param (like EventSource would)
		var sse_data = await new Promise( function ( resolve, reject )
		{
			var events = [];
			var req = HTTP.request( {
				hostname: '127.0.0.1', port: port,
				path: '/api/chat/stream?conversation=test-sse-conv&token=' + encodeURIComponent( token ),
				method: 'GET',
			}, function ( res )
			{
				ASSERT.strictEqual( res.statusCode, 200 );
				ASSERT.ok( res.headers[ 'content-type' ].includes( 'text/event-stream' ) );

				res.on( 'data', function ( chunk )
				{
					var lines = chunk.toString().split( '\n' );
					for ( var i = 0; i < lines.length; i++ )
					{
						if ( lines[ i ].startsWith( 'data: ' ) )
						{
							try
							{
								events.push( JSON.parse( lines[ i ].substring( 6 ) ) );
							}
							catch ( e ) {}
						}
					}

					// After receiving the initial connected event, close
					if ( events.length > 0 )
					{
						res.destroy();
						resolve( events );
					}
				} );

				// Timeout safety
				setTimeout( function ()
				{
					res.destroy();
					resolve( events );
				}, 3000 );
			} );

			req.on( 'error', function ( err )
			{
				// Socket hangup is expected when we destroy
				if ( err.code === 'ECONNRESET' ) { return; }
				reject( err );
			} );
			req.end();
		} );

		// Should have received the initial connected event
		ASSERT.ok( sse_data.length > 0, 'should receive at least one SSE event' );
		ASSERT.strictEqual( sse_data[ 0 ].Type, 'connected' );
		ASSERT.strictEqual( sse_data[ 0 ].ConversationName, 'test-sse-conv' );
	} );


	//=================================================================
	// Static Files
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should serve index.html', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/',
			method: 'GET',
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Body.includes( 'HiveApp' ), 'should contain AngularJS app name' );
		ASSERT.ok( res.Body.includes( 'ng-app' ), 'should contain ng-app directive' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should serve theme.css', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/css/theme.css',
			method: 'GET',
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Body.includes( '--bg-primary' ), 'should contain CSS custom properties' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should serve app.js', async function ()
	{
		var res = await request( {
			hostname: '127.0.0.1', port: port,
			path: '/js/app.js',
			method: 'GET',
		} );

		ASSERT.strictEqual( res.Status, 200 );
		ASSERT.ok( res.Body.includes( 'HiveApp' ), 'should contain app module name' );
	} );


	//=================================================================
	// Cleanup
	//=================================================================


	//-----------------------------------------------------------------
	TEST.it( 'should clean up test conversations', async function ()
	{
		// Delete test conversations
		await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities/test-web-conv',
			method: 'DELETE',
			headers: { Authorization: 'Bearer ' + token },
		} );

		await request( {
			hostname: '127.0.0.1', port: port,
			path: '/api/plugins/Conversation/entities/test-sse-conv',
			method: 'DELETE',
			headers: { Authorization: 'Bearer ' + token },
		} );

		ASSERT.ok( true );
	} );

} );
