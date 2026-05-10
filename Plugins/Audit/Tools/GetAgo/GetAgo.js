/*
	GetAgo.js
---------------------------------------------------------------------
Retrieves audit entries from a duration ago, oldest-first.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'GetAgo';
	Tool.Description = 'Retrieves audit entries from a duration ago, oldest-first.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EventType: { type: 'string', description: 'Glob pattern to filter event types (empty = all)' },
			Duration: { type: 'string', description: 'Human-friendly duration (e.g. "30m", "7d", "1h30m")' },
			MaxEntries: { type: 'number', description: 'Maximum entries to return (0 or omitted = all)' },
		},
		required: [ 'Duration' ],
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
		var duration_ms = Hive.Helpers.Humanize.ParseDuration( Arguments.Duration );
		var start_time = new Date( Date.now() - duration_ms );

		var entries = await Plugin.ReadEntries( Hive, {
			EventType: Arguments.EventType,
			StartTime: start_time.toISOString(),
			MaxEntries: Arguments.MaxEntries,
			NewestFirst: false,
		} );

		return { Entries: entries };
	};

	return Tool;
};
