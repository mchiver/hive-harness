/*
	ListFiles.js
---------------------------------------------------------------------
Lists all files in a workspace folder (non-recursive).
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListFiles';
	Tool.Description = 'Lists all files in a workspace folder (non-recursive).';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path of the folder to list (default: workspace root)' },
		},
		required: [],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Files: { type: 'array', items: { type: 'string' }, description: 'Filenames in the folder' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var files = await Hive.Helpers.FileUtils.ListFiles( absolute_path );
		return { Files: files };
	};

	return Tool;
};
