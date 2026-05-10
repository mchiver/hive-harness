/*
	Echo.js
---------------------------------------------------------------------
Echo back the input with optional transformation.
*/


module.exports = function ( Tool )
{
	Tool.ToolName = 'Echo';
	Tool.Description = 'Echo back the input with optional transformations.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Message: {
				type: 'string',
				description: 'The message to echo back.',
			},
			UpperCase: {
				type: 'boolean',
				description: 'Convert to uppercase.',
				default: false,
			},
			Reverse: {
				type: 'boolean',
				description: 'Reverse the string.',
				default: false,
			},
			Repeat: {
				type: 'integer',
				description: 'Number of times to repeat the message.',
				default: 1,
			},
		},
		required: [ 'Message' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Echoed: {
				type: 'array',
				items: { type: 'string' },
				description: 'Array of echoed messages after transformations.',
			},
			Original: { type: 'string', description: 'The original message.' },
			Transformations: {
				type: 'object',
				description: 'Applied transformations.',
			},
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var message = Arguments.Message;
		var upper = Arguments.UpperCase || false;
		var reverse = Arguments.Reverse || false;
		var repeat = Arguments.Repeat || 1;

		if ( upper )
		{
			message = message.toUpperCase();
		}

		if ( reverse )
		{
			message = message.split( '' ).reverse().join( '' );
		}

		var result = [];
		for ( var i = 0; i < repeat; i++ )
		{
			result.push( message );
		}

		return {
			Echoed: result,
			Original: Arguments.Message,
			Transformations: {
				UpperCase: upper,
				Reverse: reverse,
				Repeat: repeat,
			},
		};
	};

	return Tool;
};