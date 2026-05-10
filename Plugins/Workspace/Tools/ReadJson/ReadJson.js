/*
	ReadJson.js
---------------------------------------------------------------------
Reads and parses a JSON file in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'ReadJson';
	Tool.Description = 'Reads and parses a JSON file in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the JSON file' },
		},
		required: [ 'Path' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Data: { type: 'any', description: 'The parsed JSON data' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var absolute_path = Plugin.ResolvePath( Hive, Arguments.Path );
		var data = await Hive.Helpers.FileUtils.ReadJson( absolute_path );
		return { Data: data };
	};

	return Tool;
};
