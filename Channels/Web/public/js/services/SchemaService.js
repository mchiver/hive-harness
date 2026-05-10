/*
	SchemaService.js
---------------------------------------------------------------------
Utilities for working with JSON Schema: extract properties, determine
input types, generate defaults, and basic validation.
*/

app.factory( 'SchemaService', [ function ()
{
	var service = {};


	//---------------------------------------------------------------------
	// Get a flat list of property descriptors from a schema
	service.GetProperties = function ( Schema )
	{
		if ( !Schema || !Schema.properties ) { return []; }

		var result = [];
		var required_list = Schema.required || [];

		var keys = Object.keys( Schema.properties );
		for ( var i = 0; i < keys.length; i++ )
		{
			var key = keys[ i ];
			var prop = Schema.properties[ key ];
			result.push( {
				Name: key,
				Type: service.GetPropertyType( prop ),
				Schema: prop,
				Required: required_list.indexOf( key ) >= 0,
				Description: prop.description || '',
				Default: prop.default,
			} );
		}

		return result;
	};


	//---------------------------------------------------------------------
	// Determine the effective type for a property schema
	service.GetPropertyType = function ( PropertySchema )
	{
		if ( !PropertySchema ) { return 'string'; }

		if ( PropertySchema.enum ) { return 'enum'; }
		if ( PropertySchema.type === 'boolean' ) { return 'boolean'; }
		if ( PropertySchema.type === 'number' || PropertySchema.type === 'integer' ) { return 'number'; }
		if ( PropertySchema.type === 'array' ) { return 'array'; }
		if ( PropertySchema.type === 'object' && PropertySchema.properties ) { return 'object'; }
		if ( PropertySchema.type === 'object' ) { return 'json'; }
		if ( PropertySchema.format === 'textarea' ) { return 'textarea'; }

		return 'string';
	};


	//---------------------------------------------------------------------
	// Generate a default value for a schema
	service.GenerateDefault = function ( Schema )
	{
		if ( !Schema ) { return ''; }
		if ( Schema.default !== undefined ) { return angular.copy( Schema.default ); }

		switch ( Schema.type )
		{
			case 'string': return '';
			case 'number': return 0;
			case 'integer': return 0;
			case 'boolean': return false;
			case 'array': return [];
			case 'object':
			{
				if ( !Schema.properties ) { return {}; }
				var obj = {};
				var keys = Object.keys( Schema.properties );
				for ( var i = 0; i < keys.length; i++ )
				{
					obj[ keys[ i ] ] = service.GenerateDefault( Schema.properties[ keys[ i ] ] );
				}
				return obj;
			}
			default: return '';
		}
	};


	//---------------------------------------------------------------------
	// Generate a default value for an array item
	service.GenerateArrayItemDefault = function ( PropertySchema )
	{
		if ( !PropertySchema || !PropertySchema.items ) { return ''; }
		return service.GenerateDefault( PropertySchema.items );
	};


	//---------------------------------------------------------------------
	// Basic validation — returns array of error strings
	service.Validate = function ( Schema, Model )
	{
		var errors = [];
		if ( !Schema || !Schema.properties ) { return errors; }

		var required_list = Schema.required || [];

		for ( var i = 0; i < required_list.length; i++ )
		{
			var key = required_list[ i ];
			var value = Model[ key ];

			if ( value === undefined || value === null || value === '' )
			{
				errors.push( key + ' is required.' );
			}
		}

		return errors;
	};


	return service;
} ] );
