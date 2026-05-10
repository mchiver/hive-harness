/*
	CreateFolder.js
---------------------------------------------------------------------
Creates a folder in the workspace (recursive).
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'CreateFolder';
	Tool.Description = 'Creates a folder in the workspace, including intermediate directories.';

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
			Success: { type: 'boolean', description: 'True when success' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var success = await Hive.Helpers.FileUtils.CreateFolder( absolute_path );
		return { Success: success };
	};

	return Tool;
};
