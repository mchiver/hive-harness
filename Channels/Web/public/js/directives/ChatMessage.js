/*
	ChatMessage.js
---------------------------------------------------------------------
Renders a single chat message with collapsible prompt details and
tool call timeline panels. Supports markdown rendering.
*/

app.directive( 'chatMessage', [ '$sce', function ( $sce )
{
	return {
		restrict: 'E',
		scope: {
			message: '=',
		},
		template:
			'<div class="chat-message" ng-class="GetMessageClass()">' +

				// Header
				'<div class="message-header">' +
					'<span class="username">{{ message.Username || message.LlmName || \'System\' }}</span>' +
					'<span>{{ FormatTimestamp( message.Timestamp ) }}</span>' +
				'</div>' +

				// Message text (rendered as markdown)
				'<div class="message-text" ng-bind-html="RenderedText"></div>' +

				// Prompt details (collapsible, for user messages with Context)
				'<div class="collapsible-panel" ng-if="message.Context && message.Username">' +
					'<div class="panel-toggle" ng-click="ShowPrompt = !ShowPrompt">' +
						'<i class="bi" ng-class="ShowPrompt ? \'bi-chevron-down\' : \'bi-chevron-right\'"></i>' +
						'<i class="bi bi-code-square"></i> Prompt Details' +
						'<span class="ms-1 text-muted" ng-if="TokenCount"> ({{ TokenCount }} tokens)</span>' +
					'</div>' +
					'<div class="panel-content" ng-if="ShowPrompt">' +
						'<pre>{{ message.Context }}</pre>' +
					'</div>' +
				'</div>' +

				// Tool calls (collapsible, for LLM messages)
				'<div class="collapsible-panel" ng-if="message.Tools && message.Tools.length > 0">' +
					'<div class="panel-toggle" ng-click="ShowTools = !ShowTools">' +
						'<i class="bi" ng-class="ShowTools ? \'bi-chevron-down\' : \'bi-chevron-right\'"></i>' +
						'<i class="bi bi-tools"></i> Tool Calls ({{ message.Tools.length }})' +
					'</div>' +
					'<div class="panel-content" ng-if="ShowTools">' +
						'<div class="tool-call-item" ng-repeat="tool in message.Tools">' +
							'<div style="flex: 1;">' +
								'<div>' +
									'<span class="tool-name">{{ tool.ToolName }}</span>' +
									'<span class="badge ms-2" ' +
										'ng-class="tool.Status === \'ok\' ? \'bg-success\' : \'bg-danger\'">{{ tool.Status }}</span>' +
									'<span class="tool-duration ms-2" ng-if="tool.Timestamp">{{ FormatTimestamp( tool.Timestamp ) }}</span>' +
								'</div>' +

								// Tool arguments (nested collapsible)
								'<div class="mt-1" ng-if="tool.Arguments && tool.Arguments !== \'{}\'">' +
									'<small class="text-muted" style="cursor: pointer;" ng-click="tool._showArgs = !tool._showArgs">' +
										'<i class="bi" ng-class="tool._showArgs ? \'bi-chevron-down\' : \'bi-chevron-right\'"></i> Arguments' +
									'</small>' +
									'<pre ng-if="tool._showArgs" class="mt-1" style="font-size: 0.85em;">{{ FormatJson( tool.Arguments ) }}</pre>' +
								'</div>' +

								// Tool results (nested collapsible)
								'<div class="mt-1" ng-if="tool.Results && tool.Results !== \'{}\'">' +
									'<small class="text-muted" style="cursor: pointer;" ng-click="tool._showResults = !tool._showResults">' +
										'<i class="bi" ng-class="tool._showResults ? \'bi-chevron-down\' : \'bi-chevron-right\'"></i> Results' +
									'</small>' +
									'<pre ng-if="tool._showResults" class="mt-1" style="font-size: 0.85em;">{{ FormatJson( tool.Results ) }}</pre>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>' +
				'</div>' +

			'</div>',
		link: function ( scope )
		{
			scope.ShowPrompt = false;
			scope.ShowTools = false;
			scope.RenderedText = '';
			scope.TokenCount = '';


			// Render markdown when message changes
			scope.$watch( 'message.Text', function ( text )
			{
				if ( !text ) { scope.RenderedText = ''; return; }

				if ( typeof marked !== 'undefined' && marked.parse )
				{
					try
					{
						var html = marked.parse( text );
						scope.RenderedText = $sce.trustAsHtml( html );
					}
					catch ( e )
					{
						scope.RenderedText = $sce.trustAsHtml( EscapeHtml( text ) );
					}
				}
				else
				{
					scope.RenderedText = $sce.trustAsHtml( EscapeHtml( text ) );
				}
			} );


			// Estimate token count from Context length
			scope.$watch( 'message.Context', function ( context )
			{
				if ( !context ) { scope.TokenCount = ''; return; }
				// Rough estimate: ~4 chars per token
				var estimate = Math.round( context.length / 4 );
				scope.TokenCount = FormatNumber( estimate );
			} );


			scope.GetMessageClass = function ()
			{
				if ( scope.message.Username && scope.message.Username !== '' )
				{
					return 'user-message';
				}
				if ( scope.message.LlmName && scope.message.LlmName !== '' )
				{
					return 'llm-message';
				}
				return 'system-message';
			};


			scope.FormatTimestamp = function ( Timestamp )
			{
				if ( !Timestamp ) { return ''; }
				try
				{
					var date = new Date( Timestamp );
					return date.toLocaleTimeString();
				}
				catch ( e )
				{
					return Timestamp;
				}
			};


			scope.FormatJson = function ( Value )
			{
				if ( !Value ) { return ''; }
				if ( typeof Value === 'string' )
				{
					try { return JSON.stringify( JSON.parse( Value ), null, 2 ); }
					catch ( e ) { return Value; }
				}
				try { return JSON.stringify( Value, null, 2 ); }
				catch ( e ) { return String( Value ); }
			};


			function EscapeHtml( text )
			{
				var div = document.createElement( 'div' );
				div.appendChild( document.createTextNode( text ) );
				return div.innerHTML.replace( /\n/g, '<br>' );
			}


			function FormatNumber( num )
			{
				return num.toString().replace( /\B(?=(\d{3})+(?!\d))/g, ',' );
			}
		},
	};
} ] );
