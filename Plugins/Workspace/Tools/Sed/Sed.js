/*
	Sed.js
---------------------------------------------------------------------
Stream editor for workspace files. Supports substitution, line
deletion, insert-before, and append-after operations using a
sed-like command syntax.
*/

const PATH = require( 'path' );

module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'Sed';
	Tool.Description = 'Stream editor: apply sed-like commands to workspace files.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {
			Command: { description: 'A sed command string or array of commands' },
			Path: { type: 'string', description: 'Relative file path, or glob pattern when Options.Glob is true' },
			Options: {
				type: 'object',
				description: 'Options: { Glob, Recurse, DryRun }',
				properties: {
					Glob: { type: 'boolean', description: 'Treat Path as a glob pattern' },
					Recurse: { type: 'boolean', description: 'Search subdirectories when Glob is true' },
					DryRun: { type: 'boolean', description: 'Preview changes without writing to disk' },
				},
			},
		},
		required: [ 'Command', 'Path' ],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			Files: { type: 'array', description: 'Array of { Path, Modified, Changes } per file' },
			Error: { type: 'string', description: 'Error text when error' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var options = Arguments.Options || {};
		var commands = Array.isArray( Arguments.Command ) ? Arguments.Command : [ Arguments.Command ];

		// Parse all commands up front
		var parsed_commands = [];
		for ( var cmd of commands )
		{
			var parsed = parse_command( cmd );
			if ( parsed.Error ) { throw new Error( parsed.Error ); }
			parsed_commands.push( parsed );
		}

		// Resolve file list
		var file_paths = [];
		if ( options.Glob )
		{
			var search_path = Plugin.ResolvePath( Hive, Arguments.Path );
			var parent = Hive.Helpers.FileUtils.GetParentFolder( search_path );
			var glob = Hive.Helpers.FileUtils.GetFileName( search_path );
			var relative_files = await Hive.Helpers.FileUtils.FindFiles( parent, glob, options.Recurse || false );
			for ( var relative_file of relative_files )
			{
				file_paths.push( PATH.join( parent, relative_file ) );
			}
		}
		else
		{
			file_paths.push( Plugin.ResolvePath( Hive, Arguments.Path ) );
		}

		// Process each file
		var results = [];
		for ( var file_path of file_paths )
		{
			if ( !await Hive.Helpers.FileUtils.FileExists( file_path ) )
			{
				var relative = PATH.relative( Hive.HiveRoot, file_path );
				results.push( { Path: relative, Modified: false, Changes: 0, Error: 'File not found' } );
				continue;
			}

			var content = await Hive.Helpers.FileUtils.ReadFile( file_path );
			var total_changes = 0;

			for ( var parsed of parsed_commands )
			{
				var result = apply_command( content, parsed );
				content = result.Content;
				total_changes += result.Changes;
			}

			var modified = ( total_changes > 0 );
			if ( modified && !options.DryRun )
			{
				await Hive.Helpers.FileUtils.WriteFile( file_path, content );
			}

			var relative = PATH.relative( Hive.HiveRoot, file_path );
			results.push( { Path: relative, Modified: modified, Changes: total_changes } );
		}

		return { Files: results };
	};

	return Tool;
};


//=====================================================================
// Internal: parse a sed command string
//=====================================================================

function parse_command( CommandText )
{
	var text = CommandText.trim();
	if ( text.length < 2 ) { return { Error: `Invalid command: "${CommandText}"` }; }

	var type = text[ 0 ];
	var delimiter = text[ 1 ];

	if ( type === 's' )
	{
		return parse_substitute( text, delimiter );
	}
	else if ( type === 'd' )
	{
		return parse_delete( text, delimiter );
	}
	else if ( type === 'i' )
	{
		return parse_insert( text, delimiter );
	}
	else if ( type === 'a' )
	{
		return parse_append( text, delimiter );
	}

	return { Error: `Unknown command type: "${type}"` };
}


//---------------------------------------------------------------------
// Parse: s/pattern/replacement/flags
function parse_substitute( Text, Delimiter )
{
	var parts = split_by_delimiter( Text.substring( 2 ), Delimiter );
	if ( parts.length < 2 ) { return { Error: `Invalid substitute command: "${Text}"` }; }

	var pattern = parts[ 0 ];
	var replacement = parts[ 1 ];
	var flags_text = parts[ 2 ] || '';

	return {
		Type: 'substitute',
		Pattern: pattern,
		Replacement: replacement,
		Flags: flags_text,
	};
}


//---------------------------------------------------------------------
// Parse: d/pattern/
function parse_delete( Text, Delimiter )
{
	var parts = split_by_delimiter( Text.substring( 2 ), Delimiter );
	if ( parts.length < 1 || parts[ 0 ] === '' ) { return { Error: `Invalid delete command: "${Text}"` }; }

	return {
		Type: 'delete',
		Pattern: parts[ 0 ],
	};
}


//---------------------------------------------------------------------
// Parse: i/pattern/text
function parse_insert( Text, Delimiter )
{
	var parts = split_by_delimiter( Text.substring( 2 ), Delimiter );
	if ( parts.length < 2 ) { return { Error: `Invalid insert command: "${Text}"` }; }

	return {
		Type: 'insert',
		Pattern: parts[ 0 ],
		Text: parts[ 1 ],
	};
}


//---------------------------------------------------------------------
// Parse: a/pattern/text
function parse_append( Text, Delimiter )
{
	var parts = split_by_delimiter( Text.substring( 2 ), Delimiter );
	if ( parts.length < 2 ) { return { Error: `Invalid append command: "${Text}"` }; }

	return {
		Type: 'append',
		Pattern: parts[ 0 ],
		Text: parts[ 1 ],
	};
}


//---------------------------------------------------------------------
// Split a string by a delimiter, respecting backslash escapes.
function split_by_delimiter( Text, Delimiter )
{
	var parts = [];
	var current = '';
	var index = 0;

	while ( index < Text.length )
	{
		if ( Text[ index ] === '\\' && index + 1 < Text.length )
		{
			// Escaped character — keep the backslash for regex, but pass through escaped delimiters
			if ( Text[ index + 1 ] === Delimiter )
			{
				current += Delimiter;
			}
			else
			{
				current += Text[ index ] + Text[ index + 1 ];
			}
			index += 2;
		}
		else if ( Text[ index ] === Delimiter )
		{
			parts.push( current );
			current = '';
			index++;
		}
		else
		{
			current += Text[ index ];
			index++;
		}
	}

	// Push the final part (handles trailing content after last delimiter)
	if ( current.length > 0 || parts.length > 0 )
	{
		parts.push( current );
	}

	return parts;
}


//=====================================================================
// Internal: apply a parsed command to file content
//=====================================================================

function apply_command( Content, Command )
{
	if ( Command.Type === 'substitute' )
	{
		return apply_substitute( Content, Command );
	}
	else if ( Command.Type === 'delete' )
	{
		return apply_delete( Content, Command );
	}
	else if ( Command.Type === 'insert' )
	{
		return apply_insert( Content, Command );
	}
	else if ( Command.Type === 'append' )
	{
		return apply_append( Content, Command );
	}

	return { Content: Content, Changes: 0 };
}


//---------------------------------------------------------------------
// Substitute: s/pattern/replacement/flags
function apply_substitute( Content, Command )
{
	var regex_flags = '';
	if ( Command.Flags.indexOf( 'i' ) > -1 ) { regex_flags += 'i'; }
	if ( Command.Flags.indexOf( 'g' ) > -1 ) { regex_flags += 'g'; }
	else { regex_flags += ''; }

	// Apply per-line for accurate change counting
	var regex = new RegExp( Command.Pattern, regex_flags );
	var lines = Content.split( '\n' );
	var changes = 0;

	for ( var index = 0; index < lines.length; index++ )
	{
		var original = lines[ index ];
		lines[ index ] = original.replace( regex, Command.Replacement );
		if ( lines[ index ] !== original ) { changes++; }
	}

	return { Content: lines.join( '\n' ), Changes: changes };
}


//---------------------------------------------------------------------
// Delete: remove lines matching pattern
function apply_delete( Content, Command )
{
	var regex = new RegExp( Command.Pattern );
	var lines = Content.split( '\n' );
	var output = [];
	var changes = 0;

	for ( var line of lines )
	{
		if ( regex.test( line ) )
		{
			changes++;
		}
		else
		{
			output.push( line );
		}
	}

	return { Content: output.join( '\n' ), Changes: changes };
}


//---------------------------------------------------------------------
// Insert: add text before lines matching pattern
function apply_insert( Content, Command )
{
	var regex = new RegExp( Command.Pattern );
	var lines = Content.split( '\n' );
	var output = [];
	var changes = 0;

	for ( var line of lines )
	{
		if ( regex.test( line ) )
		{
			output.push( Command.Text );
			changes++;
		}
		output.push( line );
	}

	return { Content: output.join( '\n' ), Changes: changes };
}


//---------------------------------------------------------------------
// Append: add text after lines matching pattern
function apply_append( Content, Command )
{
	var regex = new RegExp( Command.Pattern );
	var lines = Content.split( '\n' );
	var output = [];
	var changes = 0;

	for ( var line of lines )
	{
		output.push( line );
		if ( regex.test( line ) )
		{
			output.push( Command.Text );
			changes++;
		}
	}

	return { Content: output.join( '\n' ), Changes: changes };
}
