/*
	ollama.js
---------------------------------------------------------------------
Platform adapter for Ollama.
Default endpoint: http://localhost:11434
*/

const DEFAULTS = {
	ChatUrl: 'http://localhost:11434/api/chat',
	EmbedUrl: 'http://localhost:11434/api/embed',
	ContextSize: 131072,
	HealthTimeout: 5000,
};


//---------------------------------------------------------------------
async function SubmitPrompt( Fetch, EntityConfig, Prompt )
{
	var chat_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;
	var context_size = EntityConfig.ContextSize || DEFAULTS.ContextSize;

	var body = {
		model: EntityConfig.ModelName,
		messages: [
			{ role: 'user', content: Prompt },
		],
		stream: false,
		// keep_alive: -1,
		options: {
			num_ctx: context_size,
			// num_gpu: 999,       // force maximum layers to GPU
			// num_batch: 512,
			// flash_attn: false,
		},
	};

	if ( EntityConfig.ModelTemperature !== undefined )
	{
		body.options.temperature = EntityConfig.ModelTemperature;
	}

	var result = await Fetch.Post( chat_url, body );
	if ( result.error )
	{
		throw new Error( `Ollama error: ${result.error}` );
	}
	return result.message.content;
}


//---------------------------------------------------------------------
async function EmbedText( Fetch, EntityConfig, Text )
{
	var embed_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.EmbedUrl )
		|| DEFAULTS.EmbedUrl;

	var body = {
		model: EntityConfig.ModelName,
		input: Text,
	};

	var result = await Fetch.Post( embed_url, body );
	if ( result.error )
	{
		throw new Error( `Ollama embedding error: ${result.error}` );
	}
	return result.embeddings[ 0 ];
}


//---------------------------------------------------------------------
// Health check — verifies that Ollama is reachable.
// GET http://localhost:11434/ returns "Ollama is running" when healthy.
async function Health( Fetch, EntityConfig )
{
	var base_url = ( EntityConfig.PlatformSettings && EntityConfig.PlatformSettings.ChatUrl )
		|| DEFAULTS.ChatUrl;
	var url_obj = new URL( base_url );
	var health_url = url_obj.protocol + '//' + url_obj.host + '/';

	var options = { Raw: true };
	if ( DEFAULTS.HealthTimeout ) { options.Timeout = DEFAULTS.HealthTimeout; }

	var response = await Fetch.Get( health_url, {}, options );
	if ( typeof response === 'string' && response.indexOf( 'Ollama' ) > -1 )
	{
		return { Status: 'ok', Message: response.trim() };
	}
	throw new Error( 'Unexpected response from Ollama: ' + response );
}


//---------------------------------------------------------------------
module.exports = {
	SubmitPrompt: SubmitPrompt,
	EmbedText: EmbedText,
	Health: Health,
};
