/*
	anthropic.js
---------------------------------------------------------------------
Platform adapter for the Anthropic Messages API.
Default endpoint: https://api.anthropic.com/v1/messages
Anthropic does not offer an embeddings API.
*/

const DEFAULTS = {
	ChatUrl: 'https://api.anthropic.com/v1/messages',
	ApiVersion: '2023-06-01',
	MaxTokens: 4096,
};


//---------------------------------------------------------------------
async function SubmitPrompt( Fetch, EntityConfig, Prompt )
{
	var chat_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;
	var api_version = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ApiVersion )
		|| DEFAULTS.ApiVersion;
	var max_tokens = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.MaxTokens )
		|| DEFAULTS.MaxTokens;

	if ( !EntityConfig.ApiKey )
	{
		throw new Error( 'Anthropic adapter requires an ApiKey in entity config.' );
	}

	var body = {
		model: EntityConfig.ModelName,
		max_tokens: max_tokens,
		messages: [
			{ role: 'user', content: Prompt },
		],
	};

	if ( EntityConfig.ModelTemperature !== undefined )
	{
		body.temperature = EntityConfig.ModelTemperature;
	}

	var headers = {
		'x-api-key': EntityConfig.ApiKey,
		'anthropic-version': api_version,
	};

	var result = await Fetch.Post( chat_url, body, headers );
	if ( result.error )
	{
		throw new Error( `Anthropic error: ${result.error.message || JSON.stringify( result.error )}` );
	}

	// Extract text from content blocks
	var text_parts = [];
	for ( var block of result.content )
	{
		if ( block.type === 'text' )
		{
			text_parts.push( block.text );
		}
	}
	return text_parts.join( '' );
}


//---------------------------------------------------------------------
// Health check — verifies that the Anthropic API is reachable and the key is present.
// Sends a minimal request to validate connectivity and authentication.
async function Health( Fetch, EntityConfig )
{
	var chat_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;
	var api_version = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ApiVersion )
		|| DEFAULTS.ApiVersion;

	if ( !EntityConfig.ApiKey )
	{
		throw new Error( 'Anthropic adapter requires an ApiKey in entity config.' );
	}

	// Use a minimal prompt with max_tokens=1 to validate connectivity and auth
	var body = {
		model: EntityConfig.ModelName,
		max_tokens: 1,
		messages: [ { role: 'user', content: 'hi' } ],
	};

	var headers = {
		'x-api-key': EntityConfig.ApiKey,
		'anthropic-version': api_version,
	};

	var result = await Fetch.Post( chat_url, body, headers );
	if ( result.error )
	{
		throw new Error( 'Anthropic health check failed: ' + ( result.error.message || JSON.stringify( result.error ) ) );
	}
	return { Status: 'ok', Message: 'Anthropic API reachable' };
}


//---------------------------------------------------------------------
module.exports = {
	SubmitPrompt: SubmitPrompt,
	Health: Health,
	// Anthropic does not support embeddings
};
