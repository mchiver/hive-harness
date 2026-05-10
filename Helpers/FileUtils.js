/*
	FileUtils.js
---------------------------------------------------------------------
A collection of helper functions for working with files and folders.
All file operations in this project should use these function rather than including FS and PATH directly.
If a file operation is required which does not exist, create it here.
*/

const FS = require( 'fs' ).promises;
const PATH = require( 'path' );
const Strings = require( './Strings.js' );


module.exports = {


	//---------------------------------------------------------------------
	SplitAnyPath: function ( Path )
	{
		if ( Path.indexOf( '\\' ) > -1 ) { return Path.split( '\\' ); }
		if ( Path.indexOf( '/' ) > -1 ) { return Path.split( '/' ); }
		return [];
	},


	//---------------------------------------------------------------------
	PathExists: async function ( Path )
	{
		try { await FS.access( Path ); }
		catch { return false; }
		return true;
	},


	//---------------------------------------------------------------------
	FolderExists: async function ( Path )
	{
		if ( !await this.PathExists( Path ) ) { return false; }
		var stats = await FS.lstat( Path );
		return stats.isDirectory();
	},


	//---------------------------------------------------------------------
	FileExists: async function ( Path )
	{
		if ( !await this.PathExists( Path ) ) { return false; }
		var stats = await FS.lstat( Path );
		return stats.isFile();
	},


	//---------------------------------------------------------------------
	CreateFolder: async function ( FolderPath )
	{
		try
		{
			await FS.mkdir( FolderPath, { recursive: true } );
		}
		catch { return false; }
		return true;
	},


	//---------------------------------------------------------------------
	EnsureFolder: async function ( FolderPath )
	{
		if ( await this.PathExists( FolderPath ) ) { return true; }
		var result = await this.CreateFolder( FolderPath );
		return result;
	},


	//---------------------------------------------------------------------
	ReadFile: async function ( Filename )
	{
		var content = await FS.readFile( Filename, { encoding: 'utf8' } );
		return content;
	},


	//---------------------------------------------------------------------
	ReadJson: async function ( Filename )
	{
		var content = await this.ReadFile( Filename );
		var data = JSON.parse( content );
		return data;
	},


	//---------------------------------------------------------------------
	WriteFile: async function ( Filename, Content )
	{
		try
		{
			await FS.writeFile( Filename, Content, { encoding: 'utf8' } );
			return true;
		}
		catch { return false; }
	},


	//---------------------------------------------------------------------
	WriteJson: async function ( Filename, Data )
	{
		var content = JSON.stringify( Data, null, 2 );
		return await this.WriteFile( Filename, content );
	},


	//---------------------------------------------------------------------
	AppendFile: async function ( Filename, Content )
	{
		try
		{
			await FS.appendFile( Filename, Content, { encoding: 'utf8' } );
			return true;
		}
		catch { return false; }
	},


	//---------------------------------------------------------------------
	DeleteFile: async function ( Filename )
	{
		try
		{
			await FS.unlink( Filename );
			return true;
		}
		catch { return false; }
	},


	//---------------------------------------------------------------------
	DeleteFolder: async function ( FolderPath, DeleteNonEmptyFolders )
	{
		var options = {};
		if ( DeleteNonEmptyFolders ) { options = { recursive: true, force: true }; }
		try
		{
			await FS.rm( FolderPath, options );
			return true;
		}
		catch { return false; }
	},


	//---------------------------------------------------------------------
	Rename: async function ( FromPath, ToPath )
	{
		try
		{
			await FS.rename( FromPath, ToPath );
			return true;
		}
		catch { return false; }
	},


	//---------------------------------------------------------------------
	CopyBranch: async function ( SourceFolder, TargetFolder )
	{
		await FS.cp( SourceFolder, TargetFolder, { recursive: true } );
		return;
	},


	//---------------------------------------------------------------------
	// Returns a list of folder and filenames (relative to Path) that match Glob.
	// Glob is a simple extension pattern like '*.js' (matched case-insensitively).
	// If Glob is falsy, all files are returned.
	// If Recurse is true, subdirectories are searched recursively.
	Find: async function ( Path, Glob, Recurse )
	{
		var results = [];
		if ( !await this.PathExists( Path ) ) { return results; }

		// Build a matcher from the glob pattern.
		var match = null;
		if ( Glob )
		{
			match = Strings.GlobToRegex( Glob );
		}

		var queue = [ '' ];
		while ( queue.length > 0 )
		{
			var relative_dir = queue.shift();
			var absolute_dir = relative_dir ? PATH.join( Path, relative_dir ) : Path;
			var entries = await FS.readdir( absolute_dir, { withFileTypes: true } );

			for ( var entry of entries )
			{
				var relative_path = relative_dir ? PATH.join( relative_dir, entry.name ) : entry.name;

				if ( entry.isDirectory() )
				{
					if ( Recurse ) { queue.push( relative_path ); }
				}

				if ( !match || match.test( entry.name ) )
				{
					results.push( relative_path );
				}
			}
		}

		return results;
	},


	//---------------------------------------------------------------------
	FindFolders: async function ( Path, Glob, Recurse )
	{
		var results = [];
		var entries = await this.Find( Path, Glob, Recurse );
		for ( var entry of entries )
		{
			var absolute_path = PATH.join( Path, entry );
			if ( await this.FolderExists( absolute_path ) )
			{
				results.push( entry );
			}
		}
		return results;
	},


	//---------------------------------------------------------------------
	FindFiles: async function ( Path, Glob, Recurse )
	{
		var results = [];
		var entries = await this.Find( Path, Glob, Recurse );
		for ( var entry of entries )
		{
			var absolute_path = PATH.join( Path, entry );
			if ( await this.FileExists( absolute_path ) )
			{
				results.push( entry );
			}
		}
		return results;
	},


	//---------------------------------------------------------------------
	ListFolders: async function ( Path )
	{
		return await this.FindFolders( Path, null, false );
	},


	//---------------------------------------------------------------------
	ListFiles: async function ( Path )
	{
		return await this.FindFiles( Path, null, false );
	},


	//---------------------------------------------------------------------
	JoinPath: function ( ...Parts )
	{
		return PATH.join( ...Parts );
	},


	//---------------------------------------------------------------------
	GetParentFolder: function ( Path )
	{
		return PATH.dirname( Path );
	},


	//---------------------------------------------------------------------
	GetFileName: function ( Path )
	{
		return PATH.basename( Path );
	},


	//---------------------------------------------------------------------
	GetFileNameWithoutExtension: function ( Path )
	{
		var name = PATH.basename( Path );
		var last_dot = name.lastIndexOf( '.' );
		if ( last_dot > 0 ) { return name.substring( 0, last_dot ); }
		return name;
	},


};
