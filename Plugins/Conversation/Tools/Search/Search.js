/*
	Search.js
---------------------------------------------------------------------
Searches all topics attached to a conversation for text similar to
the query. Returns ranked results across all topics.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Search';
	Tool.Description = 'Search all topics in a conversation for similar text.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Conversation entity.' },
			Text: { type: 'string', description: 'The text to search for.' },
			MinScore: { type: 'number', description: 'Minimum similarity score (default 0.3).' },
			MaxResults: { type: 'number', description: 'Maximum number of results (0 or missing for all).' },
		},
		required: [ 'EntityName', 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Results: { type: 'array', description: 'Array of { TopicName, SourceName, Text, Score }.' },
			Count: { type: 'number', description: 'Number of results returned.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		if ( !config.Topics || config.Topics.length === 0 )
		{
			return { Results: [], Count: 0 };
		}

		var results = await Plugin.SearchTopics(
			Hive,
			config,
			Arguments.Text,
			Arguments.MinScore,
			Arguments.MaxResults
		);

		return {
			Results: results,
			Count: results.length,
		};
	};

	return Tool;
};
