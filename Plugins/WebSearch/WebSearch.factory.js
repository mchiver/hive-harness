/*
	WebSearch.factory.js
---------------------------------------------------------------------
Web search plugin with multiple search engine implementations.
Supports Tavily API and Wikipedia search.
API keys are stored in plugin configuration.
*/

class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Web search plugin with multiple search engine support.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [];

		// Plugin-level configuration for API keys
		Plugin.ConfigSchema = {
			type: 'object',
			properties: {
				TavilyApiKey: {
					type: 'string',
					description: 'API key for Tavily search service',
					default: ''
				},
			},
			required: [],
		};

		return Plugin;
	}
}

module.exports = Factory;