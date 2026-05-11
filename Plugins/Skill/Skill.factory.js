/*
	Skill.factory.js
---------------------------------------------------------------------
Skill plugin factory - provides reusable prompt instruction blocks.
Each entity is a named skill whose Text is injected into conversation
prompts when referenced by name.
*/


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Reusable prompt instruction blocks for conversations.';
		Plugin.RequiredRole = 'user';
		Plugin.RequiredPlugins = [];

		// Skill is an entity-type plugin
		Plugin.EntitySchema = {
			type: 'object',
			description: 'Configuration settings for a Skill entity.',
			properties: {
				Name: { type: 'string', description: 'Skill entity name (should end with Skill).' },
				Description: { type: 'string', default: '', description: 'What this skill teaches the LLM.' },
				Text: { type: 'string', default: '', description: 'The instruction text injected into the prompt.' },
			},
			required: [ 'Name' ],
		};

		return Plugin;
	}
}

module.exports = Factory;
