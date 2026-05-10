/*
	SubmitPrompt.js
---------------------------------------------------------------------
Submits a prompt to an LLM entity and returns the response.
Validates prompt size against the entity's ContextSize before sending.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'SubmitPrompt';
	Tool.Description = 'Submit a prompt to an LLM and receive its response.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Llm entity' },
			Prompt: { type: 'string', description: 'The prompt text to send to the LLM' },
		},
		required: [ 'EntityName', 'Prompt' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Response: { type: 'string', description: 'The LLM response text' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Load entity config
		var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		// Validate prompt size
		var estimated_tokens = Plugin.EstimateTokens( Arguments.Prompt );
		if ( estimated_tokens > config.ContextSize )
		{
			throw new Error( `Prompt is approximately ${estimated_tokens} tokens, which exceeds the context size of ${config.ContextSize}.` );
		}

		// Get the platform adapter and submit
		var adapter = Plugin.GetAdapter( config.Platform );
		var response = await adapter.SubmitPrompt( Hive.Helpers.Fetch, config, Arguments.Prompt );
		return { Response: response };
	};

	return Tool;
};
