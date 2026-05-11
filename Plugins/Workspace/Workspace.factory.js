/*
	Workspace.factory.js
---------------------------------------------------------------------
Workspace plugin factory - provides filesystem tools scoped to the
Hive root directory (the "workspace"), excluding the '.hive' folder.
*/

const PATH = require( 'path' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Filesystem tools scoped to the workspace root.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [];


		//---------------------------------------------------------------------
		// Resolve a relative path to an absolute path within the workspace.
		// Throws if the resolved path escapes the workspace root or accesses .hive.
		Plugin.ResolvePath = function ( Hive, RelativePath )
		{
			if ( RelativePath === undefined || RelativePath === null )
			{
				return Hive.HiveRoot;
			}

			var resolved = PATH.resolve( Hive.HiveRoot, RelativePath );
			var normalized = PATH.normalize( resolved );

			// Ensure the path is within the workspace root.
			if ( normalized !== Hive.HiveRoot
				&& !normalized.startsWith( Hive.HiveRoot + PATH.sep ) )
			{
				throw new Error( 'Path is outside the workspace root.' );
			}

			// Ensure the path does not access the .hive folder.
			var hive_data = PATH.join( Hive.HiveRoot, '.hive' );
			if ( normalized === hive_data
				|| normalized.startsWith( hive_data + PATH.sep ) )
			{
				throw new Error( 'Access to the .hive folder is not allowed.' );
			}

			return normalized;
		};


		return Plugin;
	}
}

module.exports = Factory;
