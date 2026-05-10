/*
	UpdateParticipant.js
---------------------------------------------------------------------
Updates a participant's configuration.
*/

module.exports = function ( Tool )
{
	Tool.ToolName = 'UpdateParticipant';
	Tool.Description = 'Update a participant configuration.';

	Tool.MinimumRole = 'user';
	Tool.Parameters = {
		type: 'object',
		properties: {
			EntityName: { type: 'string', description: 'Name of the Exchange entity.' },
			AccountName: { type: 'string', description: 'Name of the participant account.' },
			Role: { type: 'string', description: 'New role (optional).' },
			ConversationName: { type: 'string', description: 'New conversation entity name (optional).' },
			IsManufacturer: { type: 'boolean', description: 'Update manufacturer status (optional).' },
			ManufactureAsset: { type: 'string', description: 'Update manufacture asset (optional).' },
			ManufactureRate: { type: 'number', description: 'Update manufacture rate (optional).' },
			LiquidationRateOverride: { type: 'number', description: 'Update liquidation rate override (optional).' },
			IsActive: { type: 'boolean', description: 'Activate or deactivate the participant (optional).' },
		},
		required: [ 'EntityName', 'AccountName' ],
	};

	Tool.Returns = {
		type: 'object',
		properties: {
			AccountName: { type: 'string', description: 'The participant account name.' },
			Updated: { type: 'boolean', description: 'Whether any fields were updated.' },
			Error: { type: 'string', description: 'Error text when error.' },
		},
	};

	Tool.Execute = async function ( Hive, Plugin, Arguments )
	{
		var store = null;
		try
		{
			store = await Plugin.OpenDatabase( Hive, Arguments.EntityName );

			// Check participant exists
			var existing = store.Query(
				`SELECT * FROM "${Plugin.PARTICIPANTS_TABLE}" WHERE AccountName = ?`,
				[ Arguments.AccountName ]
			);
			if ( existing.length === 0 )
			{
				throw new Error( `Participant [${Arguments.AccountName}] not found.` );
			}

			var current = existing[ 0 ];
			var updates = [];

			// Build update clauses for provided fields only
			if ( Arguments.Role !== undefined )
			{
				var valid_roles = [ 'supplier', 'consumer', 'speculator', 'hybrid' ];
				if ( valid_roles.indexOf( Arguments.Role ) === -1 )
				{
					throw new Error( `Invalid role [${Arguments.Role}]. Must be one of: ${valid_roles.join( ', ' )}.` );
				}
				updates.push( `Role = '${Arguments.Role}'` );
			}
			if ( Arguments.ConversationName !== undefined )
			{
				updates.push( `ConversationName = '${Arguments.ConversationName}'` );
			}
			if ( Arguments.IsManufacturer !== undefined )
			{
				updates.push( `IsManufacturer = ${Arguments.IsManufacturer ? 1 : 0}` );
			}
			if ( Arguments.ManufactureAsset !== undefined )
			{
				updates.push( `ManufactureAsset = '${Arguments.ManufactureAsset}'` );
			}
			if ( Arguments.ManufactureRate !== undefined )
			{
				updates.push( `ManufactureRate = ${Arguments.ManufactureRate}` );
			}
			if ( Arguments.LiquidationRateOverride !== undefined )
			{
				updates.push( `LiquidationRateOverride = ${Arguments.LiquidationRateOverride}` );
			}
			if ( Arguments.IsActive !== undefined )
			{
				updates.push( `IsActive = ${Arguments.IsActive ? 1 : 0}` );
			}

			if ( updates.length === 0 )
			{
				return {
					AccountName: Arguments.AccountName,
					Updated: false,
				};
			}

			var sql = `UPDATE "${Plugin.PARTICIPANTS_TABLE}" SET ${updates.join( ', ' )} WHERE AccountName = ?`;
			store.Execute( sql, [ Arguments.AccountName ] );

			return {
				AccountName: Arguments.AccountName,
				Updated: true,
			};
		}
		finally
		{
			if ( store ) { store.Close(); }
		}
	};

	return Tool;
};