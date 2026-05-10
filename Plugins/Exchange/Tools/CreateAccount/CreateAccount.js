/*
	CreateAccount.js
---------------------------------------------------------------------
Creates a new participant account on the exchange.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'CreateAccount';
	Tool.Description = 'Create a new participant account with an EC balance.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Unique name for the account.' },
			StartingEc: { type: 'number', description: 'Initial EC balance (optional, uses exchange default).' },
		},
		required: [ 'EntityName', 'AccountName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The created account name.' },
			EcBalance: { type: 'number', description: 'Starting EC balance.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check if account already exists
			var existing = store.Query(
				`SELECT AccountName FROM "${Plugin.ACCOUNTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing.length > 0 )
			{
				throw new Error( `Account [${Arguments.AccountName}] already exists.` );
			}

			// Get default starting EC from exchange config
			var starting_ec = Arguments.StartingEc;
			if ( starting_ec === undefined || starting_ec === null )
			{
				var config = await Plugin.GetEntityConfig( Hive, Arguments.EntityName );
				starting_ec = config.StartingEc || 10000;
			}

			store.Execute(
				`INSERT INTO "${Plugin.ACCOUNTS_TABLE}" ( AccountName, EcBalance ) VALUES ( ?, ? )`,
				[ Arguments.AccountName, starting_ec ]
			);

			return {
				AccountName: Arguments.AccountName,
				EcBalance: starting_ec,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};