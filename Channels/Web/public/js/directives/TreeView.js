/*
	TreeView.js
---------------------------------------------------------------------
Hierarchical expandable tree directive. Click-to-select with icons.
*/

app.directive( 'treeView', [ function ()
{
	return {
		restrict: 'E',
		scope: {
			data: '=',
			onSelect: '&',
		},
		template:
			'<div class="tree-view">' +
				'<div ng-repeat="node in data" class="tree-node-wrapper">' +
					'<div class="tree-node" ' +
						'ng-class="{ selected: node._selected }" ' +
						'ng-click="Select( node )" ' +
						'ng-style="{ \'padding-left\': ( node._depth || 0 ) * 20 + 8 + \'px\' }">' +
						'<i class="bi" ng-class="GetExpandIcon( node )" ng-if="node.Children && node.Children.length" ng-click="Toggle( node, $event )"></i>' +
						'<i class="bi" ng-class="node.Icon || \'bi-circle\'"></i> ' +
						'{{ node.Name }}' +
					'</div>' +
					'<div ng-if="node.Expanded && node.Children" class="tree-children">' +
						'<tree-view data="node.Children" on-select="BubbleSelect( node )"></tree-view>' +
					'</div>' +
				'</div>' +
			'</div>',
		link: function ( scope )
		{
			// Set depth for indentation
			if ( scope.data )
			{
				for ( var i = 0; i < scope.data.length; i++ )
				{
					if ( scope.data[ i ]._depth === undefined )
					{
						scope.data[ i ]._depth = 0;
					}
					if ( scope.data[ i ].Children )
					{
						for ( var j = 0; j < scope.data[ i ].Children.length; j++ )
						{
							scope.data[ i ].Children[ j ]._depth = ( scope.data[ i ]._depth || 0 ) + 1;
						}
					}
				}
			}


			scope.Toggle = function ( Node, Event )
			{
				Event.stopPropagation();
				Node.Expanded = !Node.Expanded;
			};


			scope.GetExpandIcon = function ( Node )
			{
				return Node.Expanded ? 'bi-chevron-down' : 'bi-chevron-right';
			};


			scope.Select = function ( Node )
			{
				// Clear all selections at this level
				if ( scope.data )
				{
					for ( var i = 0; i < scope.data.length; i++ )
					{
						scope.data[ i ]._selected = false;
					}
				}
				Node._selected = true;

				// Auto-expand parent nodes
				if ( Node.Children && Node.Children.length )
				{
					Node.Expanded = true;
				}

				scope.onSelect( { node: Node } );
			};


			scope.BubbleSelect = function ( Node )
			{
				scope.onSelect( { node: Node } );
			};
		},
	};
} ] );
