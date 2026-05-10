/*
	ManagementController.js
---------------------------------------------------------------------
Management view: plugin/entity tree on the left, schema editor on the right.
*/

app.controller( 'ManagementController', [ '$scope', 'ApiService', 'SchemaService', function ( $scope, ApiService, SchemaService )
{
	$scope.TreeData = [];
	$scope.SelectedPlugin = null;
	$scope.SelectedEntity = null;
	$scope.Schema = null;
	$scope.Model = {};
	$scope.Loading = true;
	$scope.Saving = false;
	$scope.Error = '';
	$scope.Success = '';
	$scope.IsNew = false;
	$scope.NewEntityName = '';


	//---------------------------------------------------------------------
	function LoadTree()
	{
		$scope.Loading = true;
		$scope.Error = '';

		ApiService.ListPlugins()
			.then( function ( data )
			{
				var plugins = data.Plugins || [];
				var tree = [];
				var remaining = plugins.length;

				if ( remaining === 0 )
				{
					$scope.TreeData = [];
					$scope.Loading = false;
					return;
				}

				// Build tree for all plugins
				// Entity-plugins get children loaded; config-only plugins appear as leaf nodes
				var entity_plugins = plugins.filter( function ( p ) { return p.HasEntities; } );
				var config_plugins = plugins.filter( function ( p ) { return !p.HasEntities; } );

				// Add config-only plugins immediately (no async needed)
				for ( var c = 0; c < config_plugins.length; c++ )
				{
					tree.push( {
						Name: config_plugins[ c ].PluginName,
						Description: config_plugins[ c ].Description || '',
						Type: 'plugin',
						Icon: 'bi-gear',
						HasEntities: false,
						Children: [],
						Expanded: false,
					} );
				}

				remaining = entity_plugins.length;

				if ( remaining === 0 )
				{
					tree.sort( function ( a, b ) { return a.Name.localeCompare( b.Name ); } );
					$scope.TreeData = tree;
					$scope.Loading = false;
					return;
				}

				for ( var i = 0; i < entity_plugins.length; i++ )
				{
					( function ( plugin )
					{
						var node = {
							Name: plugin.PluginName,
							Description: plugin.Description || '',
							Type: 'plugin',
							Icon: 'bi-puzzle',
							HasEntities: true,
							Children: [],
							Expanded: false,
						};

						ApiService.ListEntities( plugin.PluginName )
							.then( function ( entity_data )
							{
								var entities = entity_data || [];
								for ( var j = 0; j < entities.length; j++ )
								{
									node.Children.push( {
										Name: entities[ j ].Name || entities[ j ],
										Type: 'entity',
										Icon: 'bi-file-earmark',
										PluginName: plugin.PluginName,
									} );
								}
							} )
							.catch( function () {} )
							.finally( function ()
							{
								tree.push( node );
								remaining--;
								if ( remaining === 0 )
								{
									// Sort plugins alphabetically
									tree.sort( function ( a, b ) { return a.Name.localeCompare( b.Name ); } );
									$scope.TreeData = tree;
									$scope.Loading = false;
									$scope.$applyAsync();
								}
							} );
					} )( entity_plugins[ i ] );
				}
			} )
			.catch( function ()
			{
				$scope.Error = 'Failed to load plugins.';
				$scope.Loading = false;
			} );
	}


	//---------------------------------------------------------------------
	$scope.OnTreeSelect = function ( Node )
	{
		$scope.Success = '';
		$scope.Error = '';
		$scope.IsNew = false;
		$scope.NewEntityName = '';
		$scope.IsPluginConfig = false;
		$scope.PluginInfo = null;

		if ( Node.Type === 'plugin' )
		{
			$scope.SelectedPlugin = Node.Name;
			$scope.SelectedEntity = null;

			// Load plugin info: description, tools, config
			LoadPluginInfo( Node.Name, Node.HasEntities );
		}
		else if ( Node.Type === 'entity' )
		{
			$scope.SelectedPlugin = Node.PluginName;
			$scope.SelectedEntity = Node.Name;
			LoadEntity( Node.PluginName, Node.Name );
		}
	};


	//---------------------------------------------------------------------
	function LoadPluginInfo( PluginName, HasEntities )
	{
		$scope.PluginInfo = { Name: PluginName, Tools: [], HasEntities: HasEntities };
		$scope.Schema = null;
		$scope.Model = {};
		$scope.IsPluginConfig = false;

		// Find plugin description from tree data
		for ( var i = 0; i < ( $scope.TreeData || [] ).length; i++ )
		{
			if ( $scope.TreeData[ i ].Name === PluginName )
			{
				$scope.PluginInfo.Description = $scope.TreeData[ i ].Description || '';
				break;
			}
		}

		// Load tools for this plugin
		ApiService.ListTools( PluginName )
			.then( function ( data )
			{
				$scope.PluginInfo.Tools = data.Tools || [];
			} )
			.catch( function ()
			{
				$scope.PluginInfo.Tools = [];
			} );

		// Load config schema and config
		ApiService.GetConfigSchema( PluginName )
			.then( function ( data )
			{
				$scope.PluginInfo.ConfigSchema = data;
				if ( data )
				{
					$scope.IsPluginConfig = true;
					$scope.Schema = data;
				}
			} )
			.catch( function ()
			{
				$scope.PluginInfo.ConfigSchema = null;
			} );

		ApiService.GetConfig( PluginName )
			.then( function ( data )
			{
				$scope.Model = data.Settings || {};
				$scope.PluginInfo.HasConfig = Object.keys( data.Settings || {} ).length > 0;
			} )
			.catch( function ()
			{
				$scope.Model = {};
				$scope.PluginInfo.HasConfig = false;
			} );

		// If entity plugin, also load entity schema for New button
		if ( HasEntities )
		{
			ApiService.GetSchema( PluginName )
				.then( function ( data )
				{
					$scope.PluginInfo.EntitySchema = data;
				} )
				.catch( function ()
				{
					$scope.PluginInfo.EntitySchema = null;
				} );
		}
	}


	//---------------------------------------------------------------------
	function LoadEntity( PluginName, EntityName )
	{
		$scope.Error = '';
		$scope.PluginInfo = null;
		$scope.IsPluginConfig = false;

		// Load schema and entity data
		ApiService.GetSchema( PluginName )
			.then( function ( data )
			{
				$scope.Schema = data;
			} )
			.catch( function ()
			{
				$scope.Schema = null;
			} );

		ApiService.GetEntity( PluginName, EntityName )
			.then( function ( data )
			{
				$scope.Model = data.Settings || data || {};
			} )
			.catch( function ()
			{
				$scope.Error = 'Failed to load entity.';
				$scope.Model = {};
			} );
	}


	//---------------------------------------------------------------------
	$scope.NewEntity = function ()
	{
		if ( !$scope.SelectedPlugin ) { return; }
		if ( !$scope.PluginInfo || !$scope.PluginInfo.HasEntities ) { return; }

		$scope.IsNew = true;
		$scope.IsPluginConfig = false;
		$scope.NewEntityName = '';
		$scope.SelectedEntity = null;
		$scope.Error = '';
		$scope.Success = '';

		// Use entity schema, not config schema
		var entity_schema = ( $scope.PluginInfo && $scope.PluginInfo.EntitySchema ) || null;
		$scope.Schema = entity_schema;

		if ( entity_schema )
		{
			$scope.Model = SchemaService.GenerateDefault( entity_schema );
		}
		else
		{
			$scope.Model = {};
		}
	};


	//---------------------------------------------------------------------
	$scope.Save = function ()
	{
		$scope.Error = '';
		$scope.Success = '';

		var plugin_name = $scope.SelectedPlugin;

		if ( !plugin_name )
		{
			$scope.Error = 'No plugin selected.';
			return;
		}

		// Basic validation
		if ( $scope.Schema )
		{
			var errors = SchemaService.Validate( $scope.Schema, $scope.Model );
			if ( errors.length > 0 )
			{
				$scope.Error = errors.join( ' ' );
				return;
			}
		}

		// Plugin config save
		if ( $scope.IsPluginConfig )
		{
			$scope.Saving = true;
			ApiService.SaveConfig( plugin_name, $scope.Model )
				.then( function ()
				{
					$scope.Success = 'Plugin config saved.';
				} )
				.catch( function ( response )
				{
					var message = ( response.data && response.data.Error ) || 'Save failed.';
					$scope.Error = message;
				} )
				.finally( function ()
				{
					$scope.Saving = false;
				} );
			return;
		}

		// Entity save
		var entity_name = $scope.IsNew ? $scope.NewEntityName : $scope.SelectedEntity;
		if ( !entity_name )
		{
			$scope.Error = 'Entity name is required.';
			return;
		}

		$scope.Saving = true;

		ApiService.SaveEntity( plugin_name, entity_name, $scope.Model )
			.then( function ()
			{
				$scope.Success = 'Entity saved.';
				$scope.SelectedEntity = entity_name;
				$scope.IsNew = false;
				$scope.NewEntityName = '';

				// Refresh tree
				LoadTree();
			} )
			.catch( function ( response )
			{
				var message = ( response.data && response.data.Error ) || 'Save failed.';
				$scope.Error = message;
			} )
			.finally( function ()
			{
				$scope.Saving = false;
			} );
	};


	//---------------------------------------------------------------------
	$scope.Delete = function ()
	{
		if ( !$scope.SelectedPlugin || !$scope.SelectedEntity ) { return; }

		if ( !confirm( 'Delete entity "' + $scope.SelectedEntity + '"?' ) ) { return; }

		ApiService.DeleteEntity( $scope.SelectedPlugin, $scope.SelectedEntity )
			.then( function ()
			{
				$scope.SelectedEntity = null;
				$scope.Schema = null;
				$scope.Model = {};
				$scope.Success = 'Entity deleted.';
				LoadTree();
			} )
			.catch( function ( response )
			{
				var message = ( response.data && response.data.Error ) || 'Delete failed.';
				$scope.Error = message;
			} );
	};


	//---------------------------------------------------------------------
	LoadTree();

} ] );
