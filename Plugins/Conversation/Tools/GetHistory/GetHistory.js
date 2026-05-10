/*
	GetHistory.js
---------------------------------------------------------------------
Returns the most recent chat history entries for a conversation.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetHistory';
	Tool.Description = 'Get most recent conversation history entries.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Conversation entity.' },
			MaxItems: { type: 'number', description: 'Maximum number of history entries to return (default: all).' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Messages: { type: 'array', description: 'Array of { MessageID, Timestamp, Username, LlmName, Context, Text, Tools }.' },
			Count: { type: 'number', description: 'Number of messages returned.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Verify entity exists
		await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		var messages = await Plugin.GetRecentMessages(
			Hive,
			Arguments.EntityName,
			Arguments.MaxItems || 0
		);

		return {
			Messages: messages,
			Count: messages.length,
		};
	};

	return Tool;
};
