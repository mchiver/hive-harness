/*
	Get.js
---------------------------------------------------------------------
Retrieves audit entries, newest-first.
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'Get';
	Tool.Description = 'Retrieves audit entries, newest-first.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EventType: { type: 'string', description: 'Glob pattern to filter event types (empty = all)' },
			MaxEntries: { type: 'number', description: 'Maximum entries to return (0 or omitted = all)' },
		},
		required: [],
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
			MaxEntries: Arguments.MaxEntries,
			NewestFirst: true,
		} );

		return { Entries: entries };
	};

	return Tool;
};
