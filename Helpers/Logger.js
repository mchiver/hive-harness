/*
	Logger.js
---------------------------------------------------------------------
Console logging utility with configurable timestamps, colorization,
and message truncation.
*/

//---------------------------------------------------------------------
// Default color palette for severity levels.
var DEFAULT_COLORS = {
	trace: { text: '\x1b[90m', reset: '\x1b[0m' },  // gray
	debug: { text: '\x1b[36m', reset: '\x1b[0m' },  // cyan
	info:  { text: '\x1b[32m', reset: '\x1b[0m' },  // green
	warn:  { text: '\x1b[33m', reset: '\x1b[0m' },  // yellow
	error: { text: '\x1b[31m', reset: '\x1b[0m' },  // red
};

//---------------------------------------------------------------------
// Creates a Logger instance.
function CreateLogger( Options )
{
	var settings = {
		Timestamp: 'YYYY-MM-DD HH:mm:ss',
		Colorize: DEFAULT_COLORS,
		MaxLength: 200,
		Silent: false,
	};

	// Apply provided options
	if( Options )
	{
		if( Options.Timestamp !== undefined ) { settings.Timestamp = Options.Timestamp; }
		if( Options.Colorize !== undefined ) { settings.Colorize = Options.Colorize; }
		if( Options.MaxLength !== undefined ) { settings.MaxLength = Options.MaxLength; }
		if( Options.Silent !== undefined ) { settings.Silent = Options.Silent; }
	}

	//-----------------------------------------------------------------
	// Formats timestamp string by replacing tokens.
	function _FormatTimestamp( Format )
	{
		if( !Format ) { return ''; }

		var now = new Date();
		var result = Format;

		result = result.replace( 'YYYY', String( now.getFullYear() ).padStart( 4, '0' ) );
		result = result.replace( 'MM', String( now.getMonth() + 1 ).padStart( 2, '0' ) );
		result = result.replace( 'DD', String( now.getDate() ).padStart( 2, '0' ) );
		result = result.replace( 'HH', String( now.getHours() ).padStart( 2, '0' ) );
		result = result.replace( 'mm', String( now.getMinutes() ).padStart( 2, '0' ) );
		result = result.replace( 'ss', String( now.getSeconds() ).padStart( 2, '0' ) );

		return result;
	}

	//-----------------------------------------------------------------
	// Converts any value to a string.
	function _StringValue( Value )
	{
		if( Value === null ) { return 'null'; }
		if( Value === undefined ) { return 'undefined'; }
		if( typeof Value === 'string' ) { return Value; }
		if( typeof Value === 'object' )
		{
			try
			{
				return JSON.stringify( Value, null, 2 );
			}
			catch( e )
			{
				return String( Value );
			}
		}
		return String( Value );
	}

	//-----------------------------------------------------------------
	// Pads severity to fixed width for alignment.
	function _PadSeverity( Severity )
	{
		return Severity.padEnd( 5, ' ' );
	}

	//-----------------------------------------------------------------
	// Constructs and returns a log message.
	// Outputs to console unless Silent is true.
	// Returns the formatted message (without colorization).
	function Message( Severity, Value )
	{
		var parts = [];

		// Timestamp
		if( settings.Timestamp )
		{
			parts.push( _FormatTimestamp( settings.Timestamp ) );
		}

		// Severity (padded)
		parts.push( _PadSeverity( Severity ) );

		// Message text
		var message_text = _StringValue( Value );

		// Truncate if needed
		if( message_text.length > settings.MaxLength )
		{
			message_text = message_text.substring( 0, settings.MaxLength ) + '...';
		}

		// Build plain text message
		parts.push( message_text );
		var plain_message = parts.join( ' | ' );

		// Output to console unless silent
		if( !settings.Silent )
		{
			var output_text = message_text;

			// Apply colorization for console output
			if( settings.Colorize && settings.Colorize[ Severity ] )
			{
				var color = settings.Colorize[ Severity ];
				output_text = color.text + message_text + color.reset;
			}

			console.log( parts.slice( 0, 2 ).join( ' | ' ) + ' | ' + output_text );
		}

		return plain_message;
	}

	//-----------------------------------------------------------------
	// Convenience functions for each severity level.
	function Trace( Value ) { return Message( 'trace', Value ); }
	function Debug( Value ) { return Message( 'debug', Value ); }
	function Info( Value )  { return Message( 'info', Value ); }
	function Warn( Value )  { return Message( 'warn', Value ); }
	function Error( Value ) { return Message( 'error', Value ); }

	//-----------------------------------------------------------------
	// Return Logger interface
	return {
		Message: Message,
		Trace: Trace,
		Debug: Debug,
		Info: Info,
		Warn: Warn,
		Error: Error,
	};
}

//---------------------------------------------------------------------
module.exports = {
	CreateLogger,
	DEFAULT_COLORS,
};