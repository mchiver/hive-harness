/*
	FindFiles.js
---------------------------------------------------------------------
Finds files in the workspace matching an optional glob pattern.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'FindFiles';
	Tool.Description = 'Finds files in the workspace matching an optional glob pattern.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path of the folder to search (default: workspace root)' },
			Glob: { type: 'string', description: 'Glob pattern to filter filenames (e.g. "*.js")' },
			Recurse: { type: 'boolean', description: 'Search subdirectories recursively (default: false)' },
		},
		required: [],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Files: { type: 'array', items: { type: 'string' }, description: 'Relative paths of matching files' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var glob = Arguments.Glob || null;
		var recurse = Arguments.Recurse || false;
		var files = await Hive.Helpers.FileUtils.FindFiles( absolute_path, glob, recurse );
		return { Files: files };
	};

	return Tool;
};
