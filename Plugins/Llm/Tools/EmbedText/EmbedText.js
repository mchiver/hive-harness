/*
	EmbedText.js
---------------------------------------------------------------------
Embeds text using an LLM entity that supports embeddings.
Returns the embedding vector.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'EmbedText';
	Tool.Description = 'Embed text using an LLM and return the embedding vector.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Llm entity' },
			Text: { type: 'string', description: 'The text to embed' },
		},
		required: [ 'EntityName', 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Vector: { type: 'array', description: 'The embedding vector' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Load entity config
		var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		// Check if this entity supports embedding
		if ( !config.CanEmbed )
		{
			throw new Error( `Llm entity [${Arguments.EntityName}] does not support embedding. Set CanEmbed to true in entity config.` );
		}

		// Get the platform adapter and embed
		var adapter = Plugin.GetAdapter( config.Platform );
		if ( !adapter.EmbedText )
		{
			throw new Error( `Platform [${config.Platform}] does not support embedding.` );
		}

		var vector = await adapter.EmbedText( Hive.Helpers.Fetch, config, Arguments.Text );
		return { Vector: vector };
	};

	return Tool;
};
