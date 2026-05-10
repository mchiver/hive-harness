/*
	WikipediaSearch.js
---------------------------------------------------------------------
Searches Wikipedia using the Wikipedia API.
No API key required.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'WikipediaSearch';
	Tool.Description = 'Search Wikipedia for articles.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Text: {
				type: 'string',
				description: 'The search query text.'
			},
			Limit: {
				type: 'integer',
				description: 'Maximum number of results to return from initial search',
				default: 5
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
				description: 'Array of Wikipedia search results.',
				items: {
					type: 'object',
					properties: {
						Title: { type: 'string', description: 'Article title' },
						Url: { type: 'string', description: 'Article URL' },
						Snippet: { type: 'string', description: 'Article snippet' },
						PageId: { type: 'integer', description: 'Wikipedia page ID' },
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
			const search_text = Arguments.Text;
			const limit = Arguments.Limit || 5;
			const max_results = Arguments.MaxResults || 0;

			// Encode search text for URL
			const encoded_text = encodeURIComponent( search_text );

			// Try to get direct page summary first
			try
			{
				const summary_response = await Hive.Helpers.Fetch.Get(
					`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded_text}`
				);

				// If successful, return this single result
				let results = [
					{
						Title: summary_response.title || search_text,
						Url: summary_response.content_urls ? summary_response.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encoded_text}`,
						Snippet: summary_response.extract || '',
						PageId: summary_response.page_id || 0,
					}
				];

				// Apply MaxResults filter if specified and greater than 0
				if ( max_results > 0 && results.length > max_results )
				{
					results = results.slice( 0, max_results );
				}

				return { Results: results };
			}
			catch ( summary_error )
			{
				// If direct summary fails, do a search
				const search_url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded_text}&format=json&srlimit=${limit}&origin=*`;

				const search_response = await Hive.Helpers.Fetch.Get( search_url );

				// Process search results
				let results = [];
				if ( search_response.query && search_response.query.search )
				{
					for ( const item of search_response.query.search )
					{
						results.push( {
							Title: item.title || '',
							Url: `https://en.wikipedia.org/wiki/${encodeURIComponent( item.title.replace( / /g, '_' ) )}`,
							Snippet: item.snippet || '',
							PageId: item.pageid || 0,
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
		}
		catch ( error )
		{
			throw new Error( `Wikipedia search failed: ${error.message}` );
		}
	};

	return Tool;
};