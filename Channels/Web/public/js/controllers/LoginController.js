/*
	LoginController.js
---------------------------------------------------------------------
Handles user login form submission and error display.
*/

app.controller( 'LoginController', [ '$scope', '$location', 'AuthService', function ( $scope, $location, AuthService )
{
	$scope.Username = '';
	$scope.Password = '';
	$scope.Error = '';
	$scope.Loading = false;


	//---------------------------------------------------------------------
	$scope.Login = function ()
	{
		$scope.Error = '';

		if ( !$scope.Username || !$scope.Password )
		{
			$scope.Error = 'Username and password are required.';
			return;
		}

		$scope.Loading = true;

		AuthService.Login( $scope.Username, $scope.Password )
			.then( function ()
			{
				$location.path( '/dashboard' );
			} )
			.catch( function ( response )
			{
				if ( response.status === 401 )
				{
					$scope.Error = 'Invalid username or password.';
				}
				else
				{
					$scope.Error = 'Login failed. Please try again.';
				}
			} )
			.finally( function ()
			{
				$scope.Loading = false;
			} );
	};


	//---------------------------------------------------------------------
	// Submit on Enter key
	$scope.OnKeyPress = function ( event )
	{
		if ( event.keyCode === 13 )
		{
			$scope.Login();
		}
	};

} ] );
