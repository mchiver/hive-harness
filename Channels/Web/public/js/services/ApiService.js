/*
	ApiService.js
---------------------------------------------------------------------
Thin wrapper around $http for all API calls.
*/

app.factory( 'ApiService', [ '$http', function ( $http )
{
	var service = {};

	// System
	service.GetSystemInfo = function () { return $http.get( '/api/system/info' ).then( r ); };
	service.ListPlugins = function () { return $http.get( '/api/system/plugins' ).then( r ); };
	service.ListTools = function ( PluginName )
	{
		var params = {};
		if ( PluginName ) { params.plugin = PluginName; }
		return $http.get( '/api/system/tools', { params: params } ).then( r );
	};

	// Plugin Config
	service.GetConfigSchema = function ( PluginName )
	{
		return $http.get( '/api/plugins/' + PluginName + '/config-schema' ).then( r );
	};
	service.GetConfig = function ( PluginName )
	{
		return $http.get( '/api/plugins/' + PluginName + '/config' ).then( r );
	};
	service.SaveConfig = function ( PluginName, Settings )
	{
		return $http.put( '/api/plugins/' + PluginName + '/config', Settings ).then( r );
	};

	// Entities
	service.GetSchema = function ( PluginName )
	{
		return $http.get( '/api/plugins/' + PluginName + '/schema' ).then( r );
	};
	service.ListEntities = function ( PluginName )
	{
		return $http.get( '/api/plugins/' + PluginName + '/entities' ).then( r );
	};
	service.GetEntity = function ( PluginName, EntityName )
	{
		return $http.get( '/api/plugins/' + PluginName + '/entities/' + EntityName ).then( r );
	};
	service.SaveEntity = function ( PluginName, EntityName, Settings )
	{
		return $http.put( '/api/plugins/' + PluginName + '/entities/' + EntityName, Settings ).then( r );
	};
	service.DeleteEntity = function ( PluginName, EntityName )
	{
		return $http.delete( '/api/plugins/' + PluginName + '/entities/' + EntityName ).then( r );
	};

	// Conversations
	service.ListConversations = function () { return $http.get( '/api/conversations' ).then( r ); };
	service.CreateConversation = function ( Name, ChatLlm )
	{
		return $http.post( '/api/conversations', { Name: Name, ChatLlm: ChatLlm } ).then( r );
	};
	service.GetConversation = function ( Name )
	{
		return $http.get( '/api/conversations/' + Name ).then( r );
	};

	// Chat
	service.SendChat = function ( ConversationName, Text )
	{
		return $http.post( '/api/chat', { ConversationName: ConversationName, Text: Text } ).then( r );
	};
	service.GetHistory = function ( ConversationName, Limit )
	{
		var params = { conversation: ConversationName };
		if ( Limit ) { params.limit = Limit; }
		return $http.get( '/api/chat/history', { params: params } ).then( r );
	};

	// Tools
	service.InvokeTool = function ( PluginName, ToolName, Arguments )
	{
		return $http.post( '/api/tools/invoke', {
			PluginName: PluginName,
			ToolName: ToolName,
			Arguments: Arguments,
		} ).then( r );
	};

	// Suggest
	service.GetSuggestions = function ( Input )
	{
		return $http.get( '/api/suggest', { params: { input: Input } } ).then( r );
	};

	// Extract response data
	function r( response ) { return response.data; }

	return service;
} ] );
