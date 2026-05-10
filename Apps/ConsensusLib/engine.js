/*
	engine.js
---------------------------------------------------------------------
High-level Consensus operations. UI-agnostic - takes an open Hive and
returns plain data. The interactive run loop lives in session.js and
emits events, so different UIs (CLI, Web) can attach without forking
the core logic.
*/


const Provisioning = require( './provisioning.js' );
const Repository = require( './repository.js' );
const SkillTemplates = require( './skill_templates.js' );
const Renderer = require( './renderer.js' );


//---------------------------------------------------------------------
function GenerateRunId()
{
	var stamp = new Date().toISOString().replace( /[-:.TZ]/g, '' ).slice( 0, 14 );
	var rand = Math.random().toString( 36 ).slice( 2, 6 );
	return 'r' + stamp + '-' + rand;
}


//---------------------------------------------------------------------
async function EnsureApp( Hive, LlmName, Log )
{
	await Provisioning.EnsureApp( Hive, LlmName, Log );
}


//---------------------------------------------------------------------
async function NewRun( Hive, Options )
{
	if ( !Options || !Options.Issue ) { throw new Error( 'NewRun requires Options.Issue.' ); }
	if ( !Options.Llm ) { throw new Error( 'NewRun requires Options.Llm.' ); }

	var max_turns = Number( Options.MaxTurns || 40 );
	var roster = Options.Roster || SkillTemplates.DEFAULT_ROSTER;

	await Provisioning.EnsureApp( Hive, Options.Llm );

	var now = new Date().toISOString();
	var run = {
		RunId: GenerateRunId(),
		Issue: Options.Issue,
		Status: 'active',
		Phase: 'frame',
		CreatedAt: now,
		Roster: roster,
		TurnCounter: 0,
		MaxTurns: max_turns,
		Llm: Options.Llm,
	};
	await Repository.CreateRun( Hive, run );
	await Provisioning.EnsureRunConversations( Hive, run );

	await Repository.InsertNode( Hive, {
		NodeId: run.RunId + ':n1',
		RunId: run.RunId,
		ParentId: null,
		Depth: 0,
		Question: Options.Issue,
		Status: 'open',
		CreatedAt: now,
		UpdatedAt: now,
	} );

	return run;
}


//---------------------------------------------------------------------
async function ResumeRun( Hive, RunId )
{
	var run = await Repository.GetRun( Hive, RunId );
	if ( !run ) { throw new Error( 'Run not found: ' + RunId ); }
	if ( run.Status !== 'concluded' )
	{
		await Repository.UpdateRun( Hive, RunId, { Status: 'active' } );
		run = await Repository.GetRun( Hive, RunId );
	}
	return run;
}


//---------------------------------------------------------------------
async function GetRun( Hive, RunId )
{
	return await Repository.GetRun( Hive, RunId );
}


//---------------------------------------------------------------------
async function ListRuns( Hive )
{
	return await Repository.ListRuns( Hive );
}


//---------------------------------------------------------------------
async function DeleteRun( Hive, RunId )
{
	var run = await Repository.GetRun( Hive, RunId );
	if ( !run ) { throw new Error( 'Run not found: ' + RunId ); }

	var deleted = [];
	var skipped = [];
	for ( var i = 0; i < run.Roster.length; i++ )
	{
		var name = Provisioning.ConversationName( run, run.Roster[ i ].ParticipantId );
		try
		{
			await Hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: name } );
			deleted.push( name );
		}
		catch ( e )
		{
			skipped.push( { Name: name, Error: e.message } );
		}
	}
	await Repository.DeleteRun( Hive, RunId );
	return { RunId: RunId, DeletedConversations: deleted, SkippedConversations: skipped };
}


//---------------------------------------------------------------------
async function SubmitOverride( Hive, RunId, Instruction )
{
	if ( !Instruction || !String( Instruction ).trim() )
	{
		throw new Error( 'SubmitOverride requires a non-empty Instruction.' );
	}
	var run = await Repository.GetRun( Hive, RunId );
	if ( !run ) { throw new Error( 'Run not found: ' + RunId ); }
	await Repository.InsertOverride( Hive, RunId, run.TurnCounter, String( Instruction ).trim() );
}


//---------------------------------------------------------------------
async function PauseRun( Hive, RunId )
{
	var run = await Repository.GetRun( Hive, RunId );
	if ( !run ) { throw new Error( 'Run not found: ' + RunId ); }
	await Repository.UpdateRun( Hive, RunId, { Status: 'paused' } );
}


//---------------------------------------------------------------------
async function RenderReport( Hive, RunId )
{
	return await Renderer.Render( Hive, RunId );
}


//---------------------------------------------------------------------
async function GetTurnLog( Hive, RunId )
{
	return await Repository.ListTurnLog( Hive, RunId );
}


//---------------------------------------------------------------------
async function GetTopicTree( Hive, RunId )
{
	return await Repository.ListNodes( Hive, RunId );
}


//---------------------------------------------------------------------
module.exports = {
	GenerateRunId: GenerateRunId,
	EnsureApp: EnsureApp,
	NewRun: NewRun,
	ResumeRun: ResumeRun,
	GetRun: GetRun,
	ListRuns: ListRuns,
	DeleteRun: DeleteRun,
	SubmitOverride: SubmitOverride,
	PauseRun: PauseRun,
	RenderReport: RenderReport,
	GetTurnLog: GetTurnLog,
	GetTopicTree: GetTopicTree,
};
