/*
	FileExists.js
---------------------------------------------------------------------
Checks whether a file exists in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'FileExists';
	Tool.Description = 'Checks whether a file exists in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the file' },
		},
		required: [ 'Path' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Exists: { type: 'boolean', description: 'True if the file exists' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var exists = await Hive.Helpers.FileUtils.FileExists( absolute_path );
		return { Exists: exists };
	};

	return Tool;
};
