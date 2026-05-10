/*
	Chat.js
---------------------------------------------------------------------
Sends text to the conversation's LLM with full context engineering:
topic search, chat history, instructions, and tool call loop.
*/

const CONTEXT_TOPICS_MIN_SIMILARITY = 0.3;
const CONTEXT_TOPICS_MAX_ITEMS = 10;

const CONTEXT_HISTORY_MAX_ITEMS = 10;
const CONTEXT_HISTORY_MAX_ITEM_LENGTH = 200;

const MAX_TOOL_CALLS = 10;


module.exports = function ( Tool )
{
	Tool.ToolName = 'Chat';
	Tool.Description = 'Send text to the conversation LLM with full context and tool calling.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Conversation entity.' },
			Text: { type: 'string', description: 'The user text to send.' },
		},
		required: [ 'EntityName', 'Text' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Response: { type: 'string', description: 'The final LLM response text.' },
			ToolCalls: { type: 'array', description: 'Array of tool calls made during processing.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Load entity config
		var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		if ( !config.ChatLlm )
		{
			throw new Error( 'No ChatLlm configured for this conversation.' );
		}

		// Health check — fail fast if the LLM platform is unreachable
		var health_result = await Hive.InvokeTool( 'Llm.Health', {
			EntityName: config.ChatLlm,
		} );
		if ( !health_result.Success ) { throw new Error( health_result.Error ); }

		// Search topics for relevant context
		var context_results = [];
		if ( config.Topics && config.Topics.length > 0 )
		{
			context_results = await Plugin.SearchTopics( Hive, config, Arguments.Text, CONTEXT_TOPICS_MIN_SIMILARITY, CONTEXT_TOPICS_MAX_ITEMS );
		}

		// Get chat history
		var history_rows = await Plugin.GetRecentMessages( Hive, Arguments.EntityName, CONTEXT_HISTORY_MAX_ITEMS, CONTEXT_HISTORY_MAX_ITEM_LENGTH );

		// Resolve skills
		var skill_names = config.Skills || [];
		var resolved_skills = await Plugin.ResolveSkills( Hive, skill_names );

		// Record user message in history
		var user_message = await Plugin.AppendMessage(
			Hive, Arguments.EntityName,
			config.Username || '', '', '', Arguments.Text
		);
		var message_id = user_message.MessageID;

		// Build the prompt
		var prompt = Plugin.BuildPrompt(
			Arguments.EntityName,
			history_rows,
			context_results,
			resolved_skills,
			Arguments.Text
		);

		// Update user message with the full prompt as Context
		var prompt_tokens = Math.ceil( prompt.length / 4 );
		var store = await Plugin.OpenHistoryDatabase( Hive, Arguments.EntityName );
		try
		{
			store.Execute(
				`UPDATE "${Plugin.MESSAGES_TABLE}" SET Context = ? WHERE MessageID = ?`,
				[ prompt, message_id ]
			);
		}
		finally
		{
			store.Close();
		}

		// Emit prompt built event
		await Hive.Events.Publish( 'conversation.prompt.built', {
			Type: 'conversation.prompt.built',
			ConversationName: Arguments.EntityName,
			MessageID: message_id,
			Tokens: prompt_tokens,
		} );

		// Submit to LLM
		var llm_result = await Hive.InvokeTool( 'Llm.SubmitPrompt', {
			EntityName: config.ChatLlm,
			Prompt: prompt,
		} );
		if ( !llm_result.Success ) { throw new Error( llm_result.Error ); }

		var response_text = llm_result.Result.Response;
		var tool_calls_log = [];
		var tool_transcript = '';

		// Tool call loop — detect and execute tool calls in the response
		var max_iterations = MAX_TOOL_CALLS;
		var iteration = 0;

		while ( iteration < max_iterations )
		{
			var tool_call = parse_tool_call( response_text );
			if ( !tool_call ) { break; }

			iteration++;
			var tool_name = tool_call.PluginName + '.' + tool_call.ToolName;

			// Emit tool start event
			await Hive.Events.Publish( 'conversation.tool.start', {
				Type: 'conversation.tool.start',
				ConversationName: Arguments.EntityName,
				MessageID: message_id,
				ToolName: tool_name,
				Arguments: tool_call.Arguments,
			} );

			// Execute the tool call
			var tool_start = Date.now();
			var tool_result = await Hive.InvokeTool( tool_name, tool_call.Arguments );
			var tool_duration = Date.now() - tool_start;

			// Determine status
			var tool_status = tool_result.Success ? 'ok' : ( tool_result.Error || 'error' );

			// Record tool call in history
			await Plugin.AppendToolCall(
				Hive, Arguments.EntityName, message_id,
				Arguments.EntityName, tool_name, tool_status,
				tool_call.Arguments, tool_result.Result || tool_result.Error
			);

			// Log the tool call
			var tool_log_entry = {
				Tool: tool_name,
				Arguments: tool_call.Arguments,
				Success: tool_result.Success,
				Result: tool_result.Result,
				Error: tool_result.Error,
				Duration: tool_duration,
			};
			tool_calls_log.push( tool_log_entry );

			// Emit tool complete event
			await Hive.Events.Publish( 'conversation.tool.complete', {
				Type: 'conversation.tool.complete',
				ConversationName: Arguments.EntityName,
				MessageID: message_id,
				ToolName: tool_name,
				Status: tool_status,
				Duration: tool_duration,
			} );

			// Accumulate tool call/result transcript
			tool_transcript += '\n\n'
				+ '<tool-call-step step="' + iteration + '">\n'
				+ '<llm-response>\n' + response_text + '\n</llm-response>\n'
				+ '<tool-result>\n'
				+ 'Tool: ' + tool_name + '\n'
				+ 'Success: ' + tool_result.Success + '\n'
				+ 'Result: ' + JSON.stringify( tool_result.Result ) + '\n'
				+ '</tool-result>\n'
				+ '</tool-call-step>';

			// Send tool result back to LLM for continuation
			var continuation_prompt = prompt
				+ tool_transcript + '\n\n'
				+ '<task>\n'
				+ 'Above are the tool calls you have made so far and their results.\n'
				+ 'If you have all the information needed to answer the user, respond with your final answer now. Do not call a tool unless you need additional information.\n'
				+ 'If you need to call another tool, include a single tool-call block.\n'
				+ '</task>';

			var continuation_result = await Hive.InvokeTool( 'Llm.SubmitPrompt', {
				EntityName: config.ChatLlm,
				Prompt: continuation_prompt,
			} );

			if ( !continuation_result.Success )
			{
				// LLM failed on continuation — return what we have
				break;
			}

			response_text = continuation_result.Result.Response;
		}

		// Record LLM response in history
		var llm_message = await Plugin.AppendMessage(
			Hive, Arguments.EntityName,
			'', config.ChatLlm, '', response_text
		);

		// Emit response event
		await Hive.Events.Publish( 'conversation.response', {
			Type: 'conversation.response',
			ConversationName: Arguments.EntityName,
			MessageID: llm_message.MessageID,
			Text: response_text,
		} );

		// Update UsedAt timestamp
		await Plugin.TouchUsedAt( Hive, Arguments.EntityName );

		return {
			MessageID: message_id,
			Prompt: prompt,
			Response: response_text,
			ToolCalls: tool_calls_log,
		};
	};

	return Tool;
};


//---------------------------------------------------------------------
// Parse a tool call from LLM response text.
// Looks for a <tool-call> XML block with PluginName.ToolName and JSON arguments.
// Returns { PluginName, ToolName, Arguments } or null if not found.
function parse_tool_call( Text )
{
	var start_tag = '<tool-call>';
	var end_tag = '</tool-call>';

	var start_index = Text.indexOf( start_tag );
	if ( start_index === -1 ) { return null; }

	var end_index = Text.indexOf( end_tag, start_index );
	if ( end_index === -1 ) { return null; }

	var inner_text = Text.substring( start_index + start_tag.length, end_index ).trim();

	try
	{
		var parsed = JSON.parse( inner_text );
		if ( !parsed.Tool ) { return null; }

		var parts = parsed.Tool.split( '.' );
		if ( parts.length !== 2 ) { return null; }

		return {
			PluginName: parts[ 0 ],
			ToolName: parts[ 1 ],
			Arguments: parsed.Arguments || {},
		};
	}
	catch ( error )
	{
		return null;
	}
}
