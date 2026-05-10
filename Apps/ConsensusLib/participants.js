/*
	participants.js
---------------------------------------------------------------------
Executes a single turn against the participant chosen by the Moderator.

PerformTurn handles INVESTIGATE / DELIBERATE / CRITIQUE / PROPOSE_RESOLUTION
by dispatching to the participant's Conversation entity.

ApplyDecision persists the side-effects of the turn (positions, evidence,
node-status transitions, child nodes, dissents).
*/


const Repository = require( './repository.js' );
const Provisioning = require( './provisioning.js' );


//---------------------------------------------------------------------
function find_participant( Run, ParticipantId )
{
	for ( var i = 0; i < Run.Roster.length; i++ )
	{
		if ( Run.Roster[ i ].ParticipantId === ParticipantId ) { return Run.Roster[ i ]; }
	}
	return null;
}


//---------------------------------------------------------------------
async function build_node_context( Hive, NodeId )
{
	var node = await Repository.GetNode( Hive, NodeId );
	if ( !node ) { return '(node not found: ' + NodeId + ')'; }
	var positions = await Repository.ListPositions( Hive, NodeId );
	var evidence = await Repository.ListEvidence( Hive, NodeId );

	var lines = [];
	lines.push( '## Sub-question (' + node.NodeId + ')' );
	lines.push( node.Question );
	lines.push( '' );
	if ( evidence.length )
	{
		lines.push( '## Evidence on record' );
		for ( var i = 0; i < evidence.length; i++ )
		{
			lines.push( '- (' + evidence[ i ].FetchedBy + ', turn ' + evidence[ i ].Turn + ') ' + evidence[ i ].Summary );
		}
		lines.push( '' );
	}
	if ( positions.length )
	{
		lines.push( '## Positions on record' );
		for ( var p = 0; p < positions.length; p++ )
		{
			lines.push( '- (' + positions[ p ].ParticipantId + ', turn ' + positions[ p ].Turn + ') ' + positions[ p ].Claim );
		}
		lines.push( '' );
	}
	if ( node.ResolutionText )
	{
		lines.push( '## Proposed resolution' );
		lines.push( node.ResolutionText );
		lines.push( '' );
	}
	return lines.join( '\n' );
}


//---------------------------------------------------------------------
async function PerformTurn( Hive, Run, Decision )
{
	// Actions that don't dispatch to a participant.
	if ( Decision.Action === 'SPAWN_CHILD'
		|| Decision.Action === 'MARK_DISSENT'
		|| Decision.Action === 'CONCLUDE' )
	{
		return { Content: Decision.Instruction || Decision.Rationale || '', Skipped: true };
	}

	if ( !Decision.ParticipantId )
	{
		throw new Error( 'Decision ' + Decision.Action + ' requires a ParticipantId.' );
	}
	var participant = find_participant( Run, Decision.ParticipantId );
	if ( !participant )
	{
		throw new Error( 'Unknown participant: ' + Decision.ParticipantId );
	}
	var conv_name = Provisioning.ConversationName( Run, participant.ParticipantId );

	var node_context = Decision.NodeId ? await build_node_context( Hive, Decision.NodeId ) : '';

	var prompt =
		'## Issue\n' + Run.Issue + '\n\n' +
		node_context + '\n' +
		'## Moderator Instruction\n' + ( Decision.Instruction || '(no further instruction)' );

	if ( Decision.Action === 'CRITIQUE' && Decision.ProposedResolution )
	{
		prompt += '\n\n## Resolution under critique\n' + Decision.ProposedResolution;
	}

	var result = await Hive.InvokeTool( 'Conversation.Chat', {
		EntityName: conv_name,
		Text: prompt,
	} );
	if ( result.Error ) { throw new Error( 'Participant chat failed: ' + result.Error ); }
	var content = ( result.Result && result.Result.Response ) || '';
	return { Content: content, Skipped: false };
}


//---------------------------------------------------------------------
async function ApplyDecision( Hive, Run, Decision, Contribution )
{
	var now = new Date().toISOString();
	var turn = Run.TurnCounter;

	// Always log the moderator decision itself.
	await Repository.AppendTurnLog( Hive, {
		RunId: Run.RunId, Turn: turn, Actor: 'moderator',
		Action: Decision.Action, NodeId: Decision.NodeId,
		Content: Decision.Rationale || '', CreatedAt: now,
	} );

	switch ( Decision.Action )
	{

		case 'INVESTIGATE':
			await Repository.InsertEvidence( Hive, {
				NodeId: Decision.NodeId, FetchedBy: Decision.ParticipantId,
				Summary: Contribution.Content, Turn: turn, CreatedAt: now,
			} );
			await Repository.UpdateNode( Hive, Decision.NodeId, { Status: 'investigating', UpdatedAt: now } );
			break;

		case 'DELIBERATE':
			await Repository.InsertPosition( Hive, {
				NodeId: Decision.NodeId, ParticipantId: Decision.ParticipantId,
				Claim: Contribution.Content, Turn: turn, CreatedAt: now,
			} );
			await Repository.UpdateNode( Hive, Decision.NodeId, { Status: 'contested', UpdatedAt: now } );
			break;

		case 'SPAWN_CHILD':
			var parent = await Repository.GetNode( Hive, Decision.NodeId );
			if ( !parent ) { throw new Error( 'SPAWN_CHILD parent not found: ' + Decision.NodeId ); }
			var child_id = await next_node_id( Hive, Run.RunId );
			await Repository.InsertNode( Hive, {
				NodeId: child_id, RunId: Run.RunId, ParentId: parent.NodeId,
				Depth: ( parent.Depth || 0 ) + 1,
				Question: Decision.NewQuestion || '(unspecified sub-question)',
				Status: 'open', CreatedAt: now, UpdatedAt: now,
			} );
			break;

		case 'PROPOSE_RESOLUTION':
			await Repository.UpdateNode( Hive, Decision.NodeId, {
				Status: 'proposed',
				ResolutionText: Decision.ProposedResolution || Contribution.Content,
				ResolutionBy: Decision.ParticipantId,
				UpdatedAt: now,
			} );
			break;

		case 'CRITIQUE':
			var verdict = parse_critique( Contribution.Content );
			if ( verdict === 'HOLDS' )
			{
				await Repository.UpdateNode( Hive, Decision.NodeId, { Status: 'resolved', UpdatedAt: now } );
			}
			else
			{
				await Repository.UpdateNode( Hive, Decision.NodeId, {
					Status: 'contested',
					ResolutionText: null,
					ResolutionBy: null,
					UpdatedAt: now,
				} );
			}
			await Repository.InsertPosition( Hive, {
				NodeId: Decision.NodeId, ParticipantId: Decision.ParticipantId,
				Claim: '[critique:' + verdict + '] ' + Contribution.Content,
				Turn: turn, CreatedAt: now,
			} );
			break;

		case 'MARK_DISSENT':
			var positions = await Repository.ListPositions( Hive, Decision.NodeId );
			var dissent = { Summary: Decision.Instruction || '', Positions: positions };
			await Repository.UpdateNode( Hive, Decision.NodeId, {
				Status: 'dissented',
				DissentJson: JSON.stringify( dissent ),
				UpdatedAt: now,
			} );
			break;

		case 'CONCLUDE':
			break;
	}

	// Log the participant contribution if there was one.
	if ( !Contribution.Skipped )
	{
		await Repository.AppendTurnLog( Hive, {
			RunId: Run.RunId, Turn: turn, Actor: Decision.ParticipantId || 'system',
			Action: Decision.Action + ':response', NodeId: Decision.NodeId,
			Content: Contribution.Content, CreatedAt: now,
		} );
	}
}


//---------------------------------------------------------------------
function parse_critique( Text )
{
	if ( !Text ) { return 'REJECTED'; }
	var upper = Text.toUpperCase();
	if ( upper.indexOf( 'RESOLUTION HOLDS' ) >= 0 ) { return 'HOLDS'; }
	if ( upper.indexOf( 'RESOLUTION REJECTED' ) >= 0 ) { return 'REJECTED'; }
	return 'REJECTED';
}


//---------------------------------------------------------------------
async function next_node_id( Hive, RunId )
{
	var rows = await Repository.Query(
		Hive,
		'SELECT NodeId FROM issue_nodes WHERE RunId = ?',
		[ RunId ],
	);
	var max = 0;
	for ( var i = 0; i < rows.length; i++ )
	{
		var m = String( rows[ i ].NodeId ).match( /n(\d+)$/ );
		if ( m )
		{
			var n = parseInt( m[ 1 ], 10 );
			if ( n > max ) { max = n; }
		}
	}
	return RunId + ':n' + ( max + 1 );
}


//---------------------------------------------------------------------
async function CountUnresolvedNodes( Hive, RunId )
{
	var rows = await Repository.Query(
		Hive,
		'SELECT COUNT(*) AS c FROM issue_nodes WHERE RunId = ? AND Status NOT IN ( ?, ? )',
		[ RunId, 'resolved', 'dissented' ],
	);
	return ( rows[ 0 ] && rows[ 0 ].c ) || 0;
}


//---------------------------------------------------------------------
module.exports = {
	PerformTurn: PerformTurn,
	ApplyDecision: ApplyDecision,
	CountUnresolvedNodes: CountUnresolvedNodes,
};
