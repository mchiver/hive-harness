/*
	SqlStore.js
---------------------------------------------------------------------
A reusable SQLite database helper built on better-sqlite3.
Provides open/close, query/execute, and table management operations.
Designed for use by the SqlStore plugin and any other component
that needs SQLite storage.
*/

const Database = require( 'better-sqlite3' );


//=====================================================================
class SqlStore
{


	//---------------------------------------------------------------------
	constructor()
	{
		this.db = null;
		this.database_path = null;
	}


	//---------------------------------------------------------------------
	// Open a connection to a SQLite database file.
	// Options may include: JournalMode, ForeignKeys, CacheSize, BusyTimeout.
	Open( DatabasePath, Options )
	{
		Options = Options || {};
		this.database_path = DatabasePath;
		this.db = new Database( DatabasePath );

		// Apply pragmas from options
		if ( Options.BusyTimeout !== undefined )
		{
			this.db.pragma( `busy_timeout = ${Number( Options.BusyTimeout )}` );
		}
		if ( Options.JournalMode !== undefined )
		{
			this.db.pragma( `journal_mode = ${String( Options.JournalMode )}` );
		}
		else
		{
			this.db.pragma( 'journal_mode = wal' );
		}
		if ( Options.ForeignKeys !== undefined )
		{
			this.db.pragma( `foreign_keys = ${Options.ForeignKeys ? 'ON' : 'OFF'}` );
		}
		else
		{
			this.db.pragma( 'foreign_keys = ON' );
		}
		if ( Options.CacheSize !== undefined )
		{
			this.db.pragma( `cache_size = ${Number( Options.CacheSize )}` );
		}

		return this;
	}


	//---------------------------------------------------------------------
	// Close the database connection.
	Close()
	{
		if ( this.db )
		{
			this.db.close();
			this.db = null;
		}
	}


	//---------------------------------------------------------------------
	// Execute a SQL query that returns rows (SELECT, etc.).
	// Values is an optional array or object of bound parameters.
	Query( Sql, Values )
	{
		var statement = this.db.prepare( Sql );
		if ( Values !== undefined && Values !== null )
		{
			return statement.all( Values );
		}
		return statement.all();
	}


	//---------------------------------------------------------------------
	// Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE, etc.).
	// Returns { RowsAffected, LastInsertId }.
	Execute( Sql, Values )
	{
		var statement = this.db.prepare( Sql );
		var result;
		if ( Values !== undefined && Values !== null )
		{
			result = statement.run( Values );
		}
		else
		{
			result = statement.run();
		}
		return {
			RowsAffected: result.changes,
			LastInsertId: Number( result.lastInsertRowid ),
		};
	}


	//---------------------------------------------------------------------
	// List all user tables in the database.
	ListTables()
	{
		var rows = this.Query(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
		);
		return rows.map( function ( row ) { return row.name; } );
	}


	//---------------------------------------------------------------------
	// Get the schema for a table, returned in the portable Columns format.
	GetTableSchema( TableName )
	{
		var rows = this.Query( `PRAGMA table_info("${TableName}")` );
		if ( rows.length === 0 )
		{
			return null;
		}

		var columns = rows.map( function ( row )
		{
			var column = {
				Name: row.name,
				Type: row.type,
			};
			if ( row.pk > 0 ) { column.PrimaryKey = true; }
			if ( row.notnull === 1 ) { column.NotNull = true; }
			if ( row.dflt_value !== null ) { column.Default = row.dflt_value; }
			return column;
		} );

		// Detect autoincrement by checking sqlite_master for AUTOINCREMENT keyword
		var master_rows = this.Query(
			"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
			[ TableName ]
		);
		if ( master_rows.length > 0 && master_rows[ 0 ].sql )
		{
			var create_sql = master_rows[ 0 ].sql.toUpperCase();
			for ( var column of columns )
			{
				if ( column.PrimaryKey && create_sql.indexOf( 'AUTOINCREMENT' ) > -1 )
				{
					column.AutoIncrement = true;
				}
			}
		}

		return { Columns: columns };
	}


	//---------------------------------------------------------------------
	// Create a table from a schema.
	// TableSchema can be a string (raw SQL column definitions) or an object
	// with a Columns array: [ { Name, Type, PrimaryKey, AutoIncrement, NotNull, Default }, ... ]
	CreateTable( TableName, TableSchema )
	{
		var column_sql;

		if ( typeof TableSchema === 'string' )
		{
			column_sql = TableSchema;
		}
		else if ( TableSchema && TableSchema.Columns )
		{
			column_sql = this.BuildColumnsSql( TableSchema.Columns );
		}
		else
		{
			throw new Error( 'TableSchema must be a string or an object with a Columns array.' );
		}

		var sql = `CREATE TABLE "${TableName}" ( ${column_sql} )`;
		this.Execute( sql );
	}


	//---------------------------------------------------------------------
	// Drop a table.
	DeleteTable( TableName )
	{
		this.Execute( `DROP TABLE IF EXISTS "${TableName}"` );
	}


	//---------------------------------------------------------------------
	// Build SQL column definitions from a Columns array.
	BuildColumnsSql( Columns )
	{
		var parts = [];
		for ( var column of Columns )
		{
			var definition = `"${column.Name}" ${column.Type || 'TEXT'}`;
			if ( column.PrimaryKey ) { definition += ' PRIMARY KEY'; }
			if ( column.AutoIncrement ) { definition += ' AUTOINCREMENT'; }
			if ( column.NotNull ) { definition += ' NOT NULL'; }
			if ( column.Default !== undefined ) { definition += ` DEFAULT ${column.Default}`; }
			parts.push( definition );
		}
		return parts.join( ', ' );
	}


}


module.exports = SqlStore;
