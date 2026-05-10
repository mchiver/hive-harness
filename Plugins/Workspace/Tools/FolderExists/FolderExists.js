/*
	FolderExists.js
---------------------------------------------------------------------
Checks whether a folder exists in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'FolderExists';
	Tool.Description = 'Checks whether a folder exists in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the folder' },
		},
		required: [ 'Path' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Exists: { type: 'boolean', description: 'True if the folder exists' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var exists = await Hive.Helpers.FileUtils.FolderExists( absolute_path );
		return { Exists: exists };
	};

	return Tool;
};
