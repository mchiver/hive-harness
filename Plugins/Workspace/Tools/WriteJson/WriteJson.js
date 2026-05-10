/*
	WriteJson.js
---------------------------------------------------------------------
Writes data to a JSON file in the workspace.
*/

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'WriteJson';
	Tool.Description = 'Writes data to a JSON file in the workspace.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Path: { type: 'string', description: 'Relative path to the JSON file' },
			Data: { type: 'any', description: 'The data to write as JSON' },
		},
		required: [ 'Path', 'Data' ],
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
		var success = await Hive.Helpers.FileUtils.WriteJson( absolute_path, Arguments.Data );
		return { Success: success };
	};

	return Tool;
};
