
const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const Entities = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Entities.js' ) );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const Hive = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Source', 'Hive.js' ) );
const TestHive = require( './TestHive.js' );

const USER_ALICE = 'sec-alice';
const USER_BOB = 'sec-bob';
const USER_EVE = 'sec-eve';

const ENTITIES_ROOT = PATH.join( TestHive.HIVE_ROOT, '.hive', 'Entities' );
const SHARED_ROOT = PATH.join( ENTITIES_ROOT, '.shared' );


//---------------------------------------------------------------------
// Ensure a user file exists in the registry so Hive.Open works even
// without a credential. Uses a placeholder bcrypt hash.
async function EnsureRegistryUser( Username )
{
	var users_folder = PATH.join( TestHive.REGISTRY_PATH, 'Users' );
	var user_file = PATH.join( users_folder, Username + '.json' );
	if ( await FileUtils.FileExists( user_file ) ) { return; }
	await FileUtils.EnsureFolder( users_folder );
	await FileUtils.WriteJson( user_file, {
		Name: Username,
		Description: 'Entity security test user',
		Role: 'user',
		PasswordHash: '',
	} );
}


//---------------------------------------------------------------------
async function OpenHiveAs( Username )
{
	var registry = await TestHive.EnsureSetup();
	var hive = await Hive.Open( registry, TestHive.HIVE_ROOT, Username, null );
	return hive;
}


//---------------------------------------------------------------------
async function CleanupTestEntities()
{
	for ( var user of [ USER_ALICE, USER_BOB, USER_EVE ] )
	{
		var folder = PATH.join( ENTITIES_ROOT, user, 'KeyStore' );
		if ( await FileUtils.FolderExists( folder ) )
		{
			await FileUtils.DeleteFolder( folder, true );
		}
	}
	var shared_folder = PATH.join( SHARED_ROOT, 'KeyStore' );
	if ( await FileUtils.FolderExists( shared_folder ) )
	{
		await FileUtils.DeleteFolder( shared_folder, true );
	}
}


//---------------------------------------------------------------------
TEST.describe( 'Entity Security Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		await EnsureRegistryUser( USER_ALICE );
		await EnsureRegistryUser( USER_BOB );
		await EnsureRegistryUser( USER_EVE );
		await CleanupTestEntities();
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		await CleanupTestEntities();
		for ( var user of [ USER_ALICE, USER_BOB, USER_EVE ] )
		{
			var user_file = PATH.join( TestHive.REGISTRY_PATH, 'Users', user + '.json' );
			if ( await FileUtils.FileExists( user_file ) )
			{
				await FileUtils.DeleteFile( user_file );
			}
			var user_folder = PATH.join( ENTITIES_ROOT, user );
			if ( await FileUtils.FolderExists( user_folder ) )
			{
				await FileUtils.DeleteFolder( user_folder, true );
			}
		}
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should create entity with owner set and security sidecar present', async function ()
	{
		var hive = await OpenHiveAs( USER_ALICE );
		await hive.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'alice-store' } );

		var entity_folder = PATH.join( ENTITIES_ROOT, USER_ALICE, 'KeyStore', 'alice-store' );
		var security_file = PATH.join( entity_folder, 'alice-store.security.json' );

		ASSERT.ok( await FileUtils.FolderExists( entity_folder ), 'entity folder should exist in alice user folder' );
		ASSERT.ok( await FileUtils.FileExists( security_file ), 'security sidecar should exist' );

		var security = await FileUtils.ReadJson( security_file );
		ASSERT.strictEqual( security.owner, USER_ALICE );
		ASSERT.deepStrictEqual( security.admins, [] );
		ASSERT.deepStrictEqual( security.users, [] );
		ASSERT.strictEqual( security.guest_access, 'user' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'two users should have separate namespaces', async function ()
	{
		var hive_alice = await OpenHiveAs( USER_ALICE );
		var hive_bob = await OpenHiveAs( USER_BOB );

		await hive_bob.InvokeTool( 'KeyStore.ConfigEntity', { EntityName: 'bob-store' } );

		var alice_list = await hive_alice.InvokeTool( 'KeyStore.ListEntities', {} );
		var bob_list = await hive_bob.InvokeTool( 'KeyStore.ListEntities', {} );

		var alice_names = alice_list.Result.map( function ( e ) { return e.Name; } );
		var bob_names = bob_list.Result.map( function ( e ) { return e.Name; } );

		ASSERT.ok( alice_names.includes( 'alice-store' ), 'alice sees her own entity' );
		ASSERT.ok( !alice_names.includes( 'bob-store' ), 'alice does not see bobs entity' );
		ASSERT.ok( bob_names.includes( 'bob-store' ), 'bob sees his own entity' );
		ASSERT.ok( !bob_names.includes( 'alice-store' ), 'bob does not see alices entity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'non-owner cannot delete another users entity', async function ()
	{
		var hive_bob = await OpenHiveAs( USER_BOB );
		// Bob can't even see alice-store — DeleteEntity on it should fail.
		var result = await hive_bob.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: 'alice-store' } );
		ASSERT.ok( !result.Success, 'delete should fail for non-owner' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'share moves entity folder to .shared', async function ()
	{
		var hive_alice = await OpenHiveAs( USER_ALICE );
		var result = await hive_alice.InvokeTool( 'KeyStore.ShareEntity', { EntityName: 'alice-store' } );
		ASSERT.ok( result.Success, 'share should succeed for owner' );

		var user_folder = PATH.join( ENTITIES_ROOT, USER_ALICE, 'KeyStore', 'alice-store' );
		var shared_folder = PATH.join( SHARED_ROOT, 'KeyStore', 'alice-store' );

		ASSERT.ok( !await FileUtils.FolderExists( user_folder ), 'user folder should be gone' );
		ASSERT.ok( await FileUtils.FolderExists( shared_folder ), 'shared folder should exist' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'shared entity with guest_access=user is visible to bob', async function ()
	{
		var hive_bob = await OpenHiveAs( USER_BOB );
		var list = await hive_bob.InvokeTool( 'KeyStore.ListEntities', {} );
		var names = list.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( names.includes( 'alice-store' ), 'bob should see alice-store via shared guest access' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'non-owner cannot share or unshare a shared entity', async function ()
	{
		var hive_bob = await OpenHiveAs( USER_BOB );
		var unshare_result = await hive_bob.InvokeTool( 'KeyStore.UnshareEntity', { EntityName: 'alice-store' } );
		ASSERT.ok( !unshare_result.Success, 'non-owner cannot unshare' );
		ASSERT.ok( /denied/i.test( unshare_result.Error ) || /owner/i.test( unshare_result.Error ),
			'error should mention access' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'guest_access=none hides entity from non-listed users', async function ()
	{
		// Flip alice-store's security to guest_access=none while still shared.
		var shared_security_file = PATH.join( SHARED_ROOT, 'KeyStore', 'alice-store', 'alice-store.security.json' );
		var security = await FileUtils.ReadJson( shared_security_file );
		security.guest_access = 'none';
		await FileUtils.WriteJson( shared_security_file, security );

		var hive_eve = await OpenHiveAs( USER_EVE );
		var list = await hive_eve.InvokeTool( 'KeyStore.ListEntities', {} );
		var names = list.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( !names.includes( 'alice-store' ), 'eve should not see alice-store' );

		// Eve also can't read it.
		var get = await hive_eve.InvokeTool( 'KeyStore.GetKey', { EntityName: 'alice-store', Key: 'x' } );
		ASSERT.ok( !get.Success, 'eve cannot read keys' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'explicit users list grants user-level access', async function ()
	{
		var shared_security_file = PATH.join( SHARED_ROOT, 'KeyStore', 'alice-store', 'alice-store.security.json' );
		var security = await FileUtils.ReadJson( shared_security_file );
		security.users = [ USER_EVE ];
		await FileUtils.WriteJson( shared_security_file, security );

		var hive_eve = await OpenHiveAs( USER_EVE );
		var list = await hive_eve.InvokeTool( 'KeyStore.ListEntities', {} );
		var names = list.Result.map( function ( e ) { return e.Name; } );
		ASSERT.ok( names.includes( 'alice-store' ), 'eve now sees alice-store' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'admin can ConfigEntity but not DeleteEntity', async function ()
	{
		var shared_security_file = PATH.join( SHARED_ROOT, 'KeyStore', 'alice-store', 'alice-store.security.json' );
		var security = await FileUtils.ReadJson( shared_security_file );
		security.admins = [ USER_BOB ];
		await FileUtils.WriteJson( shared_security_file, security );

		var hive_bob = await OpenHiveAs( USER_BOB );

		var config_result = await hive_bob.InvokeTool( 'KeyStore.ConfigEntity', {
			EntityName: 'alice-store',
			Settings: { Description: 'bob updated' },
		} );
		ASSERT.ok( config_result.Success, 'admin can ConfigEntity' );

		var delete_result = await hive_bob.InvokeTool( 'KeyStore.DeleteEntity', { EntityName: 'alice-store' } );
		ASSERT.ok( !delete_result.Success, 'admin cannot DeleteEntity' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'owner can unshare and folder returns to owner user folder', async function ()
	{
		var hive_alice = await OpenHiveAs( USER_ALICE );
		var result = await hive_alice.InvokeTool( 'KeyStore.UnshareEntity', { EntityName: 'alice-store' } );
		ASSERT.ok( result.Success, 'owner can unshare' );

		var user_folder = PATH.join( ENTITIES_ROOT, USER_ALICE, 'KeyStore', 'alice-store' );
		var shared_folder = PATH.join( SHARED_ROOT, 'KeyStore', 'alice-store' );

		ASSERT.ok( await FileUtils.FolderExists( user_folder ), 'entity back in user folder' );
		ASSERT.ok( !await FileUtils.FolderExists( shared_folder ), 'shared folder gone' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'username sanitization handles mixed-case and symbols', function ()
	{
		ASSERT.strictEqual( Entities.SanitizeUsername( 'My@Email.Com' ), 'my-email-com' );
		ASSERT.strictEqual( Entities.SanitizeUsername( '  Alice  ' ), 'alice' );
		ASSERT.strictEqual( Entities.SanitizeUsername( 'A__B!!C' ), 'a-b-c' );
		ASSERT.strictEqual( Entities.SanitizeUsername( '' ), '' );
	} );


} );
