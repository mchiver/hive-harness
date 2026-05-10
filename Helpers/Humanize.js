/*
	Humanize.js
---------------------------------------------------------------------
Utilities for converting between human-friendly duration strings
and milliseconds. Supports: s (seconds), m (minutes), h (hours),
d (days), w (weeks), y (years).
*/


//---------------------------------------------------------------------
// Duration unit multipliers in milliseconds.
var UNITS = {
	s: 1000,
	m: 60 * 1000,
	h: 60 * 60 * 1000,
	d: 24 * 60 * 60 * 1000,
	w: 7 * 24 * 60 * 60 * 1000,
	y: 365 * 24 * 60 * 60 * 1000,
};


//---------------------------------------------------------------------
// Parse a human-friendly duration string into milliseconds.
// Supports simple ("30m") and compound ("1h30m", "2d12h") forms.
// Case-insensitive. Throws on invalid input.
function ParseDuration( Duration )
{
	if ( !Duration || typeof Duration !== 'string' )
	{
		throw new Error( 'Invalid duration: input must be a non-empty string.' );
	}

	var input = Duration.trim().toLowerCase();
	var pattern = /(\d+)\s*([smhdwy])/g;
	var total = 0;
	var matched = false;
	var match;

	while ( ( match = pattern.exec( input ) ) !== null )
	{
		var value = parseInt( match[ 1 ], 10 );
		var unit = match[ 2 ];
		total += value * UNITS[ unit ];
		matched = true;
	}

	if ( !matched )
	{
		throw new Error( `Invalid duration: "${Duration}".` );
	}

	return total;
}


//---------------------------------------------------------------------
// Format milliseconds into a human-friendly duration string.
// Uses the largest meaningful units, omitting zero-valued units.
// Returns "0s" for zero.
function FormatDuration( Milliseconds )
{
	if ( Milliseconds <= 0 ) { return '0s'; }

	var remaining = Milliseconds;
	var parts = [];

	var years = Math.floor( remaining / UNITS.y );
	if ( years > 0 ) { parts.push( years + 'y' ); remaining -= years * UNITS.y; }

	var weeks = Math.floor( remaining / UNITS.w );
	if ( weeks > 0 ) { parts.push( weeks + 'w' ); remaining -= weeks * UNITS.w; }

	var days = Math.floor( remaining / UNITS.d );
	if ( days > 0 ) { parts.push( days + 'd' ); remaining -= days * UNITS.d; }

	var hours = Math.floor( remaining / UNITS.h );
	if ( hours > 0 ) { parts.push( hours + 'h' ); remaining -= hours * UNITS.h; }

	var minutes = Math.floor( remaining / UNITS.m );
	if ( minutes > 0 ) { parts.push( minutes + 'm' ); remaining -= minutes * UNITS.m; }

	var seconds = Math.floor( remaining / UNITS.s );
	if ( seconds > 0 ) { parts.push( seconds + 's' ); }

	if ( parts.length === 0 ) { return '0s'; }

	return parts.join( ' ' );
}


//---------------------------------------------------------------------
module.exports = {
	ParseDuration,
	FormatDuration,
};
