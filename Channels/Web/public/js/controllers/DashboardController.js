/*
	DashboardController.js
---------------------------------------------------------------------
Dashboard view: system info, plugin overview, and recent activity.
*/

app.controller( 'DashboardController', [ '$scope', '$q', 'ApiService', function ( $scope, $q, ApiService )
{
	$scope.SystemInfo = {};
	$scope.Plugins = [];
	$scope.Loading = true;
	$scope.Error = '';


	//---------------------------------------------------------------------
	function Load()
	{
		$scope.Loading = true;
		$scope.Error = '';

		// Fetch system info and plugins in parallel
		var info_promise = ApiService.GetSystemInfo()
			.then( function ( data )
			{
				$scope.SystemInfo = data;
			} );

		var plugins_promise = ApiService.ListPlugins()
			.then( function ( data )
			{
				$scope.Plugins = data.Plugins || [];

				// Fetch entity counts for plugins that support entities
				var entity_promises = [];
				for ( var i = 0; i < $scope.Plugins.length; i++ )
				{
					( function ( plugin )
					{
						if ( !plugin.HasEntities )
						{
							plugin.EntityCount = 0;
							return;
						}
						var p = ApiService.ListEntities( plugin.PluginName )
							.then( function ( entity_data )
							{
								var entities = entity_data || [];
								plugin.EntityCount = Array.isArray( entities ) ? entities.length : 0;
							} )
							.catch( function ()
							{
								plugin.EntityCount = 0;
							} );
						entity_promises.push( p );
					} )( $scope.Plugins[ i ] );
				}
				return $q.all( entity_promises );
			} );

		$q.all( [ info_promise, plugins_promise ] )
			.then( function ()
			{
				$scope.Loading = false;
			} )
			.catch( function ()
			{
				$scope.Error = 'Failed to load dashboard data.';
				$scope.Loading = false;
			} );
	}


	//---------------------------------------------------------------------
	$scope.GetPluginIcon = function ( PluginName )
	{
		var icons = {
			'System': 'bi-gear',
			'Conversation': 'bi-chat-dots',
			'Audit': 'bi-journal-text',
			'LlmProvider': 'bi-cpu',
		};
		return icons[ PluginName ] || 'bi-puzzle';
	};


	//---------------------------------------------------------------------
	Load();

} ] );
