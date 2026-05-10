/*
	Auth.js
---------------------------------------------------------------------
JWT authentication middleware for the Web channel.
Extracts and verifies JWT tokens from the Authorization header.
*/

const PATH = require( 'path' );
const JWT = require( 'jsonwebtoken' );
const FileUtils = require( '../../../Helpers/FileUtils.js' );


//---------------------------------------------------------------------
// Paths that do not require authentication.
var PUBLIC_PATHS = [
	'/api/auth/login',
];


//---------------------------------------------------------------------
function AuthMiddleware( Channel )
{
	return async function ( req, res, next )
	{
		// Skip auth for public API paths
		if ( PUBLIC_PATHS.indexOf( req.path ) > -1 )
		{
			return next();
		}

		// Skip auth for non-API paths (static files, SPA)
		if ( !req.path.startsWith( '/api/' ) )
		{
			return next();
		}

		// Extract token from Authorization header or query parameter
		// (EventSource doesn't support custom headers, so SSE passes token as ?token=)
		var token = '';
		var auth_header = req.headers.authorization || '';
		if ( auth_header.startsWith( 'Bearer ' ) )
		{
			token = auth_header.substring( 7 );
		}
		else if ( req.query && req.query.token )
		{
			token = req.query.token;
		}
		else
		{
			return res.status( 401 ).json( { Error: 'Missing or invalid Authorization header.' } );
		}

		try
		{
			// Decode token (without verification) to get Username
			var decoded = JWT.decode( token );
			if ( !decoded || !decoded.Username )
			{
				return res.status( 401 ).json( { Error: 'Invalid token.' } );
			}

			// Load user file to get PasswordHash for verification
			var users_folder = PATH.join( Channel.Registry.RegistryPath, 'Users' );
			var user_filename = PATH.join( users_folder, decoded.Username + '.json' );
			if ( !await FileUtils.FileExists( user_filename ) )
			{
				return res.status( 401 ).json( { Error: 'User not found.' } );
			}
			var user = await FileUtils.ReadJson( user_filename );

			// Verify token signature and expiry
			JWT.verify( token, user.PasswordHash );

			// Attach user info to request
			req.User = {
				Username: decoded.Username,
				Role: user.Role || 'guest',
				Token: token,
			};

			next();
		}
		catch ( error )
		{
			return res.status( 401 ).json( { Error: 'Authentication failed: ' + error.message } );
		}
	};
}


//---------------------------------------------------------------------
module.exports = AuthMiddleware;
