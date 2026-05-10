/*
	moderator.js
---------------------------------------------------------------------
Drives the next decision in a Consensus run.

Builds a structured snapshot of the run state, asks the Moderator
persona (a Conversation entity) to return a JSON decision, and parses
the result into a normalized Decision object. On a parse / schema
failure, sends one clarifying retry on the same conversation before
giving up.
*/


const Repository = require( './repository.js' );
const Provisioning = require( './provisioning.js' );


//---------------------------------------------------------------------
const ALLOWED_ACTIONS = [
	'INVESTIGATE', 'DELIBERATE', 'SPAWN_CHILD', 'CRITIQUE',
	'PROPOSE_RESOLUTION', 'MARK_DISSENT', 'CONCLUDE',
];


//---------------------------------------------------------------------
const SCHEMA_REMINDER = [
	'',
	'Reply with EXACTLY ONE JSON object inside a ```json fence using',
	'these PascalCase fields:',
	'  Action, NodeId, ParticipantId, Instruction, NewQuestion,',
	'  ProposedResolution, Rationale',
	'Allowed Action values: ' + ALLOWED_ACTIONS.join( ', ' ) + '.',
	'No other field names. No other Action values. No prose outside the fence.',
].join( '\n' );


//---------------------------------------------------------------------
function find_moderator( Run )
{
	for ( var i = 0; i < Run.Roster.length; i++ )
	{
		if ( Run.Roster[ i ].Role === 'Moderator' ) { return Run.Roster[ i ]; }
	}
	throw new Error( 'No Moderator participant in roster.' );
}


//---------------------------------------------------------------------
function format_roster( Run )
{
	var lines = [];
	for ( var i = 0; i < Run.Roster.length; i++ )
	{
		var m = Run.Roster[ i ];
		lines.push( '- ' + m.ParticipantId + ' (' + m.Role + ')' );
	}
	return lines.join( '\n' );
}


//---------------------------------------------------------------------
async function format_state( Hive, Run )
{
	var nodes = await Repository.ListNodes( Hive, Run.RunId );
	var lines = [ '## Topic Tree' ];
	for ( var i = 0; i < nodes.length; i++ )
	{
		var n = nodes[ i ];
		var indent = '  '.repeat( n.Depth );
		var line = indent + '- [' + n.NodeId + '] (' + n.Status + ') ' + n.Question;
		if ( n.ResolutionText ) { line += '  -> ' + n.ResolutionText; }
		lines.push( line );

		var positions = await Repository.ListPositions( Hive, n.NodeId );
		for ( var p = 0; p < positions.length; p++ )
		{
			var pos = positions[ p ];
			lines.push( indent + '    * position by ' + pos.ParticipantId + ' (turn ' + pos.Turn + '): ' + truncate( pos.Claim, 240 ) );
		}

		var evidence = await Repository.ListEvidence( Hive, n.NodeId );
		for ( var e = 0; e < evidence.length; e++ )
		{
			var ev = evidence[ e ];
			lines.push( indent + '    * evidence by ' + ev.FetchedBy + ' (turn ' + ev.Turn + '): ' + truncate( ev.Summary, 240 ) );
		}
	}
	return lines.join( '\n' );
}


//---------------------------------------------------------------------
async function format_recent_turns( Hive, Run, Count )
{
	var rows = await Repository.ListTurnLog( Hive, Run.RunId );
	var slice = rows.slice( -Count );
	if ( !slice.length ) { return '(no turns yet)'; }
	var lines = [];
	for ( var i = 0; i < slice.length; i++ )
	{
		var t = slice[ i ];
		lines.push( '- turn ' + t.Turn + ' [' + t.Actor + ' / ' + t.Action + ( t.NodeId ? ' / ' + t.NodeId : '' ) + ']: ' + truncate( t.Content || '', 200 ) );
	}
	return lines.join( '\n' );
}


//---------------------------------------------------------------------
function truncate( Text, Max )
{
	if ( !Text ) { return ''; }
	var clean = String( Text ).replace( /\s+/g, ' ' ).trim();
	if ( clean.length <= Max ) { return clean; }
	return clean.slice( 0, Max ) + '...';
}


//---------------------------------------------------------------------
function extract_json( Text )
{
	if ( !Text ) { return null; }
	var fenced = Text.match( /```json\s*([\s\S]*?)```/i );
	if ( fenced ) { return try_parse( fenced[ 1 ] ); }
	var fenced_any = Text.match( /```\s*([\s\S]*?)```/ );
	if ( fenced_any ) { return try_parse( fenced_any[ 1 ] ); }
	// Last resort: first {...} block.
	var brace = Text.match( /\{[\s\S]*\}/ );
	if ( brace ) { return try_parse( brace[ 0 ] ); }
	return null;
}


//---------------------------------------------------------------------
function try_parse( Text )
{
	try { return JSON.parse( Text ); } catch ( e ) { return null; }
}


//---------------------------------------------------------------------
function normalize_decision( Raw )
{
	if ( !Raw || typeof Raw !== 'object' ) { return null; }
	// Case-insensitive key access.
	var lc = {};
	for ( var k in Raw ) { lc[ k.toLowerCase() ] = Raw[ k ]; }
	var action_raw = lc[ 'action' ];
	if ( !action_raw ) { return null; }
	var action = String( action_raw ).toUpperCase().replace( /[ -]/g, '_' );
	if ( ALLOWED_ACTIONS.indexOf( action ) < 0 ) { return null; }
	return {
		Action: action,
		NodeId: lc[ 'nodeid' ] || null,
		ParticipantId: lc[ 'participantid' ] || null,
		Instruction: lc[ 'instruction' ] || '',
		NewQuestion: lc[ 'newquestion' ] || '',
		ProposedResolution: lc[ 'proposedresolution' ] || '',
		Rationale: lc[ 'rationale' ] || '',
	};
}


//---------------------------------------------------------------------
function build_correction( PriorText )
{
	return [
		'Your previous reply did not match the required schema:',
		truncate( PriorText, 400 ),
		'',
		'Please reply again with EXACTLY ONE JSON object inside a ```json fence,',
		'using ONLY these PascalCase fields:',
		'  Action, NodeId, ParticipantId, Instruction, NewQuestion, ProposedResolution, Rationale',
		'Allowed Action values: ' + ALLOWED_ACTIONS.join( ', ' ) + '.',
		'Do NOT use lowercase keys. Do NOT invent any other Action values.',
		'Do NOT include any prose outside the JSON fence.',
	].join( '\n' );
}


//---------------------------------------------------------------------
async function chat_once( Hive, ConvName, Text )
{
	var result = await Hive.InvokeTool( 'Conversation.Chat', {
		EntityName: ConvName,
		Text: Text,
	} );
	if ( result.Error ) { throw new Error( 'Moderator chat failed: ' + result.Error ); }
	return ( result.Result && result.Result.Response ) || '';
}


//---------------------------------------------------------------------
async function Decide( Hive, Run, Options )
{
	Options = Options || {};
	var moderator = find_moderator( Run );
	var conv_name = Provisioning.ConversationName( Run, moderator.ParticipantId );

	var state_block = await format_state( Hive, Run );
	var recent_block = await format_recent_turns( Hive, Run, 6 );
	var roster_block = format_roster( Run );

	var directive_block = '';
	if ( Options.Directive )
	{
		directive_block =
			'\n## Human Directive (HIGH PRIORITY)\n' +
			Options.Directive +
			'\n(Take this directive into account in your next decision.)\n';
	}

	var prompt =
		'## Issue\n' + Run.Issue + '\n\n' +
		'## Roster\n' + roster_block + '\n\n' +
		state_block + '\n\n' +
		'## Recent Turns\n' + recent_block + '\n' +
		directive_block + '\n' +
		SCHEMA_REMINDER;

	var text = await chat_once( Hive, conv_name, prompt );
	var decision = normalize_decision( extract_json( text ) );
	if ( decision ) { decision.RawText = text; return decision; }

	// One retry with an explicit correction in-channel.
	var correction = build_correction( text );
	var retry_text = await chat_once( Hive, conv_name, correction );
	var retry_decision = normalize_decision( extract_json( retry_text ) );
	if ( retry_decision ) { retry_decision.RawText = retry_text; return retry_decision; }

	throw new Error(
		'Moderator returned an unparseable or invalid decision after retry.\n' +
		'First reply: ' + truncate( text, 300 ) + '\n' +
		'Retry reply: ' + truncate( retry_text, 300 ),
	);
}


//---------------------------------------------------------------------
module.exports = {
	Decide: Decide,
	ALLOWED_ACTIONS: ALLOWED_ACTIONS,
};
