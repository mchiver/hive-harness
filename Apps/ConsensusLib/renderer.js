/*
	renderer.js
---------------------------------------------------------------------
Walks a completed (or in-progress) Consensus run and produces a
markdown report.
*/


const Repository = require( './repository.js' );


//---------------------------------------------------------------------
async function Render( Hive, RunId )
{
	var run = await Repository.GetRun( Hive, RunId );
	if ( !run ) { throw new Error( 'Run not found: ' + RunId ); }

	var nodes = await Repository.ListNodes( Hive, RunId );
	var by_id = {};
	for ( var i = 0; i < nodes.length; i++ ) { by_id[ nodes[ i ].NodeId ] = nodes[ i ]; }

	var resolved = nodes.filter( function ( n ) { return n.Status === 'resolved'; } );
	var dissented = nodes.filter( function ( n ) { return n.Status === 'dissented'; } );
	var open = nodes.filter( function ( n )
	{
		return n.Status !== 'resolved' && n.Status !== 'dissented';
	} );

	var lines = [];
	lines.push( '# ' + run.Issue );
	lines.push( '' );
	lines.push( '_Run `' + run.RunId + '` - status `' + run.Status + '` - turns ' + run.TurnCounter + ' / ' + run.MaxTurns + '_' );
	lines.push( '' );

	lines.push( '## Topic Tree' );
	for ( var t = 0; t < nodes.length; t++ )
	{
		var n = nodes[ t ];
		var indent = '  '.repeat( n.Depth );
		lines.push( indent + '- **' + n.NodeId + '** _(' + n.Status + ')_ ' + n.Question );
	}
	lines.push( '' );

	lines.push( '## Resolved Sub-Questions' );
	if ( !resolved.length ) { lines.push( '_(none)_' ); }
	for ( var r = 0; r < resolved.length; r++ )
	{
		lines.push( '### ' + resolved[ r ].NodeId + ' - ' + resolved[ r ].Question );
		lines.push( resolved[ r ].ResolutionText || '(no resolution text)' );
		if ( resolved[ r ].ResolutionBy ) { lines.push( '_proposed by ' + resolved[ r ].ResolutionBy + '_' ); }
		lines.push( '' );
	}

	lines.push( '## Recorded Dissent' );
	if ( !dissented.length ) { lines.push( '_(none)_' ); }
	for ( var d = 0; d < dissented.length; d++ )
	{
		var node = dissented[ d ];
		lines.push( '### ' + node.NodeId + ' - ' + node.Question );
		var parsed = null;
		try { parsed = node.DissentJson ? JSON.parse( node.DissentJson ) : null; } catch ( e ) { parsed = null; }
		if ( parsed && parsed.Summary ) { lines.push( parsed.Summary ); lines.push( '' ); }
		if ( parsed && parsed.Positions )
		{
			for ( var p = 0; p < parsed.Positions.length; p++ )
			{
				var pos = parsed.Positions[ p ];
				lines.push( '- **' + pos.ParticipantId + ':** ' + pos.Claim );
			}
		}
		lines.push( '' );
	}

	if ( open.length )
	{
		lines.push( '## Unresolved Sub-Questions' );
		for ( var o = 0; o < open.length; o++ )
		{
			lines.push( '- ' + open[ o ].NodeId + ' (' + open[ o ].Status + '): ' + open[ o ].Question );
		}
		lines.push( '' );
	}

	lines.push( '## Evidence' );
	var any_evidence = false;
	for ( var e = 0; e < nodes.length; e++ )
	{
		var ev = await Repository.ListEvidence( Hive, nodes[ e ].NodeId );
		for ( var k = 0; k < ev.length; k++ )
		{
			any_evidence = true;
			lines.push( '- _' + nodes[ e ].NodeId + '_ (' + ev[ k ].FetchedBy + '): ' + ev[ k ].Summary );
		}
	}
	if ( !any_evidence ) { lines.push( '_(none)_' ); }
	lines.push( '' );

	return lines.join( '\n' );
}


//---------------------------------------------------------------------
module.exports = {
	Render: Render,
};
