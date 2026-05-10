/*
	ReadFile.js
---------------------------------------------------------------------
Reads the contents of a file in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ReadFile';
	Tool.Description = 'Reads the text contents of a file in the workspace.';

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
			Content: { type: 'string', description: 'The file contents' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var content = await Hive.Helpers.FileUtils.ReadFile( absolute_path );
		return { Content: content };
	};

	return Tool;
};
