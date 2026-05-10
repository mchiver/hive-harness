/*
	SseService.js
---------------------------------------------------------------------
Manages SSE (Server-Sent Events) connection for real-time chat events.
*/

app.factory( 'SseService', [ '$rootScope', 'AuthService', function ( $rootScope, AuthService )
{
	var service = {};
	var event_source = null;
	var listeners = [];


	//---------------------------------------------------------------------
	service.Connect = function ( ConversationName )
	{
		service.Disconnect();

		var token = AuthService.GetToken();
		var url = '/api/chat/stream?conversation=' + encodeURIComponent( ConversationName );

		// EventSource doesn't support custom headers.
		// Pass token as query param — the middleware will need to check this too.
		url += '&token=' + encodeURIComponent( token );

		event_source = new EventSource( url );

		event_source.onmessage = function ( event )
		{
			var data = JSON.parse( event.data );
			$rootScope.$apply( function ()
			{
				for ( var i = 0; i < listeners.length; i++ )
				{
					listeners[ i ]( data );
				}
			} );
		};

		event_source.onerror = function ()
		{
			// EventSource auto-reconnects on error
		};
	};


	//---------------------------------------------------------------------
	service.Disconnect = function ()
	{
		if ( event_source )
		{
			event_source.close();
			event_source = null;
		}
	};


	//---------------------------------------------------------------------
	service.OnEvent = function ( Callback )
	{
		listeners.push( Callback );
		// Return unsubscribe function
		return function ()
		{
			var index = listeners.indexOf( Callback );
			if ( index > -1 ) { listeners.splice( index, 1 ); }
		};
	};


	//---------------------------------------------------------------------
	service.IsConnected = function ()
	{
		return event_source !== null && event_source.readyState !== EventSource.CLOSED;
	};


	return service;
} ] );
