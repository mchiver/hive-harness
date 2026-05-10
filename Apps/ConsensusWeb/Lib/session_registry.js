/*
	session_registry.js
---------------------------------------------------------------------
In-memory registry of active ConsensusLib.Session instances, keyed by
'<username>:<runId>' so runs are isolated per user.

Each entry maintains a small ring buffer of recent events so a late
SSE subscriber sees the immediate history of what the run has done,
not just events that arrive after their connection opens.
*/


const MAX_BUFFER = 200;
const EVENT_NAMES = [
	'turn-start', 'thinking', 'decision', 'contribution', 'turn-end',
	'paused', 'resumed', 'aborted', 'concluded', 'stopped', 'error',
];


//---------------------------------------------------------------------
function sse_send( Res, Event )
{
	try
	{
		Res.write( 'event: ' + Event.type + '\n' );
		Res.write( 'data: ' + JSON.stringify( Event ) + '\n\n' );
	}
	catch ( e ) { /* connection probably closed */ }
}


//---------------------------------------------------------------------
class SessionRegistry
{


	constructor()
	{
		this.entries = new Map();
	}


	Key( Username, RunId )
	{
		return Username + ':' + RunId;
	}


	Has( Username, RunId )
	{
		return this.entries.has( this.Key( Username, RunId ) );
	}


	Get( Username, RunId )
	{
		return this.entries.get( this.Key( Username, RunId ) );
	}


	Register( Username, RunId, SessionInstance )
	{
		var key = this.Key( Username, RunId );
		var entry = {
			session: SessionInstance,
			username: Username,
			runId: RunId,
			buffer: [],
			subscribers: new Set(),
		};

		var self = this;
		var emit = function ( Type, Payload )
		{
			var event = { type: Type, payload: Payload, time: Date.now() };
			entry.buffer.push( event );
			if ( entry.buffer.length > MAX_BUFFER ) { entry.buffer.shift(); }
			for ( var res of entry.subscribers ) { sse_send( res, event ); }
		};

		for ( var i = 0; i < EVENT_NAMES.length; i++ )
		{
			( function ( Name )
			{
				SessionInstance.on( Name, function ( Payload )
				{
					if ( Name === 'error' )
					{
						emit( Name, { message: Payload && Payload.message ? Payload.message : String( Payload ) } );
					}
					else
					{
						emit( Name, Payload === undefined ? null : Payload );
					}
				} );
			} )( EVENT_NAMES[ i ] );
		}

		// Drop the entry shortly after the run ends, so the buffer can be
		// drained by reconnecting subscribers but doesn't accumulate forever.
		var schedule_cleanup = function ()
		{
			setTimeout( function ()
			{
				if ( self.entries.get( key ) === entry ) { self.entries.delete( key ); }
			}, 30 * 1000 );
		};
		SessionInstance.on( 'concluded', schedule_cleanup );
		SessionInstance.on( 'stopped', schedule_cleanup );

		this.entries.set( key, entry );
		return entry;
	}


	Subscribe( Username, RunId, Res )
	{
		var entry = this.Get( Username, RunId );
		if ( !entry ) { return null; }
		for ( var i = 0; i < entry.buffer.length; i++ )
		{
			sse_send( Res, entry.buffer[ i ] );
		}
		entry.subscribers.add( Res );
		Res.on( 'close', function ()
		{
			entry.subscribers.delete( Res );
		} );
		return entry;
	}


}


//---------------------------------------------------------------------
module.exports = {
	SessionRegistry: SessionRegistry,
	sse_send: sse_send,
};
