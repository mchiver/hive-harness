/*
	Routes/Auth.js
---------------------------------------------------------------------
Authentication routes: login and current user info.
*/


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// POST /api/auth/login
	// Body: { Username, Password }
	// Returns: { Token, UserName, UserRole }
	App.post( '/api/auth/login', async function ( req, res )
	{
		try
		{
			var username = req.body.Username || '';
			var password = req.body.Password || '';

			if ( !username || !password )
			{
				return res.status( 400 ).json( { Error: 'Username and Password are required.' } );
			}

			var auth = await Channel.Registry.Authenticate( username, password );

			res.json( {
				Token: auth.Token,
				UserName: auth.Username,
				UserRole: auth.Role,
			} );
		}
		catch ( error )
		{
			res.status( 401 ).json( { Error: error.message } );
		}
	} );


	//---------------------------------------------------------------------
	// GET /api/auth/me
	// Returns current user info from JWT.
	App.get( '/api/auth/me', function ( req, res )
	{
		res.json( {
			UserName: req.User.Username,
			UserRole: req.User.Role,
		} );
	} );


};
