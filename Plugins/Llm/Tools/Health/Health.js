/*
	Health.js
---------------------------------------------------------------------
Checks whether an LLM entity's platform is reachable and responsive.
Uses a short timeout so callers can fail fast when the backend is down.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'Health';
	Tool.Description = 'Check whether an LLM entity\'s platform is reachable.';

	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Llm entity to check.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			Status: { type: 'string', description: '"ok" when healthy.' },
			Message: { type: 'string', description: 'Status detail from the platform.' },
			Error: { type: 'string', description: 'Error text when unreachable.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		// Load entity config
		var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );

		// Get the platform adapter
		var adapter = Plugin.GetAdapter( config.Platform );

		if ( !adapter.Health )
		{
			throw new Error( 'Platform adapter [' + config.Platform + '] does not support health checks.' );
		}

		var result = await adapter.Health( Hive.Helpers.Fetch, config );
		return result;
	};

	return Tool;
};
