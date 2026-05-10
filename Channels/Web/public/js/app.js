/*
	app.js
---------------------------------------------------------------------
HiveApp AngularJS application module with routing and navigation.
*/

var app = angular.module( 'HiveApp', [ 'ngRoute' ] );


//---------------------------------------------------------------------
// Route configuration
app.config( [ '$routeProvider', '$locationProvider', function ( $routeProvider, $locationProvider )
{
	$routeProvider
		.when( '/login', {
			templateUrl: 'views/login.html',
			controller: 'LoginController',
		} )
		.when( '/dashboard', {
			templateUrl: 'views/dashboard.html',
			controller: 'DashboardController',
		} )
		.when( '/management', {
			templateUrl: 'views/management.html',
			controller: 'ManagementController',
		} )
		.when( '/chat', {
			templateUrl: 'views/chat.html',
			controller: 'ChatController',
		} )
		.otherwise( {
			redirectTo: '/login',
		} );
} ] );


//---------------------------------------------------------------------
// Route guard — redirect to login if not authenticated
app.run( [ '$rootScope', '$location', 'AuthService', function ( $rootScope, $location, AuthService )
{
	$rootScope.$on( '$routeChangeStart', function ( event, next )
	{
		if ( next.templateUrl !== 'views/login.html' && !AuthService.IsAuthenticated() )
		{
			$location.path( '/login' );
		}
		if ( next.templateUrl === 'views/login.html' && AuthService.IsAuthenticated() )
		{
			$location.path( '/dashboard' );
		}
	} );
} ] );


//---------------------------------------------------------------------
// Navigation controller (shared across all views via navbar)
app.controller( 'NavController', [ '$scope', '$rootScope', '$location', 'AuthService', function ( $scope, $rootScope, $location, AuthService )
{
	// Theme and Scale live on $rootScope so the body tag can see them
	$rootScope.Theme = localStorage.getItem( 'hive-theme' ) || 'light';
	$rootScope.Scale = localStorage.getItem( 'hive-scale' ) || 'normal';

	$scope.ToggleTheme = function ()
	{
		$rootScope.Theme = ( $rootScope.Theme === 'dark' ) ? 'light' : 'dark';
		localStorage.setItem( 'hive-theme', $rootScope.Theme );
	};

	$scope.SetScale = function ( scale )
	{
		$rootScope.Scale = scale;
		localStorage.setItem( 'hive-scale', scale );
	};

	// Auth state
	$scope.IsAuthenticated = AuthService.IsAuthenticated();
	$scope.UserName = AuthService.GetUser().UserName || '';
	$scope.UserRole = AuthService.GetUser().UserRole || '';

	$scope.Logout = function ()
	{
		AuthService.Logout();
		$location.path( '/login' );
	};

	// Track current view for nav highlighting
	$scope.CurrentView = '';
	$scope.$on( '$routeChangeSuccess', function ()
	{
		var path = $location.path();
		$scope.CurrentView = path.substring( 1 ); // strip leading /
		$scope.IsAuthenticated = AuthService.IsAuthenticated();
		$scope.UserName = AuthService.GetUser().UserName || '';
		$scope.UserRole = AuthService.GetUser().UserRole || '';
	} );
} ] );
