/*
	ListConversations.js
---------------------------------------------------------------------
Lists conversations matching a Username and optional ChannelName.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListConversations';
	Tool.Description = 'List conversations matching a username and optional channel name.';

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
			Conversations: { type: 'array', description: 'Array of { ConversationName, Description, ChannelName, UsedAt }.' },
			Count: { type: 'number', description: 'Number of conversations found.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// List all Conversation entities
		var entities = await Hive.InvokeTool( 'Conversation.ListEntities', {} );
		if ( !entities.Success ) { throw new Error( entities.Error ); }

		var conversations = [];
		var entity_list = entities.Result || [];

		for ( var index = 0; index < entity_list.length; index++ )
		{
			var entity = entity_list[ index ];
			var config = await Plugin.GetEntityConfig( Hive, entity.Name );

			// Filter by Username
			if ( config.Username !== Arguments.Username ) { continue; }

			// Filter by ChannelName if provided
			if ( Arguments.ChannelName )
			{
				if ( !Hive.Helpers.Strings.MatchGlob( config.ChannelName || '', Arguments.ChannelName ) )
				{
					continue;
				}
			}

			conversations.push( {
				ConversationName: config.Name,
				Description: config.Description || '',
				ChannelName: config.ChannelName || '',
				UsedAt: config.UsedAt || '',
			} );
		}

		// Sort by UsedAt descending (most recent first)
		conversations.sort( function ( a, b )
		{
			if ( !a.UsedAt && !b.UsedAt ) { return 0; }
			if ( !a.UsedAt ) { return 1; }
			if ( !b.UsedAt ) { return -1; }
			return b.UsedAt.localeCompare( a.UsedAt );
		} );

		return {
			Conversations: conversations,
			Count: conversations.length,
		};
	};

	return Tool;
};
