/*
	results-store.js
---------------------------------------------------------------------
SQLite storage for model benchmark results.
Uses the shared SqlStore helper for database operations.
*/

const PATH = require( 'path' );
const PROJECT_ROOT = PATH.join( __dirname, '..', '..' );
const SqlStore = require( PATH.join( PROJECT_ROOT, 'Helpers', 'SqlStore.js' ) );


//---------------------------------------------------------------------
var TABLE_NAME = 'Results';

var TABLE_SCHEMA = {
	Columns: [
		{ Name: 'id', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
		{ Name: 'Platform', Type: 'TEXT', NotNull: true },
		{ Name: 'ModelName', Type: 'TEXT', NotNull: true },
		{ Name: 'Timestamp', Type: 'TEXT', NotNull: true },
		{ Name: 'DurationMs', Type: 'INTEGER', NotNull: true },
		{ Name: 'TestGroup', Type: 'TEXT', NotNull: true },
		{ Name: 'TestName', Type: 'TEXT', NotNull: true },
		{ Name: 'Passed', Type: 'INTEGER', NotNull: true },
		{ Name: 'Result', Type: 'TEXT', NotNull: true, Default: "'{}'" },
	],
};


//=====================================================================
class ResultsStore
{


	//---------------------------------------------------------------------
	constructor()
	{
		this.store = null;
	}


	//---------------------------------------------------------------------
	Open( DatabasePath )
	{
		this.store = new SqlStore();
		this.store.Open( DatabasePath, { JournalMode: 'wal', BusyTimeout: 5000 } );
		this.EnsureTable();
		return this;
	}


	//---------------------------------------------------------------------
	Close()
	{
		if ( this.store )
		{
			this.store.Close();
			this.store = null;
		}
	}


	//---------------------------------------------------------------------
	EnsureTable()
	{
		var tables = this.store.ListTables();
		if ( !tables.includes( TABLE_NAME ) )
		{
			this.store.CreateTable( TABLE_NAME, TABLE_SCHEMA );
			return;
		}
	}


	//---------------------------------------------------------------------
	// Delete all stored results.
	ClearResults()
	{
		this.store.Execute( 'DELETE FROM "' + TABLE_NAME + '"' );
	}


	//---------------------------------------------------------------------
	// Save a single test result.
	SaveResult( Entry )
	{
		var timestamp = new Date().toISOString();
		var result_text = typeof Entry.Result === 'string'
			? Entry.Result
			: JSON.stringify( Entry.Result || {} );

		this.store.Execute(
			`INSERT INTO "${TABLE_NAME}" ( Platform, ModelName, Timestamp, DurationMs, TestGroup, TestName, Passed, Result )`
			+ ' VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )',
			[
				Entry.Platform,
				Entry.ModelName,
				timestamp,
				Entry.DurationMs,
				Entry.TestGroup || '',
				Entry.TestName,
				Entry.Passed ? 1 : 0,
				result_text,
			]
		);
	}


	//---------------------------------------------------------------------
	// Get all results for a specific model.
	GetModelResults( Platform, ModelName )
	{
		return this.store.Query(
			`SELECT * FROM "${TABLE_NAME}" WHERE Platform = ? AND ModelName = ? ORDER BY Timestamp DESC`,
			[ Platform, ModelName ]
		);
	}


	//---------------------------------------------------------------------
	// Get only the most recent run for a model.
	GetLatestRun( Platform, ModelName )
	{
		// Find the latest timestamp for this model
		var rows = this.store.Query(
			`SELECT MAX( Timestamp ) AS LatestTs FROM "${TABLE_NAME}" WHERE Platform = ? AND ModelName = ?`,
			[ Platform, ModelName ]
		);
		if ( !rows.length || !rows[ 0 ].LatestTs ) { return []; }

		var latest_ts = rows[ 0 ].LatestTs;

		return this.store.Query(
			`SELECT * FROM "${TABLE_NAME}" WHERE Platform = ? AND ModelName = ? AND Timestamp = ? ORDER BY TestName`,
			[ Platform, ModelName, latest_ts ]
		);
	}


	//---------------------------------------------------------------------
	// Get comparison data: latest run per model, pivoted into a grid.
	// Returns { Models: [...], Tests: [...], Grid: { "model": { "test": { Passed, DurationMs } } } }
	GetComparisonData()
	{
		// Get all distinct model keys with their latest timestamp
		var model_rows = this.store.Query(
			`SELECT Platform, ModelName, MAX( Timestamp ) AS LatestTs FROM "${TABLE_NAME}" GROUP BY Platform, ModelName ORDER BY ModelName`
		);

		if ( !model_rows.length ) { return { Models: [], Tests: [], Grid: {} }; }

		var models = [];
		var grid = {};
		var test_set = {};

		for ( var index = 0; index < model_rows.length; index++ )
		{
			var model_row = model_rows[ index ];
			var model_key = model_row.ModelName;
			models.push( { Platform: model_row.Platform, ModelName: model_row.ModelName } );

			var results = this.store.Query(
				`SELECT TestGroup, TestName, Passed, DurationMs FROM "${TABLE_NAME}" WHERE Platform = ? AND ModelName = ? AND Timestamp = ?`,
				[ model_row.Platform, model_row.ModelName, model_row.LatestTs ]
			);

			grid[ model_key ] = {};
			for ( var r = 0; r < results.length; r++ )
			{
				var result = results[ r ];
				var test_key = result.TestGroup ? ( result.TestGroup + '/' + result.TestName ) : result.TestName;
				grid[ model_key ][ test_key ] = {
					Passed: result.Passed === 1,
					DurationMs: result.DurationMs,
				};
				test_set[ test_key ] = true;
			}
		}

		var tests = Object.keys( test_set ).sort();

		return { Models: models, Tests: tests, Grid: grid };
	}


}


module.exports = ResultsStore;
