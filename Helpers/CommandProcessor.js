/*
	CommandProcessor.js
---------------------------------------------------------------------
Parses, validates, coerces, invokes, and renders tool call commands.
Command format:  PluginName.ToolName [arguments]

Argument styles:
  1. Argument Object:   PluginName.ToolName { Key: Value, ... }
  2. Named Arguments:   PluginName.ToolName --Key Value   or   Key=Value
  3. Positional Args:   PluginName.ToolName value1 value2
*/

const PATH = require( 'path' );
const JSON5 = require( 'json5' );


//=====================================================================
class CommandProcessor
{


	//---------------------------------------------------------------------
	// Parse a command string into a tool call structure.
	// Returns { PluginName, ToolName, ArgumentText, Arguments }
	// Arguments is an object (for object/named styles) or an array (for positional).
	// No validation is performed — this is pure text transformation.
	static Parse( CommandText )
	{
		var text = CommandText.trim();

		// Split off the tool identifier (PluginName.ToolName)
		var space_index = text.indexOf( ' ' );
		var tool_part = ( space_index > -1 ) ? text.substring( 0, space_index ) : text;
		var argument_text = ( space_index > -1 ) ? text.substring( space_index + 1 ).trim() : '';

		// Split tool identifier on first dot
		var dot_index = tool_part.indexOf( '.' );
		var plugin_name = ( dot_index > -1 ) ? tool_part.substring( 0, dot_index ) : tool_part;
		var tool_name = ( dot_index > -1 ) ? tool_part.substring( dot_index + 1 ) : '';

		// Parse arguments
		var arguments_value = {};
		if ( argument_text.length > 0 )
		{
			arguments_value = parse_arguments( argument_text );
		}

		return {
			PluginName: plugin_name,
			ToolName: tool_name,
			ArgumentText: argument_text,
			Arguments: arguments_value,
		};
	}


	//---------------------------------------------------------------------
	// Coerce argument values according to a parameter schema.
	// If Arguments is an array (positional), maps to property names by schema order.
	// Then coerces each value to the declared type.
	static Coerce( Arguments, ParameterSchema )
	{
		var properties = ( ParameterSchema && ParameterSchema.properties ) || {};
		var property_names = Object.keys( properties );
		var result = {};

		// Convert positional array to named object
		if ( Array.isArray( Arguments ) )
		{
			for ( var index = 0; index < Arguments.length; index++ )
			{
				if ( index < property_names.length )
				{
					result[ property_names[ index ] ] = Arguments[ index ];
				}
			}
		}
		else
		{
			result = Object.assign( {}, Arguments );
		}

		// Coerce each value according to schema type
		for ( var name of property_names )
		{
			if ( result[ name ] === undefined ) { continue; }
			var schema = properties[ name ];
			var type = schema.type;
			var value = result[ name ];

			if ( typeof value === 'string' )
			{
				if ( type === 'number' )
				{
					result[ name ] = Number( value );
				}
				else if ( type === 'boolean' )
				{
					result[ name ] = ( value === 'true' || value === '1' );
				}
				else if ( type === 'object' || type === 'array' )
				{
					result[ name ] = parse_relaxed_json( value );
				}
			}
		}

		return result;
	}


	//---------------------------------------------------------------------
	// Validate that a plugin and tool exist, and required parameters are present.
	// Returns { Valid, Error, Plugin, Tool }
	static Validate( Hive, PluginName, ToolName, Arguments )
	{
		var plugin = Hive.Plugins[ PluginName ];
		if ( !plugin )
		{
			return { Valid: false, Error: `Unknown plugin name [${PluginName}].`, Plugin: null, Tool: null };
		}

		var tool = plugin.Tools[ ToolName ];
		if ( !tool )
		{
			return { Valid: false, Error: `Unknown tool name [${PluginName}.${ToolName}].`, Plugin: plugin, Tool: null };
		}

		// Check required parameters
		var required = ( tool.Parameters && tool.Parameters.required ) || [];
		for ( var param_name of required )
		{
			if ( Arguments[ param_name ] === undefined )
			{
				return {
					Valid: false,
					Error: `Missing required parameter [${param_name}] for tool [${PluginName}.${ToolName}].`,
					Plugin: plugin,
					Tool: tool,
				};
			}
		}

		return { Valid: true, Error: null, Plugin: plugin, Tool: tool };
	}


	//---------------------------------------------------------------------
	// Execute a tool call with full validation and result wrapping.
	// Returns { Success, Error, Result } — same envelope as Hive.InvokeTool.
	static async Invoke( Hive, PluginName, ToolName, Arguments )
	{
		var result = {
			Success: false,
			Error: null,
			Result: null,
		};

		var validation = CommandProcessor.Validate( Hive, PluginName, ToolName, Arguments );
		if ( !validation.Valid )
		{
			throw new Error( validation.Error );
		}

		// Per-entity access enforcement.
		// Opt-in via Tool.MinimumRole; the entity name always lives at Arguments.EntityName.
		var access_error = null;
		var required_access = validation.Tool.MinimumRole;
		if ( required_access && required_access !== 'none' )
		{
			var entity_name_value = Arguments ? Arguments.EntityName : null;
			if ( entity_name_value )
			{
				var Entities = require( '../Source/Entities.js' );
				// Skip the check entirely if the name is malformed — let Execute
				// surface the validation error as a wrapped result.
				if ( Entities.IsValidEntityName( entity_name_value ) )
				{
					try
					{
						var find = await Entities.FindEntity( Hive, validation.Plugin, entity_name_value );
						var is_new_config = ( ToolName === 'ConfigEntity' && !find.Found );
						if ( !is_new_config )
						{
							await Entities.CheckAccess( Hive, validation.Plugin, entity_name_value, required_access );
						}
					}
					catch ( error )
					{
						access_error = error.message;
					}
				}
			}
		}

		// Emit tool.before event
		if ( Hive.Events )
		{
			await Hive.Events.Publish( 'tool.before', { PluginName: PluginName, ToolName: ToolName, Arguments: Arguments } );
		}

		if ( access_error )
		{
			result.Error = access_error;
		}
		else
		{
			try
			{
				result.Result = await validation.Tool.Execute( Hive, validation.Plugin, Arguments );
				result.Success = true;
			}
			catch ( error )
			{
				result.Error = `Error invoking tool [${PluginName}.${ToolName}]: "${error.message}" using arguments: ${JSON.stringify( Arguments )}.`;
			}
		}

		// Emit tool.after event
		if ( Hive.Events )
		{
			await Hive.Events.Publish( 'tool.after', {
				PluginName: PluginName,
				ToolName: ToolName,
				Arguments: Arguments,
				Result: result.Result,
				Success: result.Success,
				Error: result.Error,
			} );
		}

		return result;
	}


	//---------------------------------------------------------------------
	// Suggest tool names that contain the partial text (case-insensitive).
	// Returns an array of fully qualified tool names (e.g. 'System.ListPlugins').
	static SuggestTools( Hive, ToolName )
	{
		var results = [];
		var search_text = ( ToolName || '' ).toLowerCase();

		for ( var plugin_name in Hive.Plugins )
		{
			if ( is_supressed_name( plugin_name ) ) { continue; }
			var plugin = Hive.Plugins[ plugin_name ];

			for ( var tool_name in plugin.Tools )
			{
				if ( is_supressed_name( tool_name ) ) { continue; }
				var full_name = plugin_name + '.' + tool_name;
				if ( search_text.length === 0 || full_name.toLowerCase().indexOf( search_text ) > -1 )
				{
					results.push( full_name );
				}
			}
		}

		results.sort();
		return results;
	}


	//---------------------------------------------------------------------
	// Suggest entity names for a plugin that contain the partial text (case-insensitive).
	// Searches the calling user's folder and the shared folder.
	static async SuggestEntities( Hive, PluginName, EntityName )
	{
		var plugin = Hive.Plugins[ PluginName ];
		if ( !plugin ) { return []; }

		var Entities = require( '../Source/Entities.js' );
		var file_utils = Hive.Helpers.FileUtils;
		var search_text = ( EntityName || '' ).toLowerCase();

		var seen = {};
		var results = [];

		var location_folders = [
			Entities.GetUserFolder( Hive ),
			Entities.GetSharedFolder( Hive ),
		];

		for ( var loc_index = 0; loc_index < location_folders.length; loc_index++ )
		{
			var plugin_folder = PATH.join( location_folders[ loc_index ], PluginName );
			if ( !await file_utils.FolderExists( plugin_folder ) ) { continue; }

			var folders = await file_utils.FindFolders( plugin_folder );
			for ( var index = 0; index < folders.length; index++ )
			{
				var folder_name = folders[ index ];
				if ( is_supressed_name( folder_name ) ) { continue; }
				if ( seen[ folder_name ] ) { continue; }

				// Verify it has an entity config file.
				var entity_filename = PATH.join( plugin_folder, folder_name, folder_name + '.entity.json' );
				if ( !await file_utils.FileExists( entity_filename ) ) { continue; }

				if ( search_text.length === 0 || folder_name.toLowerCase().indexOf( search_text ) > -1 )
				{
					results.push( folder_name );
					seen[ folder_name ] = true;
				}
			}
		}

		results.sort();
		return results;
	}


	//---------------------------------------------------------------------
	// Render a tool call structure back to a command string.
	// Input: { PluginName, ToolName, Arguments }
	// Output: "PluginName.ToolName Key=Value Key2=Value2"
	static Render( ToolCall )
	{
		var parts = [ ToolCall.PluginName + '.' + ToolCall.ToolName ];
		var arguments_value = ToolCall.Arguments || {};

		for ( var key of Object.keys( arguments_value ) )
		{
			var value = arguments_value[ key ];
			var rendered = render_value( value );
			parts.push( key + '=' + rendered );
		}

		return parts.join( ' ' );
	}


}


//=====================================================================
// Internal helpers
//=====================================================================


//---------------------------------------------------------------------
// Detect argument style and parse accordingly.
function parse_arguments( Text )
{
	var trimmed = Text.trim();

	// Style 1: Argument Object — starts with {
	if ( trimmed.startsWith( '{' ) )
	{
		return parse_relaxed_json( trimmed );
	}

	// Style 2: Named Arguments — contains -- or =
	if ( trimmed.indexOf( '--' ) > -1 || trimmed.indexOf( '=' ) > -1 )
	{
		return parse_named_arguments( trimmed );
	}

	// Style 3: Positional Arguments
	return parse_positional_arguments( trimmed );
}


//---------------------------------------------------------------------
// Parse relaxed JavaScript object syntax.
// Supports unquoted keys, single/double quotes, unquoted string values.
function parse_relaxed_json( Text )
{
	try
	{
		return JSON5.parse( Text );
	}
	catch ( error )
	{
		throw new Error( `Failed to parse argument object: ${error.message}` );
	}
}


//---------------------------------------------------------------------
// Parse named arguments in --Key Value or Key=Value format.
function parse_named_arguments( Text )
{
	var result = {};
	var tokens = tokenize( Text );
	var index = 0;

	while ( index < tokens.length )
	{
		var token = tokens[ index ];

		// --Key Value style
		if ( token.startsWith( '--' ) )
		{
			var key = token.substring( 2 );
			index++;
			if ( index < tokens.length && !tokens[ index ].startsWith( '--' ) && tokens[ index ].indexOf( '=' ) === -1 )
			{
				result[ key ] = tokens[ index ];
				index++;
			}
			else
			{
				result[ key ] = 'true';
			}
		}
		// Key=Value style
		else if ( token.indexOf( '=' ) > -1 )
		{
			var equals_index = token.indexOf( '=' );
			var key = token.substring( 0, equals_index );
			var value = token.substring( equals_index + 1 );
			result[ key ] = value;
			index++;
		}
		else
		{
			// Unexpected token — skip
			index++;
		}
	}

	return result;
}


//---------------------------------------------------------------------
// Parse positional arguments (split on whitespace, respecting quotes).
function parse_positional_arguments( Text )
{
	return tokenize( Text );
}


//---------------------------------------------------------------------
// Tokenize a string, splitting on whitespace but respecting quoted strings
// and brace-delimited JSON objects/arrays.
function tokenize( Text )
{
	var tokens = [];
	var index = 0;
	var length = Text.length;

	while ( index < length )
	{
		// Skip whitespace
		while ( index < length && Text[ index ] === ' ' ) { index++; }
		if ( index >= length ) { break; }

		var char = Text[ index ];

		// Quoted string
		if ( char === '"' || char === "'" )
		{
			var quote = char;
			index++;
			var start = index;
			while ( index < length && Text[ index ] !== quote ) { index++; }
			tokens.push( Text.substring( start, index ) );
			if ( index < length ) { index++; } // skip closing quote
		}
		// Brace-delimited object or bracket-delimited array
		else if ( char === '{' || char === '[' )
		{
			var open_char = char;
			var close_char = ( char === '{' ) ? '}' : ']';
			var depth = 1;
			var start = index;
			index++;
			while ( index < length && depth > 0 )
			{
				if ( Text[ index ] === open_char ) { depth++; }
				else if ( Text[ index ] === close_char ) { depth--; }
				else if ( Text[ index ] === '"' || Text[ index ] === "'" )
				{
					// Skip over quoted strings inside braces
					var inner_quote = Text[ index ];
					index++;
					while ( index < length && Text[ index ] !== inner_quote ) { index++; }
				}
				index++;
			}
			tokens.push( Text.substring( start, index ) );
		}
		// Unquoted token (until whitespace)
		else
		{
			var start = index;
			while ( index < length && Text[ index ] !== ' ' ) { index++; }
			tokens.push( Text.substring( start, index ) );
		}
	}

	return tokens;
}


//---------------------------------------------------------------------
// Render a single value for command output.
function render_value( Value )
{
	if ( Value === null || Value === undefined )
	{
		return '';
	}
	if ( typeof Value === 'object' )
	{
		return JSON.stringify( Value );
	}
	var text = String( Value );
	if ( text.indexOf( ' ' ) > -1 )
	{
		return '"' + text + '"';
	}
	return text;
}


//---------------------------------------------------------------------
// Filter names that begin with suppressed prefixes.
function is_supressed_name( Name )
{
	if ( Name.startsWith( '~' ) ) { return true; }
	if ( Name.startsWith( '_' ) ) { return true; }
	if ( Name.startsWith( '.' ) ) { return true; }
	return false;
}


//---------------------------------------------------------------------
module.exports = CommandProcessor;
