/*
	DeleteFile.js
---------------------------------------------------------------------
Deletes a file in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'DeleteFile';
	Tool.Description = 'Deletes a file in the workspace.';

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
			Success: { type: 'boolean', description: 'True when success' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var success = await Hive.Helpers.FileUtils.DeleteFile( absolute_path );
		return { Success: success };
	};

	return Tool;
};
