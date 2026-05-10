/*
	AppendFile.js
---------------------------------------------------------------------
Appends text content to a file in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'AppendFile';
	Tool.Description = 'Appends text content to a file in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the file' },
			Content: { type: 'string', description: 'The text content to append' },
		},
		required: [ 'Path', 'Content' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Success: { type: 'boolean', description: 'True when success' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var success = await Hive.Helpers.FileUtils.AppendFile( absolute_path, Arguments.Content );
		return { Success: success };
	};

	return Tool;
};
