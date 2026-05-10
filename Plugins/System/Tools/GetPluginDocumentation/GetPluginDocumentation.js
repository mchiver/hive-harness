/*
	GetPluginDocumentation.js
---------------------------------------------------------------------
Returns the reference documentation for a plugin.
*/

const PATH = require( 'path' );


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'GetPluginDocumentation';
	Tool.Description = 'Returns the reference documentation for a plugin.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			PluginName: { type: 'string', description: 'The plugin to get documentation for' },
		},
		required: [ 'PluginName' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Content: { type: 'string', description: 'The reference documentation markdown' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var target_plugin = Hive.Plugins[ Arguments.PluginName ];
		if ( !target_plugin )
		{
			throw new Error( `Plugin [${Arguments.PluginName}] not found.` );
		}

		if ( !target_plugin.SourcePath )
		{
			throw new Error( `Plugin [${Arguments.PluginName}] has no source path.` );
		}

		var doc_filename = PATH.join( target_plugin.SourcePath, Arguments.PluginName + '-Plugin-Reference.md' );
		if ( !await Hive.Helpers.FileUtils.FileExists( doc_filename ) )
		{
			throw new Error( `No reference documentation found for plugin [${Arguments.PluginName}].` );
		}

		var content = await Hive.Helpers.FileUtils.ReadFile( doc_filename );
		return { Content: content };
	};

	return Tool;
};
