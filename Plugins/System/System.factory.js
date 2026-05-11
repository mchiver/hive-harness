/*
	System.factory.js
---------------------------------------------------------------------
System plugin factory - provides introspection tools for the hive.
*/


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Hive introspection and system information.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [];


		//---------------------------------------------------------------------
		// Dynamic Skills
		Plugin.Skills = {};


		//---------------------------------------------------------------------
		// ToolUsageSkill - explains tool calling format and available plugins.
		// Generated dynamically at prompt-build time from the live Hive state.
		Plugin.Skills.ToolUsageSkill = function ( Hive )
		{
			var skill_text = '';

			// --- Format ---
			skill_text += `
You have access to tools.
To call a tool, respond with a tool-call XML block:
<tool-call>{"Tool":"PluginName.ToolName","Arguments":{}}</tool-call>
`;

			// --- Rules ---
			skill_text += `
Rules:
- "Tool" must be a "PluginName.ToolName" string matching an installed tool.
- "Arguments" must be a JSON object whose keys match the tool's parameter schema.
- Place the tool-call block on its own line. Do not nest it inside other XML.
- You may include one tool call per response. After the tool executes, you will receive the result and can continue.
- When calling tools, do not include any additional text in your response other than the tool-call block.
- If no tool is needed, respond normally without any tool-call block.
`;

			// --- Response cycle ---
			skill_text += `
After you make a tool call, the system will execute it and return the result in a <tool-result> block:
<tool-result>
Tool: PluginName.ToolName
Success: true
Result: { ... }
</tool-result>
You will then be asked to continue. You may make another tool call or provide your final answer.
`;

			// --- Discovery ---
			skill_text += `
Discovering tools:
Tools are organized into Plugins. Use System.ListTools to see a plugin's tools and their parameter schemas:
<tool-call>{"Tool":"System.ListTools","Arguments":{"PluginName":"SomePlugin"}}</tool-call>
Each tool entry includes a Parameters field (what arguments to pass) and a Returns field (what the result contains).
Call System.ListTools without arguments to list all tools across all plugins.
`;

			// --- Example ---
			skill_text += `
Example: listing all plugins:

User: What plugins are available?
Assistant: Let me look that up.
<tool-call>{"Tool":"System.ListPlugins","Arguments":{}}</tool-call>

The system returns:
<tool-result>
Tool: System.ListPlugins
Success: true
Result: {"Plugins":[{"PluginName":"System","Description":"Core system tools","ToolCount":3}]}
</tool-result>

Assistant: There is 1 plugin available: **System** \u2014 Core system tools (3 tools).
`;

			// --- Error handling ---
			skill_text += `
Error handling:
- If Success is false, the Result will contain error details. Report the error clearly and do not retry the same call.
- If a tool name is invalid, the error will say so. Use System.ListTools to find the correct name.
`;

			// --- Plugin catalog ---
			skill_text += '\nAvailable Plugins:\n';

			var plugin_names = Object.keys( Hive.Plugins );
			for ( var index = 0; index < plugin_names.length; index++ )
			{
				var name = plugin_names[ index ];
				// Skip suppressed plugins
				if ( name.startsWith( '~' ) || name.startsWith( '_' ) || name.startsWith( '.' ) )
				{
					continue;
				}
				var plugin = Hive.Plugins[ name ];
				var description = plugin.Description || '';
				skill_text += '- ' + name + ': ' + description + '\n';
			}

			return skill_text;
		};


		return Plugin;
	}
}

module.exports = Factory;
