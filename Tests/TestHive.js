/*
	TestHive.js
---------------------------------------------------------------------
Shared test setup: ensures the default registry exists, wipes the
'test' global hive's data folder once per process, and exposes
constants + an Open() helper for tests to consume.

Usage:
	var TestHive = require( './TestHive.js' );
	var hive = await TestHive.Open();                    // default user
	var hive = await TestHive.Open( 'testuser', 'test123' );

The test hive lives at <registry>/Hives/test/ inside the resolved
default registry (HIVE_REGISTRY env or ~/.hives). The hive's .hive/
state is wiped on first call to Open() in the process, so each
`npm test` run starts from a clean state.
*/

const PATH = require( 'path' );
const FS = require( 'fs' );

const Registry = require( '../Source/Registry.js' );
const Hive = require( '../Source/Hive.js' );
const FileUtils = require( '../Helpers/FileUtils.js' );


//---------------------------------------------------------------------
// Resolved constants.
const HIVE_NAME = 'test';
const REGISTRY_PATH = Registry.DefaultPath();
const HIVE_ROOT = PATH.join( REGISTRY_PATH, 'Hives', HIVE_NAME );
const TESTUSER_NAME = 'testuser';
const TESTUSER_PASSWORD = 'test123';
// Pre-computed bcrypt hash of 'test123' so this module stays sync-init friendly.
const TESTUSER_PASSWORD_HASH = '$2b$10$6rP.rkIRE/zHp9V/fN3pluUbYq/heAsejzRUZyR/1ubHjzvw4lj4q';

// Llm settings used by live-llm tests. Field names match Llm.EntitySchema.
const LLM = {
	ChatLlm: 'test-llm',
	Platform: 'ollama',
	ModelName: 'kimi-k2.5:cloud',
	ModelTemperature: 0,
	ContextSize: 8192,
};


//---------------------------------------------------------------------
// Per-process state.
var WIPED_ONCE = false;
var REGISTRY_INSTANCE = null;


//---------------------------------------------------------------------
// Recursively remove a folder if it exists.
function remove_folder( Path )
{
	if ( !FS.existsSync( Path ) ) { return; }
	FS.rmSync( Path, { recursive: true, force: true } );
}


//---------------------------------------------------------------------
// Ensure the registry exists with bundled plugins linked, the testuser
// user is present, and the test hive's data folder is freshly wiped
// (once per process).
async function EnsureSetup()
{
	if ( !REGISTRY_INSTANCE )
	{
		REGISTRY_INSTANCE = await Registry.EnsureDefault( REGISTRY_PATH );

		// Ensure the testuser exists. EnsureDefault only seeds 'default' when
		// the Users/ folder is empty; we want testuser available regardless.
		var testuser_path = PATH.join( REGISTRY_PATH, 'Users', TESTUSER_NAME + '.json' );
		if ( !await FileUtils.FileExists( testuser_path ) )
		{
			await FileUtils.WriteJson( testuser_path, {
				Name: 'Test User',
				Description: 'Test user for hive-harness',
				Role: 'admin',
				PasswordHash: TESTUSER_PASSWORD_HASH,
			} );
		}
	}

	if ( !WIPED_ONCE )
	{
		remove_folder( PATH.join( HIVE_ROOT, '.hive' ) );
		await FileUtils.EnsureFolder( HIVE_ROOT );
		WIPED_ONCE = true;
	}

	return REGISTRY_INSTANCE;
}


//---------------------------------------------------------------------
// Open the test hive for a given user. Defaults to the registry's
// 'default' user (passwordless).
async function Open( Username, Password )
{
	var registry = await EnsureSetup();
	return await Hive.OpenGlobal( HIVE_NAME, Username || '', Password || null, registry );
}


//---------------------------------------------------------------------
module.exports = {
	HIVE_NAME: HIVE_NAME,
	REGISTRY_PATH: REGISTRY_PATH,
	HIVE_ROOT: HIVE_ROOT,
	TESTUSER_NAME: TESTUSER_NAME,
	TESTUSER_PASSWORD: TESTUSER_PASSWORD,
	Llm: LLM,
	EnsureSetup: EnsureSetup,
	Open: Open,
};
