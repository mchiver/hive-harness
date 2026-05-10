/*
	ListFolders.js
---------------------------------------------------------------------
Lists all folders in a workspace folder (non-recursive).
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ListFolders';
	Tool.Description = 'Lists all folders in a workspace folder (non-recursive).';

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
			Folders: { type: 'array', items: { type: 'string' }, description: 'Folder names in the folder' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var folders = await Hive.Helpers.FileUtils.ListFolders( absolute_path );
		return { Folders: folders };
	};

	return Tool;
};
