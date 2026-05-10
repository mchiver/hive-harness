/*
	Rename.js
---------------------------------------------------------------------
Renames or moves a file or folder within the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'Rename';
	Tool.Description = 'Renames or moves a file or folder within the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			FromPath: { type: 'string', description: 'Relative path of the source' },
			ToPath: { type: 'string', description: 'Relative path of the destination' },
		},
		required: [ 'FromPath', 'ToPath' ],
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
		var from_absolute = Plugin.ResolvePath( Hive, Arguments.FromPath );
		var to_absolute = Plugin.ResolvePath( Hive, Arguments.ToPath );
		var success = await Hive.Helpers.FileUtils.Rename( from_absolute, to_absolute );
		return { Success: success };
	};

	return Tool;
};
