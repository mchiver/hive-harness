/*
	Llm.factory.js
---------------------------------------------------------------------
Llm plugin factory - provides LLM chat and embedding via platform adapters.
Each entity represents a single model configuration on a specific platform.
*/

const PATH = require( 'path' );
const Entities = require( '../../Source/Entities.js' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'LLM chat and embedding via platform adapters.';
		Plugin.RequiredRole = 'user';

		// Llm is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for an LLM entity.',
			properties: {
				Name: { type: 'string', description: 'LLM entity name.' },
				Description: { type: 'string', default: '', description: 'Human-readable description of this LLM configuration.' },
				Platform: { type: 'string', default: '', description: 'LLM platform provider, e.g. "openai", "anthropic", "ollama".' },
				ModelName: { type: 'string', default: '', description: 'Model identifier, e.g. "gpt-4o", "claude-sonnet-4-20250514".' },
				ModelTemperature: { type: 'number', default: 0, description: 'Sampling temperature. 0 for deterministic, higher for more creative.' },
				ContextSize: { type: 'number', default: 8192, description: 'Maximum context window size in tokens.' },
				CanEmbed: { type: 'boolean', default: false, description: 'Whether this model supports text embedding.' },
				ApiKey: { type: 'string', default: '', description: 'API key for the platform. Leave empty to use environment variable.' },
				PlatformSettings: { type: 'object', default: {}, description: 'Additional platform-specific settings.' },
			},
			required: [ 'Name', 'Platform', 'ModelName' ],
		};


		//---------------------------------------------------------------------
		// Load entity config from disk.
		Plugin.GetEntityConfig = async function ( Hive, EntityName )
		{
			return await Entities.GetEntityConfig( Hive, this, EntityName );
		};


		//---------------------------------------------------------------------
		// Load the platform adapter for a given platform name.
		// Returns the adapter module with SubmitPrompt and EmbedText functions.
		Plugin.GetAdapter = function ( PlatformName )
		{
			var platform_lower = PlatformName.toLowerCase();
			var adapter_path = PATH.join( __dirname, 'Adapters', platform_lower + '.js' );
			try
			{
				return require( adapter_path );
			}
			catch ( error )
			{
				throw new Error( `Unsupported platform [${PlatformName}]. No adapter found.` );
			}
		};


		//---------------------------------------------------------------------
		// Estimate token count from text using a rough heuristic.
		// Approximately 1 token per 4 characters.
		Plugin.EstimateTokens = function ( Text )
		{
			if ( !Text ) { return 0; }
			return Math.ceil( Text.length / 4 );
		};


		return Plugin;
	}
}

module.exports = Factory;
