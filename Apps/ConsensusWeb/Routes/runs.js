/*
	runs.js
---------------------------------------------------------------------
HTTP API for ConsensusWeb. Mounted under /api by server.js, after the
auth middleware has populated req.User and req.Hive.
*/


//---------------------------------------------------------------------
function wrap( Handler )
{
	return function ( Req, Res, Next )
	{
		Promise.resolve().then( function () { return Handler( Req, Res, Next ); } ).catch( Next );
	};
}


//---------------------------------------------------------------------
module.exports = function ( App, Ctx )
{
	var ConsensusLib = Ctx.ConsensusLib;
	var Sessions = Ctx.SessionRegistry;


	//---------------------------------------------------------------------
	App.post( '/api/init', wrap( async function ( Req, Res )
	{
		var llm = Req.body && Req.body.Llm;
		if ( !llm ) { Res.status( 400 ).json( { error: 'Llm required' } ); return; }
		await ConsensusLib.EnsureApp( Req.Hive, llm );
		Res.json( { ok: true } );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs', wrap( async function ( Req, Res )
	{
		Res.json( await ConsensusLib.ListRuns( Req.Hive ) );
	} ) );


	//---------------------------------------------------------------------
	App.post( '/api/runs', wrap( async function ( Req, Res )
	{
		var body = Req.body || {};
		var run = await ConsensusLib.NewRun( Req.Hive, {
			Issue: body.Issue,
			Llm: body.Llm,
			MaxTurns: body.MaxTurns,
		} );
		Res.json( run );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs/:id', wrap( async function ( Req, Res )
	{
		var run = await ConsensusLib.GetRun( Req.Hive, Req.params.id );
		if ( !run ) { Res.status( 404 ).json( { error: 'not found' } ); return; }
		Res.json( run );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs/:id/tree', wrap( async function ( Req, Res )
	{
		Res.json( await ConsensusLib.GetTopicTree( Req.Hive, Req.params.id ) );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs/:id/log', wrap( async function ( Req, Res )
	{
		Res.json( await ConsensusLib.GetTurnLog( Req.Hive, Req.params.id ) );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs/:id/report', wrap( async function ( Req, Res )
	{
		var report = await ConsensusLib.RenderReport( Req.Hive, Req.params.id );
		Res.type( 'text/markdown' ).send( report );
	} ) );


	//---------------------------------------------------------------------
	App.post( '/api/runs/:id/start', wrap( async function ( Req, Res )
	{
		var username = Req.User.UserName || Req.User.Username;
		if ( Sessions.Has( username, Req.params.id ) )
		{
			Res.json( { ok: true, alreadyRunning: true } );
			return;
		}
		await ConsensusLib.ResumeRun( Req.Hive, Req.params.id );
		var session = new ConsensusLib.Session( Req.Hive, Req.params.id );
		Sessions.Register( username, Req.params.id, session );
		// Fire-and-forget. Errors flow through 'error' / 'stopped' SSE events.
		session.Run().catch( function () { /* events convey error */ } );
		Res.json( { ok: true, started: true } );
	} ) );


	//---------------------------------------------------------------------
	App.post( '/api/runs/:id/pause', wrap( async function ( Req, Res )
	{
		var username = Req.User.UserName || Req.User.Username;
		var entry = Sessions.Get( username, Req.params.id );
		if ( entry ) { entry.session.Pause(); }
		else { await ConsensusLib.PauseRun( Req.Hive, Req.params.id ); }
		Res.json( { ok: true } );
	} ) );


	//---------------------------------------------------------------------
	App.post( '/api/runs/:id/abort', wrap( async function ( Req, Res )
	{
		var username = Req.User.UserName || Req.User.Username;
		var entry = Sessions.Get( username, Req.params.id );
		if ( entry ) { entry.session.Abort(); }
		else { await ConsensusLib.PauseRun( Req.Hive, Req.params.id ); }
		Res.json( { ok: true } );
	} ) );


	//---------------------------------------------------------------------
	App.post( '/api/runs/:id/override', wrap( async function ( Req, Res )
	{
		var instruction = Req.body && Req.body.Instruction;
		if ( !instruction || !String( instruction ).trim() )
		{
			Res.status( 400 ).json( { error: 'Instruction required' } );
			return;
		}
		await ConsensusLib.SubmitOverride( Req.Hive, Req.params.id, instruction );
		var username = Req.User.UserName || Req.User.Username;
		var entry = Sessions.Get( username, Req.params.id );
		if ( entry ) { entry.session.SetDirective( String( instruction ).trim() ); }
		Res.json( { ok: true } );
	} ) );


	//---------------------------------------------------------------------
	App.delete( '/api/runs/:id', wrap( async function ( Req, Res )
	{
		var username = Req.User.UserName || Req.User.Username;
		var entry = Sessions.Get( username, Req.params.id );
		if ( entry ) { entry.session.Abort(); }
		var result = await ConsensusLib.DeleteRun( Req.Hive, Req.params.id );
		Res.json( result );
	} ) );


	//---------------------------------------------------------------------
	App.get( '/api/runs/:id/stream', function ( Req, Res )
	{
		Res.set( 'Content-Type', 'text/event-stream' );
		Res.set( 'Cache-Control', 'no-cache' );
		Res.set( 'Connection', 'keep-alive' );
		Res.flushHeaders();
		Res.write( ': connected\n\n' );

		var username = Req.User.UserName || Req.User.Username;
		var entry = Sessions.Subscribe( username, Req.params.id, Res );
		if ( !entry )
		{
			Res.write( 'event: not-running\ndata: {}\n\n' );
		}

		// Heartbeat every 25s to keep proxies happy.
		var heartbeat = setInterval( function ()
		{
			try { Res.write( ': ping\n\n' ); } catch ( e ) { /* ignore */ }
		}, 25000 );
		Req.on( 'close', function () { clearInterval( heartbeat ); } );
	} );


};
