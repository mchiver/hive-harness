/*
	provisioning.js
---------------------------------------------------------------------
Idempotent setup of the Consensus app's persistent state.

EnsureApp creates the SqlStore entity 'consensus' (if missing),
all required tables (if missing), and seeds the default Skill rows
(only those not already present - user edits are preserved).

EnsureRunConversations creates one Conversation entity per roster
participant for a specific run. Conversations persist until the run
is explicitly deleted.
*/


const Repository = require( './repository.js' );
const SkillTemplates = require( './skill_templates.js' );


//---------------------------------------------------------------------
const TABLE_SCHEMAS = {

	skills: {
		Columns: [
			{ Name: 'Name',         Type: 'TEXT',    PrimaryKey: true },
			{ Name: 'SystemPrompt', Type: 'TEXT',    NotNull: true },
			{ Name: 'Temperature',  Type: 'REAL',    Default: '0.3' },
		],
	},

	runs: {
		Columns: [
			{ Name: 'RunId',        Type: 'TEXT',    PrimaryKey: true },
			{ Name: 'Issue',        Type: 'TEXT',    NotNull: true },
			{ Name: 'Status',       Type: 'TEXT',    NotNull: true },
			{ Name: 'Phase',        Type: 'TEXT' },
			{ Name: 'CreatedAt',    Type: 'TEXT',    NotNull: true },
			{ Name: 'ConcludedAt',  Type: 'TEXT' },
			{ Name: 'RosterJson',   Type: 'TEXT',    NotNull: true },
			{ Name: 'TurnCounter',  Type: 'INTEGER', Default: '0' },
			{ Name: 'MaxTurns',     Type: 'INTEGER', Default: '40' },
			{ Name: 'Llm',          Type: 'TEXT',    NotNull: true },
		],
	},

	issue_nodes: {
		Columns: [
			{ Name: 'NodeId',         Type: 'TEXT',    PrimaryKey: true },
			{ Name: 'RunId',          Type: 'TEXT',    NotNull: true },
			{ Name: 'ParentId',       Type: 'TEXT' },
			{ Name: 'Depth',          Type: 'INTEGER', Default: '0' },
			{ Name: 'Question',       Type: 'TEXT',    NotNull: true },
			{ Name: 'Status',         Type: 'TEXT',    NotNull: true },
			{ Name: 'ResolutionText', Type: 'TEXT' },
			{ Name: 'ResolutionBy',   Type: 'TEXT' },
			{ Name: 'DissentJson',    Type: 'TEXT' },
			{ Name: 'CreatedAt',      Type: 'TEXT',    NotNull: true },
			{ Name: 'UpdatedAt',      Type: 'TEXT',    NotNull: true },
		],
	},

	positions: {
		Columns: [
			{ Name: 'PositionId',    Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
			{ Name: 'NodeId',        Type: 'TEXT',    NotNull: true },
			{ Name: 'ParticipantId', Type: 'TEXT',    NotNull: true },
			{ Name: 'Claim',         Type: 'TEXT',    NotNull: true },
			{ Name: 'Turn',          Type: 'INTEGER', NotNull: true },
			{ Name: 'CreatedAt',     Type: 'TEXT',    NotNull: true },
		],
	},

	evidence: {
		Columns: [
			{ Name: 'EvidenceId', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
			{ Name: 'NodeId',     Type: 'TEXT',    NotNull: true },
			{ Name: 'FetchedBy',  Type: 'TEXT',    NotNull: true },
			{ Name: 'Summary',    Type: 'TEXT',    NotNull: true },
			{ Name: 'Turn',       Type: 'INTEGER', NotNull: true },
			{ Name: 'CreatedAt',  Type: 'TEXT',    NotNull: true },
		],
	},

	overrides: {
		Columns: [
			{ Name: 'OverrideId',  Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
			{ Name: 'RunId',       Type: 'TEXT',    NotNull: true },
			{ Name: 'Turn',        Type: 'INTEGER', NotNull: true },
			{ Name: 'Instruction', Type: 'TEXT',    NotNull: true },
			{ Name: 'Consumed',    Type: 'INTEGER', Default: '0' },
			{ Name: 'CreatedAt',   Type: 'TEXT',    NotNull: true },
		],
	},

	turn_log: {
		Columns: [
			{ Name: 'TurnLogId', Type: 'INTEGER', PrimaryKey: true, AutoIncrement: true },
			{ Name: 'RunId',     Type: 'TEXT',    NotNull: true },
			{ Name: 'Turn',      Type: 'INTEGER', NotNull: true },
			{ Name: 'Actor',     Type: 'TEXT',    NotNull: true },
			{ Name: 'Action',    Type: 'TEXT',    NotNull: true },
			{ Name: 'NodeId',    Type: 'TEXT' },
			{ Name: 'Content',   Type: 'TEXT' },
			{ Name: 'CreatedAt', Type: 'TEXT',    NotNull: true },
		],
	},

};


//---------------------------------------------------------------------
async function EnsureSqlStoreEntity( Hive )
{
	var result = await Hive.InvokeTool( 'SqlStore.ConfigEntity', {
		EntityName: Repository.STORE,
		Settings: { Description: 'Consensus app state' },
	} );
	if ( result.Error ) { throw new Error( result.Error ); }
}


//---------------------------------------------------------------------
async function EnsureTables( Hive, Log )
{
	var existing = await Repository.ListTables( Hive );
	var existing_set = {};
	for ( var i = 0; i < existing.length; i++ ) { existing_set[ existing[ i ] ] = true; }

	for ( var name in TABLE_SCHEMAS )
	{
		if ( existing_set[ name ] ) { continue; }
		await Repository.CreateTable( Hive, name, TABLE_SCHEMAS[ name ] );
		if ( Log ) { Log( '  created table: ' + name ); }
	}
}


//---------------------------------------------------------------------
async function EnsureDefaultSkills( Hive, Log )
{
	for ( var i = 0; i < SkillTemplates.DEFAULT_SKILLS.length; i++ )
	{
		var skill = SkillTemplates.DEFAULT_SKILLS[ i ];
		var inserted = await Repository.UpsertSkillIfMissing( Hive, skill );
		if ( inserted && Log ) { Log( '  seeded skill: ' + skill.Name ); }
	}
}


//---------------------------------------------------------------------
async function EnsureLlmEntity( Hive, LlmName )
{
	var result = await Hive.InvokeTool( 'Llm.ListEntities', {} );
	if ( result.Error ) { throw new Error( result.Error ); }
	var entities = ( result.Result && result.Result.Entities ) || result.Result || [];
	for ( var i = 0; i < entities.length; i++ )
	{
		var name = entities[ i ].Name || entities[ i ];
		if ( name === LlmName ) { return; }
	}
	throw new Error(
		'Llm entity "' + LlmName + '" not found in this Hive. ' +
		'Create one with the Llm plugin first (e.g. Llm.ConfigEntity).',
	);
}


//---------------------------------------------------------------------
async function EnsureApp( Hive, LlmName, Log )
{
	if ( Log ) { Log( 'Provisioning Consensus app...' ); }
	await EnsureSqlStoreEntity( Hive );
	if ( Log ) { Log( '  SqlStore entity ready: ' + Repository.STORE ); }
	await EnsureTables( Hive, Log );
	await EnsureDefaultSkills( Hive, Log );
	if ( LlmName )
	{
		await EnsureLlmEntity( Hive, LlmName );
		if ( Log ) { Log( '  Llm entity verified: ' + LlmName ); }
	}
	if ( Log ) { Log( 'Provisioning complete.' ); }
}


//---------------------------------------------------------------------
async function EnsureRunConversations( Hive, Run, Log )
{
	for ( var i = 0; i < Run.Roster.length; i++ )
	{
		var member = Run.Roster[ i ];
		var skill = await Repository.GetSkill( Hive, member.Skill );
		if ( !skill )
		{
			throw new Error( 'Skill not found for roster member ' + member.ParticipantId + ': ' + member.Skill );
		}
		var conv_name = 'consensus-' + Run.RunId + '-' + member.ParticipantId;
		var result = await Hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conv_name,
			Settings: {
				Description: 'Consensus run ' + Run.RunId + ' / ' + member.ParticipantId,
				ChannelName: 'consensus',
				ChatLlm: Run.Llm,
				Instructions: [ skill.SystemPrompt ],
			},
		} );
		if ( result.Error ) { throw new Error( result.Error ); }
		if ( Log ) { Log( '  conversation ready: ' + conv_name ); }
	}
}


//---------------------------------------------------------------------
function ConversationName( Run, ParticipantId )
{
	return 'consensus-' + Run.RunId + '-' + ParticipantId;
}


//---------------------------------------------------------------------
module.exports = {
	EnsureApp: EnsureApp,
	EnsureRunConversations: EnsureRunConversations,
	ConversationName: ConversationName,
};
