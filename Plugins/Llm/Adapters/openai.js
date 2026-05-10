/*
	openai.js
---------------------------------------------------------------------
Platform adapter for the OpenAI Chat Completions and Embeddings APIs.
Default endpoints:
  Chat:   https://api.openai.com/v1/chat/completions
  Embed:  https://api.openai.com/v1/embeddings
*/

const DEFAULTS = {
	ChatUrl: 'https://api.openai.com/v1/chat/completions',
	EmbedUrl: 'https://api.openai.com/v1/embeddings',
	HealthTimeout: 5000,
};


//---------------------------------------------------------------------
async function SubmitPrompt( Fetch, EntityConfig, Prompt )
{
	var chat_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;

	if ( !EntityConfig.ApiKey )
	{
		throw new Error( 'OpenAI adapter requires an ApiKey in entity config.' );
	}

	var body = {
		model: EntityConfig.ModelName,
		messages: [
			{ role: 'user', content: Prompt },
		],
	};

	if ( EntityConfig.ModelTemperature !== undefined )
	{
		body.temperature = EntityConfig.ModelTemperature;
	}

	var headers = {
		'Authorization': 'Bearer ' + EntityConfig.ApiKey,
	};

	var result = await Fetch.Post( chat_url, body, headers );
	if ( result.error )
	{
		throw new Error( `OpenAI error: ${result.error.message || JSON.stringify( result.error )}` );
	}

	return result.choices[ 0 ].message.content;
}


//---------------------------------------------------------------------
async function EmbedText( Fetch, EntityConfig, Text )
{
	var embed_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.EmbedUrl )
		|| DEFAULTS.EmbedUrl;

	if ( !EntityConfig.ApiKey )
	{
		throw new Error( 'OpenAI adapter requires an ApiKey in entity config.' );
	}

	var body = {
		model: EntityConfig.ModelName,
		input: Text,
	};

	var headers = {
		'Authorization': 'Bearer ' + EntityConfig.ApiKey,
	};

	var result = await Fetch.Post( embed_url, body, headers );
	if ( result.error )
	{
		throw new Error( `OpenAI embedding error: ${result.error.message || JSON.stringify( result.error )}` );
	}

	return result.data[ 0 ].embedding;
}


//---------------------------------------------------------------------
// Health check — verifies that the OpenAI API is reachable and the key is valid.
// GET /v1/models is a lightweight authenticated endpoint.
async function Health( Fetch, EntityConfig )
{
	var base_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;
	var url_obj = new URL( base_url );
	var models_url = url_obj.protocol + '//' + url_obj.host + '/v1/models';

	if ( !EntityConfig.ApiKey )
	{
		throw new Error( 'OpenAI adapter requires an ApiKey in entity config.' );
	}

	var headers = {
		'Authorization': 'Bearer ' + EntityConfig.ApiKey,
	};

	var options = {};
	if ( DEFAULTS.HealthTimeout ) { options.Timeout = DEFAULTS.HealthTimeout; }

	var result = await Fetch.Get( models_url, headers, options );
	if ( result.error )
	{
		throw new Error( 'OpenAI health check failed: ' + ( result.error.message || JSON.stringify( result.error ) ) );
	}
	return { Status: 'ok', Message: 'OpenAI API reachable' };
}


//---------------------------------------------------------------------
module.exports = {
	SubmitPrompt: SubmitPrompt,
	EmbedText: EmbedText,
	Health: Health,
};
