/*
	GetLastConversation.js
---------------------------------------------------------------------
Returns the most recently used conversation for a given user and
optional channel name.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'GetLastConversation';
	Tool.Description = 'Get the most recently used conversation for a user and optional channel.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Username: { type: 'string', description: 'The username to filter by.' },
			ChannelName: { type: 'string', description: 'Channel name or glob pattern to filter by (optional).' },
		},
		required: [ 'Username' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			ConversationName: { type: 'string', description: 'Name of the most recent conversation.' },
			Description: { type: 'string', description: 'Description of the conversation.' },
			ChannelName: { type: 'string', description: 'Channel name.' },
			UsedAt: { type: 'string', description: 'Timestamp of last use.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Reuse ListConversations to get filtered and sorted list
		var list_result = await Hive.InvokeTool( 'Conversation.ListConversations', {
			Username: Arguments.Username,
			ChannelName: Arguments.ChannelName || '',
		} );
		if ( !list_result.Success ) { throw new Error( list_result.Error ); }

		var conversations = list_result.Result.Conversations || [];
		if ( conversations.length === 0 )
		{
			throw new Error( 'No conversations found.' );
		}

		// ListConversations returns sorted by UsedAt descending, so first is most recent
		var most_recent = conversations[ 0 ];
		return {
			ConversationName: most_recent.ConversationName,
			Description: most_recent.Description,
			ChannelName: most_recent.ChannelName,
			UsedAt: most_recent.UsedAt,
		};
	};

	return Tool;
};
