/*
	Info.js
---------------------------------------------------------------------
Returns basic information about the hive.
*/

const PATH = require( 'path' );
const PACKAGE = require( PATH.join( __dirname, '..', '..', '..', '..', 'package.json' ) );


module.exports = function ( Tool )
{
	// Tool Properties
	Tool.ToolName = 'Info';
	Tool.Description = 'Returns basic information about the hive.';

	// Tool Parameters
	Tool.Parameters = {
		type: 'object',
		properties: {},
		required: [],
	};

	// Tool Return Value
	Tool.Returns = {
		type: 'object',
		properties: {
			HiveRoot: { type: 'string', description: 'The workspace root path' },
			UserName: { type: 'string', description: 'The authenticated user' },
			UserRole: { type: 'string', description: 'The user role' },
			Version: { type: 'string', description: 'HiveJS version' },
		},
	};

	// Tool Execution
	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		return {
			HiveRoot: Hive.HiveRoot,
			UserName: Hive.UserName,
			UserRole: Hive.UserRole,
			Version: PACKAGE.version,
		};
	};

	return Tool;
};
