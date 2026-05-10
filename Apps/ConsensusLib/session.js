/*
	session.js
---------------------------------------------------------------------
Drives the Consensus run loop and emits events for any attached UI.

Events:
	'turn-start'    { RunId, Turn }
	'decision'      Decision object from the Moderator
	'contribution'  { Decision, Contribution }
	'turn-end'      { RunId, Turn }
	'paused'        ()
	'resumed'       ()
	'aborted'       ()
	'concluded'     { Reason: 'moderator' | 'max-turns' }
	'stopped'       { Reason: 'aborted' | 'error' }
	'error'         Error
	'warning'       string

Controls:
	Pause()           - flag a pause; loop will idle before next turn
	Resume()          - clear the pause flag
	SetDirective(t)   - inject a moderator directive and clear pause
	Abort()           - stop after current iteration; status -> 'paused'
*/


const EVENTS = require( 'events' );

const Repository = require( './repository.js' );
const Moderator = require( './moderator.js' );
const Participants = require( './participants.js' );


//---------------------------------------------------------------------
function sleep( Ms )
{
	return new Promise( function ( r ) { setTimeout( r, Ms ); } );
}


//---------------------------------------------------------------------
function phase_for_action( Action )
{
	switch ( Action )
	{
		case 'INVESTIGATE':        return 'investigate';
		case 'DELIBERATE':         return 'deliberate';
		case 'SPAWN_CHILD':        return 'frame';
		case 'PROPOSE_RESOLUTION': return 'converge';
		case 'CRITIQUE':           return 'converge';
		case 'MARK_DISSENT':       return 'converge';
		case 'CONCLUDE':           return 'conclude';
		default:                   return 'frame';
	}
}


//---------------------------------------------------------------------
class Session extends EVENTS.EventEmitter
{


	//---------------------------------------------------------------------
	constructor( Hive, RunId )
	{
		super();
		this.Hive = Hive;
		this.RunId = RunId;
		this.paused = false;
		this.aborted = false;
		this.directive = null;
		this.running = false;
	}


	//---------------------------------------------------------------------
	Pause()
	{
		if ( this.paused ) { return; }
		this.paused = true;
		this.emit( 'paused' );
	}


	//---------------------------------------------------------------------
	Resume()
	{
		if ( !this.paused ) { return; }
		this.paused = false;
		this.directive = null;
		this.emit( 'resumed' );
	}


	//---------------------------------------------------------------------
	SetDirective( Text )
	{
		var clean = String( Text || '' ).trim();
		if ( !clean ) { this.Resume(); return; }
		this.directive = clean;
		this.paused = false;
		this.emit( 'resumed' );
	}


	//---------------------------------------------------------------------
	Abort()
	{
		this.aborted = true;
		this.paused = false;
		this.emit( 'aborted' );
	}


	//---------------------------------------------------------------------
	IsRunning()
	{
		return this.running;
	}


	//---------------------------------------------------------------------
	async Run()
	{
		if ( this.running ) { throw new Error( 'Session is already running.' ); }
		this.running = true;
		try
		{
			await this._loop();
		}
		finally
		{
			this.running = false;
		}
	}


	//---------------------------------------------------------------------
	async _loop()
	{
		var hive = this.Hive;
		var run_id = this.RunId;

		while ( true )
		{
			if ( this.aborted )
			{
				await Repository.UpdateRun( hive, run_id, { Status: 'paused' } );
				this.emit( 'stopped', { Reason: 'aborted' } );
				return;
			}

			while ( this.paused && !this.aborted && !this.directive )
			{
				await sleep( 100 );
			}
			if ( this.aborted ) { continue; }

			var run = await Repository.GetRun( hive, run_id );
			if ( !run )
			{
				this.emit( 'error', new Error( 'Run vanished: ' + run_id ) );
				this.emit( 'stopped', { Reason: 'error' } );
				return;
			}

			if ( run.TurnCounter >= run.MaxTurns )
			{
				await Repository.UpdateRun( hive, run_id, {
					Status: 'concluded',
					Phase: 'conclude',
					ConcludedAt: new Date().toISOString(),
				} );
				this.emit( 'concluded', { Reason: 'max-turns' } );
				return;
			}

			var pending = this.directive
				? { Instruction: this.directive }
				: await Repository.PopPendingOverride( hive, run_id );
			this.directive = null;

			this.emit( 'turn-start', { RunId: run_id, Turn: run.TurnCounter } );
			this.emit( 'thinking', { Actor: 'moderator', For: 'decision' } );

			var decision;
			try
			{
				decision = await Moderator.Decide( hive, run, {
					Directive: pending ? pending.Instruction : null,
				} );
			}
			catch ( e )
			{
				await Repository.UpdateRun( hive, run_id, { Status: 'paused' } );
				this.emit( 'error', e );
				this.emit( 'stopped', { Reason: 'error' } );
				return;
			}

			this.emit( 'decision', decision );

			if ( decision.Action === 'CONCLUDE' )
			{
				await Repository.AppendTurnLog( hive, {
					RunId: run_id,
					Turn: run.TurnCounter,
					Actor: 'moderator',
					Action: 'CONCLUDE',
					NodeId: null,
					Content: decision.Rationale || '',
					CreatedAt: new Date().toISOString(),
				} );
				await Repository.UpdateRun( hive, run_id, {
					Status: 'concluded',
					Phase: 'conclude',
					ConcludedAt: new Date().toISOString(),
				} );
				this.emit( 'concluded', { Reason: 'moderator' } );
				return;
			}

			var skipped_actions = [ 'SPAWN_CHILD', 'MARK_DISSENT', 'CONCLUDE' ];
			if ( skipped_actions.indexOf( decision.Action ) < 0 )
			{
				this.emit( 'thinking', {
					Actor: decision.ParticipantId || 'participant',
					For: 'contribution',
				} );
			}

			var contribution;
			try
			{
				contribution = await Participants.PerformTurn( hive, run, decision );
			}
			catch ( e )
			{
				await Repository.UpdateRun( hive, run_id, { Status: 'paused' } );
				this.emit( 'error', e );
				this.emit( 'stopped', { Reason: 'error' } );
				return;
			}

			this.emit( 'contribution', { Decision: decision, Contribution: contribution } );

			await Participants.ApplyDecision( hive, run, decision, contribution );

			await Repository.UpdateRun( hive, run_id, {
				TurnCounter: run.TurnCounter + 1,
				Phase: phase_for_action( decision.Action ),
			} );

			this.emit( 'turn-end', { RunId: run_id, Turn: run.TurnCounter + 1 } );
		}
	}


}


//---------------------------------------------------------------------
module.exports = {
	Session: Session,
};
