/*
	AuthService.js
---------------------------------------------------------------------
Manages JWT authentication token and user state.
*/

app.factory( 'AuthService', [ '$http', function ( $http )
{
	var TOKEN_KEY = 'hive-token';
	var USER_KEY = 'hive-user';

	var service = {};


	//---------------------------------------------------------------------
	service.Login = function ( Username, Password )
	{
		return $http.post( '/api/auth/login', {
			Username: Username,
			Password: Password,
		} ).then( function ( response )
		{
			var data = response.data;
			localStorage.setItem( TOKEN_KEY, data.Token );
			localStorage.setItem( USER_KEY, JSON.stringify( {
				UserName: data.UserName,
				UserRole: data.UserRole,
			} ) );

			// Set default Authorization header
			$http.defaults.headers.common.Authorization = 'Bearer ' + data.Token;

			return data;
		} );
	};


	//---------------------------------------------------------------------
	service.Logout = function ()
	{
		localStorage.removeItem( TOKEN_KEY );
		localStorage.removeItem( USER_KEY );
		delete $http.defaults.headers.common.Authorization;
	};


	//---------------------------------------------------------------------
	service.IsAuthenticated = function ()
	{
		return !!localStorage.getItem( TOKEN_KEY );
	};


	//---------------------------------------------------------------------
	service.GetToken = function ()
	{
		return localStorage.getItem( TOKEN_KEY ) || '';
	};


	//---------------------------------------------------------------------
	service.GetUser = function ()
	{
		try
		{
			return JSON.parse( localStorage.getItem( USER_KEY ) ) || {};
		}
		catch ( e )
		{
			return {};
		}
	};


	//---------------------------------------------------------------------
	// Restore Authorization header on service init
	var token = service.GetToken();
	if ( token )
	{
		$http.defaults.headers.common.Authorization = 'Bearer ' + token;
	}


	return service;
} ] );
