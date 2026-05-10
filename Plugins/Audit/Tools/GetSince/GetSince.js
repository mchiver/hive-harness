/*
	GetSince.js
---------------------------------------------------------------------
Retrieves audit entries since a given timestamp, oldest-first.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'GetSince';
	Tool.Description = 'Retrieves audit entries since a given timestamp, oldest-first.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EventType: { type: 'string', description: 'Glob pattern to filter event types (empty = all)' },
			Time: { type: 'string', description: 'ISO 8601 timestamp to start from' },
			MaxEntries: { type: 'number', description: 'Maximum entries to return (0 or omitted = all)' },
		},
		required: [ 'Time' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Entries: { type: 'array', description: 'Array of { Time, EventType, EventData }' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var entries = await Plugin.ReadEntries( Hive, {
			EventType: Arguments.EventType,
			StartTime: Arguments.Time,
			MaxEntries: Arguments.MaxEntries,
			NewestFirst: false,
		} );

		return { Entries: entries };
	};

	return Tool;
};
