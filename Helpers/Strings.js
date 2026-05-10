/*
	Strings.js
---------------------------------------------------------------------
A collection of string utility functions for matching, globbing,
and parsing.
*/


module.exports = {


	//---------------------------------------------------------------------
	// Convert a glob pattern to a RegExp.
	// Glob wildcards: * matches any sequence, ? matches a single character.
	// Matching is case-insensitive.
	GlobToRegex: function ( Glob )
	{
		var pattern = Glob.replace( /[.+^${}()|[\]\\]/g, '\\$&' );
		pattern = pattern.replace( /\*/g, '.*' );
		pattern = pattern.replace( /\?/g, '.' );
		return new RegExp( '^' + pattern + '$', 'i' );
	},


	//---------------------------------------------------------------------
	// Match a string against a glob pattern.
	// Returns true if the string matches.
	MatchGlob: function ( String, Glob )
	{
		var regex = this.GlobToRegex( Glob );
		return regex.test( String );
	},


	//---------------------------------------------------------------------
	// Convert a glob pattern to a SQL LIKE pattern.
	// Glob wildcards: * becomes %, ? becomes _.
	// Escapes existing SQL LIKE special characters (%, _, \) in the input.
	GlobToSqlLike: function ( Glob )
	{
		var pattern = '';
		for ( var index = 0; index < Glob.length; index++ )
		{
			var char = Glob[ index ];
			if ( char === '*' )
			{
				pattern += '%';
			}
			else if ( char === '?' )
			{
				pattern += '_';
			}
			else if ( char === '%' || char === '_' || char === '\\' )
			{
				pattern += '\\' + char;
			}
			else
			{
				pattern += char;
			}
		}
		return pattern;
	},


};
