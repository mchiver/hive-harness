/*
	SchemaEditor.js
---------------------------------------------------------------------
Recursive directive that renders form controls from a JSON Schema.
*/

app.directive( 'schemaEditor', [ 'SchemaService', function ( SchemaService )
{
	return {
		restrict: 'E',
		scope: {
			schema: '=',
			model: '=',
		},
		template:
			'<div class="schema-editor">' +
				'<div ng-repeat="prop in Properties" class="schema-field">' +

					// Label
					'<label>{{ prop.Name }}' +
						'<span ng-if="prop.Required" class="text-danger"> *</span>' +
					'</label>' +
					'<div class="field-description" ng-if="prop.Description">{{ prop.Description }}</div>' +

					// String
					'<input type="text" class="form-control" ng-model="model[ prop.Name ]" ' +
						'ng-if="prop.Type === \'string\'" placeholder="{{ prop.Default || \'\' }}">' +

					// Textarea
					'<textarea class="form-control" rows="4" ng-model="model[ prop.Name ]" ' +
						'ng-if="prop.Type === \'textarea\'"></textarea>' +

					// Number
					'<input type="number" class="form-control" ng-model="model[ prop.Name ]" ' +
						'ng-if="prop.Type === \'number\'">' +

					// Boolean
					'<div class="form-check" ng-if="prop.Type === \'boolean\'">' +
						'<input type="checkbox" class="form-check-input" ng-model="model[ prop.Name ]">' +
						'<label class="form-check-label">Enabled</label>' +
					'</div>' +

					// Enum
					'<select class="form-select" ng-model="model[ prop.Name ]" ' +
						'ng-if="prop.Type === \'enum\'">' +
						'<option ng-repeat="opt in prop.Schema.enum" value="{{ opt }}">{{ opt }}</option>' +
					'</select>' +

					// Array
					'<div ng-if="prop.Type === \'array\'" class="array-items">' +
						'<div ng-repeat="item in model[ prop.Name ] track by $index" class="array-item">' +
							'<input type="text" class="form-control form-control-sm" ' +
								'ng-model="model[ prop.Name ][ $index ]" ' +
								'ng-if="GetArrayItemType( prop ) === \'string\'">' +
							'<input type="number" class="form-control form-control-sm" ' +
								'ng-model="model[ prop.Name ][ $index ]" ' +
								'ng-if="GetArrayItemType( prop ) === \'number\'">' +
							'<button class="btn btn-outline-secondary btn-remove" ' +
								'ng-click="RemoveArrayItem( prop.Name, $index )">' +
								'<i class="bi bi-x"></i>' +
							'</button>' +
						'</div>' +
						'<button class="btn btn-sm btn-outline-secondary mt-1" ng-click="AddArrayItem( prop )">' +
							'<i class="bi bi-plus"></i> Add' +
						'</button>' +
					'</div>' +

					// Nested object
					'<div ng-if="prop.Type === \'object\'" class="nested-object">' +
						'<schema-editor schema="prop.Schema" model="model[ prop.Name ]"></schema-editor>' +
					'</div>' +

					// Raw JSON (for unstructured objects)
					'<textarea class="form-control monospace" rows="6" ' +
						'ng-if="prop.Type === \'json\'" ' +
						'ng-model="prop._jsonText" ' +
						'ng-change="ParseJson( prop )">' +
					'</textarea>' +

				'</div>' +
			'</div>',
		link: function ( scope )
		{
			scope.Properties = [];

			scope.$watch( 'schema', function ( new_schema )
			{
				if ( new_schema )
				{
					scope.Properties = SchemaService.GetProperties( new_schema );

					// Initialize JSON text for json-type fields
					for ( var i = 0; i < scope.Properties.length; i++ )
					{
						var prop = scope.Properties[ i ];
						if ( prop.Type === 'json' && scope.model && scope.model[ prop.Name ] !== undefined )
						{
							prop._jsonText = JSON.stringify( scope.model[ prop.Name ], null, 2 );
						}
					}

					// Ensure model has all properties
					if ( scope.model )
					{
						for ( var j = 0; j < scope.Properties.length; j++ )
						{
							var p = scope.Properties[ j ];
							if ( scope.model[ p.Name ] === undefined )
							{
								scope.model[ p.Name ] = SchemaService.GenerateDefault( p.Schema );
							}
						}
					}
				}
			} );


			scope.GetArrayItemType = function ( Prop )
			{
				if ( !Prop.Schema || !Prop.Schema.items ) { return 'string'; }
				return SchemaService.GetPropertyType( Prop.Schema.items );
			};


			scope.AddArrayItem = function ( Prop )
			{
				if ( !scope.model[ Prop.Name ] ) { scope.model[ Prop.Name ] = []; }
				var default_value = SchemaService.GenerateArrayItemDefault( Prop.Schema );
				scope.model[ Prop.Name ].push( default_value );
			};


			scope.RemoveArrayItem = function ( PropName, Index )
			{
				if ( scope.model[ PropName ] )
				{
					scope.model[ PropName ].splice( Index, 1 );
				}
			};


			scope.ParseJson = function ( Prop )
			{
				try
				{
					scope.model[ Prop.Name ] = JSON.parse( Prop._jsonText );
				}
				catch ( e )
				{
					// Invalid JSON — leave model unchanged until it's valid
				}
			};
		},
	};
} ] );
