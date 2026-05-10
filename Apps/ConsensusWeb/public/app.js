/*
	app.js (ConsensusWeb client)
---------------------------------------------------------------------
Tiny vanilla-JS front end. Lists runs, creates new ones, opens an
SSE stream against a selected run, and exposes pause / override /
abort / delete controls.
*/


//---------------------------------------------------------------------
var Active = null;
var Stream = null;


//---------------------------------------------------------------------
function $( Selector ) { return document.querySelector( Selector ); }


//---------------------------------------------------------------------
function escape_html( S )
{
	return ( S == null ? '' : String( S ) ).replace( /[&<>"']/g, function ( C )
	{
		return ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' } )[ C ];
	} );
}


//---------------------------------------------------------------------
async function api( Method, Path, Body )
{
	var opts = { method: Method, headers: {} };
	if ( Body !== undefined )
	{
		opts.headers[ 'Content-Type' ] = 'application/json';
		opts.body = JSON.stringify( Body );
	}
	var res = await fetch( Path, opts );
	if ( !res.ok )
	{
		var text = await res.text();
		throw new Error( res.status + ' ' + text );
	}
	var ctype = res.headers.get( 'content-type' ) || '';
	if ( ctype.indexOf( 'json' ) >= 0 ) { return await res.json(); }
	return await res.text();
}


//---------------------------------------------------------------------
async function load_runs()
{
	var runs = await api( 'GET', '/api/runs' );
	var ul = $( '#runs' );
	ul.innerHTML = '';
	if ( !runs.length )
	{
		ul.innerHTML = '<li class="empty">No runs yet. Click "New Run" to start one.</li>';
		return;
	}
	for ( var i = 0; i < runs.length; i++ )
	{
		var r = runs[ i ];
		var li = document.createElement( 'li' );
		li.innerHTML =
			'<a href="#" data-id="' + escape_html( r.RunId ) + '">' + escape_html( r.Issue ) + '</a>' +
			'<span class="meta">' + escape_html( r.Status ) + ' / turn ' + escape_html( r.TurnCounter ) +
			' / ' + escape_html( r.RunId ) + '</span>' +
			'<button data-del="' + escape_html( r.RunId ) + '" class="link-btn">delete</button>';
		ul.appendChild( li );
	}
}


//---------------------------------------------------------------------
async function select_run( RunId )
{
	close_stream();
	Active = RunId;
	var run = await api( 'GET', '/api/runs/' + RunId );
	$( '#run-issue' ).textContent = run.Issue;
	$( '#run-meta' ).textContent =
		'Run ' + run.RunId + ' - ' + run.Status +
		' / phase ' + ( run.Phase || '-' ) +
		' / turn ' + run.TurnCounter + '/' + run.MaxTurns +
		' / llm ' + run.Llm;
	$( '#transcript' ).innerHTML = '';
	$( '#runs-list' ).hidden = true;
	$( '#run-detail' ).hidden = false;

	var log = await api( 'GET', '/api/runs/' + RunId + '/log' );
	for ( var i = 0; i < log.length; i++ )
	{
		var t = log[ i ];
		append_line( t.Actor, t.Action + ( t.NodeId ? ' / ' + t.NodeId : '' ), t.Content );
	}
	open_stream( RunId );
}


//---------------------------------------------------------------------
var TEXT_FIELDS = [
	'Content', 'Response', 'Text', 'Message', 'Body',
	'ProposedResolution', 'Resolution', 'Rationale', 'Summary',
	'Critique', 'Claim', 'Position', 'Answer',
];


function unwrap_json( Src )
{
	var trimmed = Src.trim();
	var fence = trimmed.match( /^```(?:json)?\s*([\s\S]*?)\s*```$/i );
	if ( fence ) { trimmed = fence[ 1 ].trim(); }
	if ( !( trimmed.startsWith( '{' ) || trimmed.startsWith( '[' ) ) ) { return null; }
	try { var obj = JSON.parse( trimmed ); }
	catch ( e ) { return null; }
	if ( obj && typeof obj === 'object' && !Array.isArray( obj ) )
	{
		for ( var i = 0; i < TEXT_FIELDS.length; i++ )
		{
			var v = obj[ TEXT_FIELDS[ i ] ];
			if ( typeof v === 'string' && v.trim() ) { return v; }
		}
		var keys = Object.keys( obj );
		if ( keys.length === 1 && typeof obj[ keys[ 0 ] ] === 'string' ) { return obj[ keys[ 0 ] ]; }
	}
	return '```json\n' + JSON.stringify( obj, null, 2 ) + '\n```';
}


function render_content( Text )
{
	var src = Text == null ? '' : String( Text );
	var unwrapped = unwrap_json( src );
	if ( unwrapped !== null ) { src = unwrapped; }
	if ( window.marked && typeof window.marked.parse === 'function' )
	{
		try { return '<div class="content">' + window.marked.parse( src, { gfm: true, breaks: true } ) + '</div>'; }
		catch ( e ) { /* fall through */ }
	}
	return '<div class="content plain">' + escape_html( src ) + '</div>';
}


//---------------------------------------------------------------------
function estimate_tokens( Text )
{
	if ( !Text ) { return 0; }
	return Math.max( 1, Math.round( String( Text ).length / 4 ) );
}


//---------------------------------------------------------------------
function append_line( Actor, Action, Content )
{
	var el = document.createElement( 'div' );
	el.className = 'turn turn-' + ( Actor || 'system' );
	var tokens = estimate_tokens( Content );
	el.innerHTML =
		'<div class="head">' +
			'<span class="caret">▾</span>' +
			'<span class="actor">' + escape_html( Actor ) + '</span>' +
			'<span class="action">' + escape_html( Action ) + '</span>' +
			( tokens ? '<span class="tokens">~' + tokens + ' tok</span>' : '' ) +
		'</div>' +
		render_content( Content );
	$( '#transcript' ).appendChild( el );
	el.scrollIntoView( { block: 'end' } );
}


//---------------------------------------------------------------------
document.addEventListener( 'click', function ( Ev )
{
	var head = Ev.target.closest( '.turn .head' );
	if ( !head ) { return; }
	var turn = head.parentElement;
	turn.classList.toggle( 'collapsed' );
	var caret = head.querySelector( '.caret' );
	if ( caret ) { caret.textContent = turn.classList.contains( 'collapsed' ) ? '▸' : '▾'; }
} );


//---------------------------------------------------------------------
function close_stream()
{
	if ( Stream ) { Stream.close(); Stream = null; }
	remove_thinking();
}


//---------------------------------------------------------------------
function remove_thinking()
{
	var el = document.getElementById( 'thinking-placeholder' );
	if ( el ) { el.remove(); }
}


//---------------------------------------------------------------------
function open_stream( RunId )
{
	Stream = new EventSource( '/api/runs/' + RunId + '/stream' );

	Stream.addEventListener( 'thinking', function ( Ev )
	{
		var p = JSON.parse( Ev.data ).payload || {};
		remove_thinking();
		var el = document.createElement( 'div' );
		el.className = 'turn thinking turn-' + ( p.Actor || 'system' );
		el.id = 'thinking-placeholder';
		el.innerHTML =
			'<div class="head">' +
				'<span class="caret">▾</span>' +
				'<span class="actor">' + escape_html( p.Actor || 'system' ) + '</span>' +
				'<span class="action">thinking</span>' +
			'</div>' +
			'<div class="content plain">waiting on LLM<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>';
		$( '#transcript' ).appendChild( el );
		el.scrollIntoView( { block: 'end' } );
	} );

	Stream.addEventListener( 'decision', function ( Ev )
	{
		remove_thinking();
		var d = JSON.parse( Ev.data ).payload;
		var head = d.Action +
			( d.NodeId ? ' / ' + d.NodeId : '' ) +
			( d.ParticipantId ? ' -> ' + d.ParticipantId : '' );
		var parts = [];
		if ( d.Rationale ) { parts.push( '**why:**\n\n' + d.Rationale ); }
		if ( d.Instruction ) { parts.push( '**ask:**\n\n' + d.Instruction ); }
		if ( d.NewQuestion ) { parts.push( '**new question:**\n\n' + d.NewQuestion ); }
		if ( d.ProposedResolution ) { parts.push( '**proposal:**\n\n' + d.ProposedResolution ); }
		var body = parts.join( '\n\n' );
		append_line( 'moderator', head, body );
	} );

	Stream.addEventListener( 'contribution', function ( Ev )
	{
		remove_thinking();
		var e = JSON.parse( Ev.data ).payload;
		if ( e.Contribution.Skipped ) { return; }
		append_line( e.Decision.ParticipantId || 'system', e.Decision.Action, e.Contribution.Content );
	} );

	Stream.addEventListener( 'concluded', function ( Ev )
	{
		append_line( 'system', 'concluded', JSON.parse( Ev.data ).payload.Reason );
	} );
	Stream.addEventListener( 'stopped', function ( Ev )
	{
		append_line( 'system', 'stopped', JSON.parse( Ev.data ).payload.Reason );
	} );
	Stream.addEventListener( 'error', function ()
	{
		append_line( 'system', 'stream', '(stream error)' );
	} );
	Stream.addEventListener( 'paused', function () { append_line( 'system', 'paused', '' ); } );
	Stream.addEventListener( 'resumed', function () { append_line( 'system', 'resumed', '' ); } );
	Stream.addEventListener( 'aborted', function () { append_line( 'system', 'aborted', '' ); } );
	Stream.addEventListener( 'not-running', function ()
	{
		append_line( 'system', 'idle', 'Run is not currently active. Press Start / Resume.' );
	} );
}


//---------------------------------------------------------------------
async function refresh_meta()
{
	if ( !Active ) { return; }
	try
	{
		var run = await api( 'GET', '/api/runs/' + Active );
		$( '#run-meta' ).textContent =
			'Run ' + run.RunId + ' - ' + run.Status +
			' / phase ' + ( run.Phase || '-' ) +
			' / turn ' + run.TurnCounter + '/' + run.MaxTurns +
			' / llm ' + run.Llm;
	}
	catch ( e ) { /* ignore */ }
}


//---------------------------------------------------------------------
document.addEventListener( 'click', async function ( Ev )
{
	var link = Ev.target.closest( '[data-id]' );
	if ( link ) { Ev.preventDefault(); await select_run( link.dataset.id ); return; }

	var del = Ev.target.closest( '[data-del]' );
	if ( del )
	{
		if ( !confirm( 'Delete this run? This cannot be undone.' ) ) { return; }
		await api( 'DELETE', '/api/runs/' + del.dataset.del );
		await load_runs();
		return;
	}

	switch ( Ev.target.id )
	{
		case 'new-btn':
			$( '#new-dialog' ).showModal();
			break;
		case 'back-btn':
			close_stream();
			Active = null;
			$( '#run-detail' ).hidden = true;
			$( '#runs-list' ).hidden = false;
			await load_runs();
			break;
		case 'start-btn':
			await api( 'POST', '/api/runs/' + Active + '/start' );
			close_stream();
			open_stream( Active );
			await refresh_meta();
			break;
		case 'pause-btn':
			await api( 'POST', '/api/runs/' + Active + '/pause' );
			break;
		case 'abort-btn':
			await api( 'POST', '/api/runs/' + Active + '/abort' );
			break;
		case 'report-btn':
			var md = await api( 'GET', '/api/runs/' + Active + '/report' );
			var w = window.open( '', '_blank' );
			w.document.body.innerHTML = '<pre style="font:13px/1.5 monospace;padding:20px;">' + escape_html( md ) + '</pre>';
			break;
		case 'delete-btn':
			if ( !confirm( 'Delete this run? This cannot be undone.' ) ) { break; }
			await api( 'DELETE', '/api/runs/' + Active );
			close_stream();
			Active = null;
			$( '#run-detail' ).hidden = true;
			$( '#runs-list' ).hidden = false;
			await load_runs();
			break;
		case 'toggle-all-btn':
			var turns = document.querySelectorAll( '#transcript .turn' );
			var should_collapse = Ev.target.textContent.indexOf( 'Collapse' ) >= 0;
			for ( var i = 0; i < turns.length; i++ )
			{
				turns[ i ].classList.toggle( 'collapsed', should_collapse );
				var c = turns[ i ].querySelector( '.caret' );
				if ( c ) { c.textContent = should_collapse ? '▸' : '▾'; }
			}
			Ev.target.textContent = should_collapse ? 'Expand all' : 'Collapse all';
			break;
		case 'override-btn':
			var input = $( '#override-input' );
			var text = input.value.trim();
			if ( !text ) { break; }
			await api( 'POST', '/api/runs/' + Active + '/override', { Instruction: text } );
			input.value = '';
			break;
	}
} );


//---------------------------------------------------------------------
$( '#new-form' ).addEventListener( 'submit', async function ( Ev )
{
	if ( Ev.submitter && Ev.submitter.value !== 'create' ) { return; }
	var fd = new FormData( $( '#new-form' ) );
	var body = {
		Issue: fd.get( 'Issue' ),
		Llm: fd.get( 'Llm' ),
		MaxTurns: Number( fd.get( 'MaxTurns' ) ),
	};
	try
	{
		var run = await api( 'POST', '/api/runs', body );
		await load_runs();
		await select_run( run.RunId );
		await api( 'POST', '/api/runs/' + run.RunId + '/start' );
		close_stream();
		open_stream( run.RunId );
	}
	catch ( e )
	{
		alert( 'Could not create run: ' + e.message );
	}
} );


//---------------------------------------------------------------------
// Periodic meta refresh while viewing a run.
setInterval( refresh_meta, 4000 );


//---------------------------------------------------------------------
load_runs();
