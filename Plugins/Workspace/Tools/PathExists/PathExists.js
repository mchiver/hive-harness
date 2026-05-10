/*
	PathExists.js
---------------------------------------------------------------------
Checks whether a path exists in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'PathExists';
	Tool.Description = 'Checks whether a path (file or folder) exists in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to check' },
		},
		required: [ 'Path' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Exists: { type: 'boolean', description: 'True if the path exists' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var exists = await Hive.Helpers.FileUtils.PathExists( absolute_path );
		return { Exists: exists };
	};

	return Tool;
};
