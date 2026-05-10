/*
	ChatController.js
---------------------------------------------------------------------
Chat view: conversation switcher, message list with SSE updates,
input bar with autocomplete, elapsed timer.
*/

app.controller( 'ChatController', [ '$scope', '$timeout', '$interval', 'ApiService', 'SseService', 'AuthService',
function ( $scope, $timeout, $interval, ApiService, SseService, AuthService )
{
	$scope.Conversations = [];
	$scope.SelectedConversation = '';
	$scope.Messages = [];
	$scope.InputText = '';
	$scope.Sending = false;
	$scope.Loading = false;
	$scope.Error = '';
	$scope.Connected = false;
	$scope.StatusText = '';
	$scope.ElapsedTime = '';
	$scope.Suggestions = [];
	$scope.ShowSuggestions = false;

	var unsubscribe_sse = null;
	var suggest_timer = null;
	var elapsed_interval = null;
	var send_start_time = null;


	//---------------------------------------------------------------------
	function Log( message )
	{
		console.log( '[Chat]', message );
	}


	//---------------------------------------------------------------------
	function StartTimer()
	{
		send_start_time = Date.now();
		$scope.ElapsedTime = '0.0s';

		if ( elapsed_interval ) { $interval.cancel( elapsed_interval ); }
		elapsed_interval = $interval( function ()
		{
			var elapsed = ( Date.now() - send_start_time ) / 1000;
			$scope.ElapsedTime = elapsed.toFixed( 1 ) + 's';
		}, 100 );
	}


	//---------------------------------------------------------------------
	function StopTimer()
	{
		if ( elapsed_interval )
		{
			$interval.cancel( elapsed_interval );
			elapsed_interval = null;
		}
		// Keep final time displayed
		if ( send_start_time )
		{
			var elapsed = ( Date.now() - send_start_time ) / 1000;
			$scope.ElapsedTime = elapsed.toFixed( 1 ) + 's';
			send_start_time = null;
		}
	}


	//---------------------------------------------------------------------
	function LoadConversations()
	{
		Log( 'Loading conversations...' );

		ApiService.ListConversations()
			.then( function ( data )
			{
				$scope.Conversations = data.Conversations || [];
				Log( 'Loaded ' + $scope.Conversations.length + ' conversations' );

				// Auto-select first conversation if none selected
				if ( !$scope.SelectedConversation && $scope.Conversations.length > 0 )
				{
					$scope.SelectConversation( $scope.Conversations[ 0 ].ConversationName );
				}
			} )
			.catch( function ( error )
			{
				Log( 'Failed to load conversations: ' + ( error.data && error.data.Error || error.statusText || 'unknown' ) );
				$scope.Error = 'Failed to load conversations.';
			} );
	}


	//---------------------------------------------------------------------
	$scope.SelectConversation = function ( ConversationName )
	{
		Log( 'Selecting conversation: ' + ConversationName );
		$scope.SelectedConversation = ConversationName;
		$scope.Messages = [];
		$scope.Error = '';
		$scope.StatusText = '';
		$scope.ElapsedTime = '';

		ConnectSse( ConversationName );
		LoadHistory( ConversationName );
	};


	//---------------------------------------------------------------------
	function LoadHistory( ConversationName )
	{
		$scope.Loading = true;
		Log( 'Loading history for: ' + ConversationName );

		ApiService.GetHistory( ConversationName, 50 )
			.then( function ( data )
			{
				$scope.Messages = data.Messages || [];
				$scope.Loading = false;
				Log( 'Loaded ' + $scope.Messages.length + ' messages' );
				ScrollToBottom();
			} )
			.catch( function ( error )
			{
				Log( 'Failed to load history: ' + ( error.data && error.data.Error || error.statusText || 'unknown' ) );
				$scope.Error = 'Failed to load chat history.';
				$scope.Loading = false;
			} );
	}


	//---------------------------------------------------------------------
	function ConnectSse( ConversationName )
	{
		if ( unsubscribe_sse ) { unsubscribe_sse(); }
		SseService.Disconnect();

		Log( 'Connecting SSE for: ' + ConversationName );
		SseService.Connect( ConversationName );
		$scope.Connected = SseService.IsConnected();

		unsubscribe_sse = SseService.OnEvent( function ( event )
		{
			Log( 'SSE event: ' + JSON.stringify( event ) );
			HandleSseEvent( event );
		} );

		$scope.Connected = true;
	}


	//---------------------------------------------------------------------
	function HandleSseEvent( Event )
	{
		switch ( Event.Type )
		{
			case 'conversation.prompt.built':
				$scope.StatusText = 'Sent (' + ( Event.Tokens || '?' ) + ' tokens)';
				break;

			case 'conversation.tool.start':
				$scope.StatusText = 'Tool: ' + Event.ToolName;
				break;

			case 'conversation.tool.complete':
				$scope.StatusText = 'Tool: ' + Event.ToolName + ' (' + ( Event.Status || 'ok' ) + ')';
				break;

			case 'conversation.response':
				$scope.StatusText = 'Done';
				$scope.Sending = false;
				StopTimer();
				LoadHistory( $scope.SelectedConversation );

				// Clear status after a moment
				$timeout( function ()
				{
					if ( $scope.StatusText === 'Done' )
					{
						$scope.StatusText = '';
						$scope.ElapsedTime = '';
					}
				}, 3000 );
				break;

			default:
				break;
		}
	}


	//---------------------------------------------------------------------
	$scope.Send = function ()
	{
		var text = ( $scope.InputText || '' ).trim();
		if ( !text || $scope.Sending ) { return; }
		if ( !$scope.SelectedConversation )
		{
			$scope.Error = 'No conversation selected.';
			return;
		}

		$scope.Sending = true;
		$scope.Error = '';
		$scope.ShowSuggestions = false;
		$scope.StatusText = 'Sending...';
		StartTimer();

		Log( 'Sending message to ' + $scope.SelectedConversation + ': ' + text );

		// Optimistically add user message
		$scope.Messages.push( {
			Username: AuthService.GetUser().UserName || 'user',
			Text: text,
			Timestamp: new Date().toISOString(),
			LlmName: '',
			Tools: [],
		} );
		$scope.InputText = '';
		ScrollToBottom();

		ApiService.SendChat( $scope.SelectedConversation, text )
			.then( function ( data )
			{
				Log( 'Chat response received: ' + JSON.stringify( data ).substring( 0, 200 ) );
				// SSE response event handles the rest (Done status, timer stop, history reload)
				// But if SSE didn't fire (e.g. disconnected), handle it here as fallback
				if ( $scope.Sending )
				{
					$scope.Sending = false;
					$scope.StatusText = 'Done';
					StopTimer();
					LoadHistory( $scope.SelectedConversation );

					$timeout( function ()
					{
						if ( $scope.StatusText === 'Done' )
						{
							$scope.StatusText = '';
							$scope.ElapsedTime = '';
						}
					}, 3000 );
				}
			} )
			.catch( function ( response )
			{
				$scope.Sending = false;
				$scope.StatusText = '';
				StopTimer();
				$scope.ElapsedTime = '';
				var message = ( response.data && response.data.Error ) || 'Failed to send message.';
				Log( 'Chat error: ' + message );
				$scope.Error = message;
			} );
	};


	//---------------------------------------------------------------------
	$scope.OnInputKeyPress = function ( event )
	{
		if ( event.keyCode === 13 && !event.shiftKey )
		{
			event.preventDefault();
			$scope.Send();
		}
	};


	//---------------------------------------------------------------------
	$scope.OnInputChange = function ()
	{
		if ( suggest_timer ) { $timeout.cancel( suggest_timer ); }

		var text = ( $scope.InputText || '' ).trim();
		if ( text.length < 2 )
		{
			$scope.Suggestions = [];
			$scope.ShowSuggestions = false;
			return;
		}

		suggest_timer = $timeout( function ()
		{
			ApiService.GetSuggestions( text )
				.then( function ( data )
				{
					$scope.Suggestions = data.Suggestions || [];
					$scope.ShowSuggestions = $scope.Suggestions.length > 0;
				} )
				.catch( function ()
				{
					$scope.Suggestions = [];
					$scope.ShowSuggestions = false;
				} );
		}, 300 );
	};


	//---------------------------------------------------------------------
	$scope.SelectSuggestion = function ( Suggestion )
	{
		$scope.InputText = Suggestion;
		$scope.ShowSuggestions = false;
	};


	//---------------------------------------------------------------------
	$scope.CreateConversation = function ()
	{
		var name = prompt( 'Conversation name:' );
		if ( !name ) { return; }

		Log( 'Creating conversation: ' + name );

		ApiService.CreateConversation( name )
			.then( function ()
			{
				LoadConversations();
				$scope.SelectConversation( name );
			} )
			.catch( function ( response )
			{
				var message = ( response.data && response.data.Error ) || 'Failed to create conversation.';
				Log( 'Create conversation error: ' + message );
				$scope.Error = message;
			} );
	};


	//---------------------------------------------------------------------
	function ScrollToBottom()
	{
		$timeout( function ()
		{
			var container = document.querySelector( '.chat-messages' );
			if ( container )
			{
				container.scrollTop = container.scrollHeight;
			}
		}, 50 );
	}


	//---------------------------------------------------------------------
	$scope.$on( '$destroy', function ()
	{
		Log( 'Destroying ChatController' );
		if ( unsubscribe_sse ) { unsubscribe_sse(); }
		SseService.Disconnect();
		if ( suggest_timer ) { $timeout.cancel( suggest_timer ); }
		if ( elapsed_interval ) { $interval.cancel( elapsed_interval ); }
	} );


	//---------------------------------------------------------------------
	LoadConversations();

} ] );
