/*
	Append.js
---------------------------------------------------------------------
Appends a timestamped event to the audit log.
*/

const PATH = require( 'path' );


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'Append';
	Tool.Description = 'Appends a timestamped event to the audit log.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			EventType: { type: 'string', description: 'The event type (e.g. "Tool Call", "Error")' },
			EventData: { type: 'any', description: 'Application-defined event data' },
		},
		required: [ 'EventType' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
			Time: { type: 'string', description: 'The timestamp of the entry' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var now = new Date();
		var audit_folder = await Plugin.GetAuditFolder( Hive );
		var filename = PATH.join( audit_folder, Plugin.GetDateFileName( now ) );

		var entry = {
			Time: now.toISOString(),
			EventType: Arguments.EventType,
			EventData: Arguments.EventData || null,
		};

		var line = JSON.stringify( entry ) + '\n';
		await Hive.Helpers.FileUtils.AppendFile( filename, line );

		return { Success: true, Time: entry.Time };
	};

	return Tool;
};
