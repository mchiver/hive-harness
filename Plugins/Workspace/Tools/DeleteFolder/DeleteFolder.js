/*
	DeleteFolder.js
---------------------------------------------------------------------
Deletes a folder in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'DeleteFolder';
	Tool.Description = 'Deletes a folder in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the folder' },
			Recursive: { type: 'boolean', description: 'Delete non-empty folders recursively (default: false)' },
		},
		required: [ 'Path' ],
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
		var recursive = Arguments.Recursive || false;
		var success = await Hive.Helpers.FileUtils.DeleteFolder( absolute_path, recursive );
		return { Success: success };
	};

	return Tool;
};
