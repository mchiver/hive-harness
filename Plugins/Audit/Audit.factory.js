/*
	Audit.factory.js
---------------------------------------------------------------------
Audit plugin factory - provides append-only timestamped event logging.
Events are stored in daily .jsonl files under .hive/Audit/.
*/

const PATH = require( 'path' );


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Append-only timestamped event logging.';
		Plugin.RequiredRole = 'user';


		//---------------------------------------------------------------------
		// Get the audit data folder, ensuring it exists.
		Plugin.GetAuditFolder = async function ( Hive )
		{
			var folder = await Hive.GetPluginDataPath( this.PluginName );
			await Hive.Helpers.FileUtils.EnsureFolder( folder );
			return folder;
		};


		//---------------------------------------------------------------------
		// Get the filename for a given date's audit log.
		Plugin.GetDateFileName = function ( Date )
		{
			var year = String( Date.getFullYear() ).padStart( 4, '0' );
			var month = String( Date.getMonth() + 1 ).padStart( 2, '0' );
			var day = String( Date.getDate() ).padStart( 2, '0' );
			return `audit-${year}-${month}-${day}.jsonl`;
		};


		//---------------------------------------------------------------------
		// Parse a date from an audit filename (e.g. "audit-2026-04-05.jsonl").
		Plugin.ParseDateFileName = function ( Filename )
		{
			var match = Filename.match( /^audit-(\d{4})-(\d{2})-(\d{2})\.jsonl$/ );
			if ( !match ) { return null; }
			return new Date( parseInt( match[ 1 ] ), parseInt( match[ 2 ] ) - 1, parseInt( match[ 3 ] ) );
		};


		//---------------------------------------------------------------------
		// Read entries from audit logs.
		// Options: { EventType, StartTime, MaxEntries, NewestFirst }
		Plugin.ReadEntries = async function ( Hive, Options )
		{
			var event_type = Options.EventType || null;
			var start_time = Options.StartTime ? new Date( Options.StartTime ) : null;
			var max_entries = Options.MaxEntries || 0;
			var newest_first = Options.NewestFirst || false;

			var audit_folder = await this.GetAuditFolder( Hive );

			// Find all audit files.
			var all_files = await Hive.Helpers.FileUtils.FindFiles( audit_folder, 'audit-*.jsonl', false );
			all_files.sort();

			// Filter to files that could contain relevant entries.
			if ( start_time )
			{
				var start_date_string = this.GetDateFileName( start_time );
				all_files = all_files.filter( function ( f ) { return f >= start_date_string; } );
			}

			// Order files based on read direction.
			if ( newest_first )
			{
				all_files.reverse();
			}

			// Read and collect entries.
			var entries = [];
			for ( var file_index = 0; file_index < all_files.length; file_index++ )
			{
				var file_path = PATH.join( audit_folder, all_files[ file_index ] );
				var content = await Hive.Helpers.FileUtils.ReadFile( file_path );
				var lines = content.split( '\n' ).filter( function ( line ) { return line.trim().length > 0; } );

				// Reverse lines within file if reading newest-first.
				if ( newest_first )
				{
					lines.reverse();
				}

				for ( var line_index = 0; line_index < lines.length; line_index++ )
				{
					var entry = JSON.parse( lines[ line_index ] );

					// Filter by start time.
					if ( start_time && new Date( entry.Time ) < start_time )
					{
						continue;
					}

					// Filter by event type glob.
					if ( event_type && !Hive.Helpers.Strings.MatchGlob( entry.EventType, event_type ) )
					{
						continue;
					}

					entries.push( entry );

					// Check max entries limit.
					if ( max_entries > 0 && entries.length >= max_entries )
					{
						return entries;
					}
				}
			}

			return entries;
		};


		return Plugin;
	}
}

module.exports = Factory;
