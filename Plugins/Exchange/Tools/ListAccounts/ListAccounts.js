/*
	ListAccounts.js
---------------------------------------------------------------------
Lists all accounts on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'ListAccounts';
	Tool.Description = 'List all accounts on the exchange.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
		},
		required: [ 'EntityName' ],
	};

	Tool.Returns = {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				AccountName: { type: 'string', description: 'The account name.' },
				EcBalance: { type: 'number', description: 'Current EC balance.' },
			},
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			var rows = store.Query(
				`SELECT AccountName, EcBalance FROM "${Plugin.ACCOUNTS_TABLE}" ORDER BY AccountName`
			);

			return rows;
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};