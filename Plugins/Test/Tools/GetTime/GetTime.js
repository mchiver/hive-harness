/*
	GetTime.js
---------------------------------------------------------------------
Get current time in various formats.
*/


module.exports = function ( Tool )
{
	Tool.ToolName = 'GetTime';
	Tool.Description = 'Get current time in various formats.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			Format: {
				type: 'string',
				description: 'Format: iso, unix, utc, local.',
				enum: [ 'iso', 'unix', 'utc', 'local' ],
				default: 'iso',
			},
			IncludeTimestamp: {
				type: 'boolean',
				description: 'Include unix timestamp.',
				default: false,
			},
		},
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Time: { type: 'string', description: 'The formatted time string.' },
			Format: { type: 'string', description: 'The format used.' },
			Timestamp: { type: 'integer', description: 'Unix timestamp when IncludeTimestamp is true.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var format = Arguments.Format || 'iso';
		var include_timestamp = Arguments.IncludeTimestamp || false;
		var now = new Date();

		var result = {};

		switch ( format )
		{
			case 'iso':
				result.Time = now.toISOString();
				break;
			case 'unix':
				result.Time = now.toUTCString();
				break;
			case 'utc':
				result.Time = now.toUTCString();
				break;
			case 'local':
				result.Time = now.toLocaleString();
				break;
		}

		if ( include_timestamp )
		{
			result.Timestamp = Math.floor( now.getTime() / 1000 );
		}

		result.Format = format;
		return result;
	};

	return Tool;
};