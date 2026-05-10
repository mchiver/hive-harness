/*
	RunTools.js
---------------------------------------------------------------------
Executes multiple tool calls sequentially and returns an array of results.

ToolCalls accepts three formats:
  1. Array of objects: [ { PluginName, ToolName, Arguments, ExitOnError } ]
  2. Array of strings: [ "PluginName.ToolName arg1 arg2", ... ]
  3. Text block:       "PluginName.ToolName arg1\nPluginName.ToolName arg2"
*/


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'RunTools';
	Tool.Description = 'Executes multiple tool calls sequentially and returns an array of results.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			ToolCalls: {
				description: 'Tool calls: array of objects, array of command strings, or a newline-delimited text block of commands.',
			},
		},
		required: [ 'ToolCalls' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Results: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						PluginName: { type: 'string', description: 'The plugin that was called' },
						ToolName: { type: 'string', description: 'The tool that was called' },
						Success: { type: 'boolean', description: 'Whether the call succeeded' },
						Error: { type: 'string', description: 'Error message if failed' },
						Result: { type: 'object', description: 'The tool return value if successful' },
					},
				},
				description: 'Array of results, one per executed call',
			},
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var command_processor = Hive.Helpers.CommandProcessor;
		var results = [];

		// Normalize ToolCalls into an array of structured objects
		var tool_calls = normalize_tool_calls( command_processor, Arguments.ToolCalls );

		for ( var index = 0; index < tool_calls.length; index++ )
		{
			var call = tool_calls[ index ];
			var tool_name = call.PluginName + '.' + call.ToolName;
			var arguments_value = call.Arguments || {};
			var exit_on_error = call.ExitOnError || false;

			var invoke_result = null;
			try
			{
				invoke_result = await Hive.InvokeTool( tool_name, arguments_value );
			}
			catch ( error )
			{
				invoke_result = { Success: false, Error: error.message, Result: null };
			}

			results.push( {
				PluginName: call.PluginName,
				ToolName: call.ToolName,
				Success: invoke_result.Success,
				Error: invoke_result.Error,
				Result: invoke_result.Result,
			} );

			if ( !invoke_result.Success && exit_on_error )
			{
				break;
			}
		}

		return { Results: results };
	};

	return Tool;
};


//=====================================================================
// Normalize ToolCalls input into an array of { PluginName, ToolName, Arguments, ExitOnError }.
// Accepts:
//   - Array of objects (already structured)
//   - Array of strings (command format)
//   - String (newline-delimited commands)
//=====================================================================

function normalize_tool_calls( CommandProcessor, ToolCalls )
{
	// Text block: split on newlines into array of strings
	if ( typeof ToolCalls === 'string' )
	{
		var lines = ToolCalls.split( '\n' )
			.map( function ( line ) { return line.trim(); } )
			.filter( function ( line ) { return line.length > 0; } );
		return normalize_tool_calls( CommandProcessor, lines );
	}

	// Array input
	if ( Array.isArray( ToolCalls ) )
	{
		var result = [];
		for ( var item of ToolCalls )
		{
			if ( typeof item === 'string' )
			{
				var parsed = CommandProcessor.Parse( item );
				result.push( {
					PluginName: parsed.PluginName,
					ToolName: parsed.ToolName,
					Arguments: Array.isArray( parsed.Arguments ) ? parsed.Arguments : parsed.Arguments,
					ExitOnError: false,
				} );
			}
			else
			{
				result.push( item );
			}
		}
		return result;
	}

	return [];
}
