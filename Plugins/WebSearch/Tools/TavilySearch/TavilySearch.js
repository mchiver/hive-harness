/*
	TavilySearch.js
---------------------------------------------------------------------
Uses the Tavily API to perform web searches.
Requires a Tavily API key stored in plugin configuration.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'TavilySearch';
	Tool.Description = 'Search the web using the Tavily API.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Text: {
				type: 'string',
				description: 'The search query text.'
			},
			SearchDepth: {
				type: 'string',
				description: 'Search depth: "basic" or "advanced"',
				default: 'basic'
			},
			MaxResults: {
				type: 'integer',
				description: 'Maximum number of results to return (0 for all)',
				default: 20
			}
		},
		required: [ 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Results: {
				type: 'array',
				description: 'Array of search results.',
				items: {
					type: 'object',
					properties: {
						Title: { type: 'string', description: 'Result title' },
						Url: { type: 'string', description: 'Result URL' },
						Content: { type: 'string', description: 'Result content/snippet' },
						Score: { type: 'number', description: 'Relevance score' },
					}
				}
			},
			Error: { type: 'string', description: 'Error message if search failed' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		try
		{
			// Get plugin configuration
			const plugin_config_path = Hive.Helpers.FileUtils.JoinPath( Hive.DataPath, 'WebSearch', 'WebSearch.plugin.json' );
			let config = {};

			if ( await Hive.Helpers.FileUtils.FileExists( plugin_config_path ) )
			{
				config = await Hive.Helpers.FileUtils.ReadJson( plugin_config_path );
			}

			// Check for API key
			const api_key = config.TavilyApiKey;
			if ( !api_key )
			{
				throw new Error( 'Tavily API key not configured. Please set TavilyApiKey in plugin configuration.' );
			}

			// Prepare search request
			const search_depth = Arguments.SearchDepth || 'basic';
			const max_results = Arguments.MaxResults || 0;

			const request_body = {
				api_key: api_key,
				query: Arguments.Text,
				search_depth: search_depth,
				include_answer: false,
				include_images: false,
				include_raw_content: false,
				max_results: ( max_results > 0 ) ? max_results : 5
			};

			// Make API request using Hive's Fetch helper
			const response = await Hive.Helpers.Fetch.Post(
				'https://api.tavily.com/search',
				request_body
			);

			// Process results
			let results = [];
			if ( response.results && Array.isArray( response.results ) )
			{
				for ( const item of response.results )
				{
					results.push( {
						Title: item.title || '',
						Url: item.url || '',
						Content: item.content || '',
						Score: item.score || 0,
					} );
				}
			}

			// Apply MaxResults filter if specified and greater than 0
			if ( max_results > 0 && results.length > max_results )
			{
				results = results.slice( 0, max_results );
			}

			return { Results: results };
		}
		catch ( error )
		{
			throw new Error( `Tavily search failed: ${error.message}` );
		}
	};

	return Tool;
};