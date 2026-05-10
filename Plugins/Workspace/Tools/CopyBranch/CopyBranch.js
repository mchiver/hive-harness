/*
	CopyBranch.js
---------------------------------------------------------------------
Copies a folder tree within the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'CopyBranch';
	Tool.Description = 'Recursively copies a folder tree within the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			SourcePath: { type: 'string', description: 'Relative path of the source folder' },
			TargetPath: { type: 'string', description: 'Relative path of the target folder' },
		},
		required: [ 'SourcePath', 'TargetPath' ],
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
		var source_absolute = Plugin.ResolvePath( Hive, Arguments.SourcePath );
		var target_absolute = Plugin.ResolvePath( Hive, Arguments.TargetPath );
		await Hive.Helpers.FileUtils.CopyBranch( source_absolute, target_absolute );
		return { Success: true };
	};

	return Tool;
};
