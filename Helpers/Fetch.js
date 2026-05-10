/*
	Fetch.js
---------------------------------------------------------------------
Minimal HTTP client using Node's built-in http/https modules.
Provides a simple interface for making HTTP requests and parsing JSON responses.
*/


//---------------------------------------------------------------------
// Perform an HTTP POST request with a JSON body.
// Returns the parsed JSON response.
// Options:
//   Url      - The URL to POST to.
//   Body     - The request body (will be JSON-serialized).
//   Headers  - Optional extra headers to include.
async function Post( Url, Body, Headers )
{
	var post_data = JSON.stringify( Body );

	var request_headers = {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength( post_data ),
	};
	if ( Headers )
	{
		Object.assign( request_headers, Headers );
	}

	var response_text = await send_request( 'POST', Url, request_headers, post_data );

	try
	{
		return JSON.parse( response_text );
	}
	catch ( error )
	{
		throw new Error( `Failed to parse response: ${response_text}` );
	}
}


//---------------------------------------------------------------------
// Perform an HTTP GET request.
// Returns the parsed JSON response.
// Options:
//   Url      - The URL to GET.
//   Headers  - Optional extra headers to include.
//   Options  - Optional settings: { Timeout: milliseconds, Raw: boolean }
async function Get( Url, Headers, Options )
{
	var request_headers = {};
	if ( Headers )
	{
		Object.assign( request_headers, Headers );
	}

	var timeout = ( Options && Options.Timeout ) || 0;
	var response_text = await send_request( 'GET', Url, request_headers, null, timeout );

	if ( Options && Options.Raw )
	{
		return response_text;
	}

	try
	{
		return JSON.parse( response_text );
	}
	catch ( error )
	{
		throw new Error( `Failed to parse response: ${response_text}` );
	}
}


//=====================================================================
// Internal
//=====================================================================


//---------------------------------------------------------------------
function send_request( Method, Url, Headers, Body, Timeout )
{
	return new Promise( function ( resolve, reject )
	{
		var url_obj = new URL( Url );
		var http_module = ( url_obj.protocol === 'https:' )
			? require( 'https' )
			: require( 'http' );

		var options = {
			hostname: url_obj.hostname,
			port: url_obj.port,
			path: url_obj.pathname + url_obj.search,
			method: Method,
			headers: Headers,
		};

		if ( Timeout > 0 )
		{
			options.timeout = Timeout;
		}

		var request = http_module.request( options, function ( response )
		{
			var chunks = [];
			response.on( 'data', function ( chunk ) { chunks.push( chunk ); } );
			response.on( 'end', function ()
			{
				resolve( Buffer.concat( chunks ).toString() );
			} );
		} );

		request.on( 'error', function ( error )
		{
			reject( new Error( `HTTP request failed: ${error.message}` ) );
		} );

		if ( Timeout > 0 )
		{
			request.on( 'timeout', function ()
			{
				request.destroy();
				reject( new Error( `HTTP request timed out after ${Timeout}ms: ${Method} ${Url}` ) );
			} );
		}

		if ( Body )
		{
			request.write( Body );
		}
		request.end();
	} );
}


//---------------------------------------------------------------------
module.exports = {
	Post: Post,
	Get: Get,
};
