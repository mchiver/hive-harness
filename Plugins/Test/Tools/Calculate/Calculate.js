/*
	Calculate.js
---------------------------------------------------------------------
Perform basic arithmetic calculations.
*/


module.exports = function ( Tool )
{
	Tool.ToolName = 'Calculate';
	Tool.Description = 'Perform basic arithmetic calculations.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Operation: {
				type: 'string',
				description: 'The operation: add, subtract, multiply, divide, modulo, power.',
				enum: [ 'add', 'subtract', 'multiply', 'divide', 'modulo', 'power' ],
			},
			A: {
				type: 'number',
				description: 'First operand.',
			},
			B: {
				type: 'number',
				description: 'Second operand.',
			},
		},
		required: [ 'Operation', 'A', 'B' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Operation: { type: 'string', description: 'The operation performed.' },
			A: { type: 'number', description: 'First operand.' },
			B: { type: 'number', description: 'Second operand.' },
			Result: { type: 'number', description: 'The calculation result.' },
			Error: { type: 'string', description: 'Error message when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var operation = Arguments.Operation;
		var a = Arguments.A;
		var b = Arguments.B;
		var result;
		var error = null;

		switch ( operation )
		{
			case 'add':
				result = a + b;
				break;
			case 'subtract':
				result = a - b;
				break;
			case 'multiply':
				result = a * b;
				break;
			case 'divide':
				if ( b === 0 )
				{
					error = 'Division by zero';
					result = null;
				}
				else
				{
					result = a / b;
				}
				break;
			case 'modulo':
				if ( b === 0 )
				{
					error = 'Modulo by zero';
					result = null;
				}
				else
				{
					result = a % b;
				}
				break;
			case 'power':
				result = Math.pow( a, b );
				break;
			default:
				error = 'Unknown operation: ' + operation;
				result = null;
		}

		return {
			Operation: operation,
			A: a,
			B: b,
			Result: result,
			Error: error,
		};
	};

	return Tool;
};