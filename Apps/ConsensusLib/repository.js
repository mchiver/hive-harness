/*
	repository.js
---------------------------------------------------------------------
Thin wrappers over the SqlStore plugin for the 'consensus' entity.
All app-owned persistence flows through here.
*/


const STORE = 'consensus';


//---------------------------------------------------------------------
async function Query( Hive, Sql, Values )
{
	var result = await Hive.InvokeTool( 'SqlStore.QuerySql', {
		EntityName: STORE,
		Sql: Sql,
		Values: Values || [],
	} );
	if ( result.Error ) { throw new Error( result.Error ); }
	if ( result.Result && result.Result.Error ) { throw new Error( result.Result.Error ); }
	return result.Result.Rows || [];
}


//---------------------------------------------------------------------
async function Execute( Hive, Sql, Values )
{
	var result = await Hive.InvokeTool( 'SqlStore.ExecuteSql', {
		EntityName: STORE,
		Sql: Sql,
		Values: Values || [],
	} );
	if ( result.Error ) { throw new Error( result.Error ); }
	if ( result.Result && result.Result.Error ) { throw new Error( result.Result.Error ); }
	return result.Result;
}


//---------------------------------------------------------------------
async function ListTables( Hive )
{
	var result = await Hive.InvokeTool( 'SqlStore.ListTables', { EntityName: STORE } );
	if ( result.Error ) { throw new Error( result.Error ); }
	return ( result.Result && result.Result.Tables ) || [];
}


//---------------------------------------------------------------------
async function CreateTable( Hive, TableName, TableSchema )
{
	var result = await Hive.InvokeTool( 'SqlStore.CreateTable', {
		EntityName: STORE,
		TableName: TableName,
		TableSchema: TableSchema,
	} );
	if ( result.Error ) { throw new Error( result.Error ); }
	if ( result.Result && result.Result.Error ) { throw new Error( result.Result.Error ); }
	return result.Result;
}


//---------------------------------------------------------------------
async function ListSkills( Hive )
{
	return await Query( Hive, 'SELECT * FROM skills ORDER BY Name' );
}


//---------------------------------------------------------------------
async function GetSkill( Hive, Name )
{
	var rows = await Query( Hive, 'SELECT * FROM skills WHERE Name = ?', [ Name ] );
	return rows[ 0 ] || null;
}


//---------------------------------------------------------------------
async function UpsertSkillIfMissing( Hive, Skill )
{
	var existing = await GetSkill( Hive, Skill.Name );
	if ( existing ) { return false; }
	await Execute(
		Hive,
		'INSERT INTO skills ( Name, SystemPrompt, Temperature ) VALUES ( ?, ?, ? )',
		[ Skill.Name, Skill.SystemPrompt, Skill.Temperature ],
	);
	return true;
}


//---------------------------------------------------------------------
async function CreateRun( Hive, Run )
{
	await Execute(
		Hive,
		`INSERT INTO runs
			( RunId, Issue, Status, Phase, CreatedAt, RosterJson, TurnCounter, MaxTurns, Llm )
			VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
		[
			Run.RunId, Run.Issue, Run.Status, Run.Phase, Run.CreatedAt,
			JSON.stringify( Run.Roster ), Run.TurnCounter, Run.MaxTurns, Run.Llm,
		],
	);
	return Run;
}


//---------------------------------------------------------------------
async function GetRun( Hive, RunId )
{
	var rows = await Query( Hive, 'SELECT * FROM runs WHERE RunId = ?', [ RunId ] );
	if ( !rows.length ) { return null; }
	var row = rows[ 0 ];
	row.Roster = JSON.parse( row.RosterJson || '[]' );
	return row;
}


//---------------------------------------------------------------------
async function ListRuns( Hive )
{
	return await Query( Hive, 'SELECT RunId, Issue, Status, Phase, CreatedAt, TurnCounter FROM runs ORDER BY CreatedAt DESC' );
}


//---------------------------------------------------------------------
async function UpdateRun( Hive, RunId, Fields )
{
	var sets = [];
	var values = [];
	for ( var key in Fields )
	{
		sets.push( key + ' = ?' );
		values.push( Fields[ key ] );
	}
	values.push( RunId );
	await Execute( Hive, 'UPDATE runs SET ' + sets.join( ', ' ) + ' WHERE RunId = ?', values );
}


//---------------------------------------------------------------------
async function DeleteRun( Hive, RunId )
{
	await Execute( Hive, 'DELETE FROM positions   WHERE NodeId IN ( SELECT NodeId FROM issue_nodes WHERE RunId = ? )', [ RunId ] );
	await Execute( Hive, 'DELETE FROM evidence    WHERE NodeId IN ( SELECT NodeId FROM issue_nodes WHERE RunId = ? )', [ RunId ] );
	await Execute( Hive, 'DELETE FROM issue_nodes WHERE RunId = ?', [ RunId ] );
	await Execute( Hive, 'DELETE FROM overrides   WHERE RunId = ?', [ RunId ] );
	await Execute( Hive, 'DELETE FROM turn_log    WHERE RunId = ?', [ RunId ] );
	await Execute( Hive, 'DELETE FROM runs        WHERE RunId = ?', [ RunId ] );
}


//---------------------------------------------------------------------
async function InsertNode( Hive, Node )
{
	await Execute(
		Hive,
		`INSERT INTO issue_nodes
			( NodeId, RunId, ParentId, Depth, Question, Status, CreatedAt, UpdatedAt )
			VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )`,
		[
			Node.NodeId, Node.RunId, Node.ParentId, Node.Depth, Node.Question,
			Node.Status, Node.CreatedAt, Node.UpdatedAt,
		],
	);
	return Node;
}


//---------------------------------------------------------------------
async function GetNode( Hive, NodeId )
{
	var rows = await Query( Hive, 'SELECT * FROM issue_nodes WHERE NodeId = ?', [ NodeId ] );
	return rows[ 0 ] || null;
}


//---------------------------------------------------------------------
async function ListNodes( Hive, RunId )
{
	return await Query( Hive, 'SELECT * FROM issue_nodes WHERE RunId = ? ORDER BY Depth, CreatedAt', [ RunId ] );
}


//---------------------------------------------------------------------
async function UpdateNode( Hive, NodeId, Fields )
{
	var sets = [];
	var values = [];
	for ( var key in Fields )
	{
		sets.push( key + ' = ?' );
		values.push( Fields[ key ] );
	}
	values.push( NodeId );
	await Execute( Hive, 'UPDATE issue_nodes SET ' + sets.join( ', ' ) + ' WHERE NodeId = ?', values );
}


//---------------------------------------------------------------------
async function InsertPosition( Hive, Position )
{
	await Execute(
		Hive,
		`INSERT INTO positions ( NodeId, ParticipantId, Claim, Turn, CreatedAt )
			VALUES ( ?, ?, ?, ?, ? )`,
		[ Position.NodeId, Position.ParticipantId, Position.Claim, Position.Turn, Position.CreatedAt ],
	);
}


//---------------------------------------------------------------------
async function ListPositions( Hive, NodeId )
{
	return await Query( Hive, 'SELECT * FROM positions WHERE NodeId = ? ORDER BY Turn', [ NodeId ] );
}


//---------------------------------------------------------------------
async function InsertEvidence( Hive, Evidence )
{
	await Execute(
		Hive,
		`INSERT INTO evidence ( NodeId, FetchedBy, Summary, Turn, CreatedAt )
			VALUES ( ?, ?, ?, ?, ? )`,
		[ Evidence.NodeId, Evidence.FetchedBy, Evidence.Summary, Evidence.Turn, Evidence.CreatedAt ],
	);
}


//---------------------------------------------------------------------
async function ListEvidence( Hive, NodeId )
{
	return await Query( Hive, 'SELECT * FROM evidence WHERE NodeId = ? ORDER BY Turn', [ NodeId ] );
}


//---------------------------------------------------------------------
async function InsertOverride( Hive, RunId, Turn, Instruction )
{
	await Execute(
		Hive,
		'INSERT INTO overrides ( RunId, Turn, Instruction, Consumed, CreatedAt ) VALUES ( ?, ?, ?, 0, ? )',
		[ RunId, Turn, Instruction, new Date().toISOString() ],
	);
}


//---------------------------------------------------------------------
async function PopPendingOverride( Hive, RunId )
{
	var rows = await Query(
		Hive,
		'SELECT * FROM overrides WHERE RunId = ? AND Consumed = 0 ORDER BY CreatedAt LIMIT 1',
		[ RunId ],
	);
	if ( !rows.length ) { return null; }
	var row = rows[ 0 ];
	await Execute( Hive, 'UPDATE overrides SET Consumed = 1 WHERE OverrideId = ?', [ row.OverrideId ] );
	return row;
}


//---------------------------------------------------------------------
async function AppendTurnLog( Hive, Entry )
{
	await Execute(
		Hive,
		`INSERT INTO turn_log
			( RunId, Turn, Actor, Action, NodeId, Content, CreatedAt )
			VALUES ( ?, ?, ?, ?, ?, ?, ? )`,
		[ Entry.RunId, Entry.Turn, Entry.Actor, Entry.Action, Entry.NodeId || null, Entry.Content, Entry.CreatedAt ],
	);
}


//---------------------------------------------------------------------
async function ListTurnLog( Hive, RunId )
{
	return await Query( Hive, 'SELECT * FROM turn_log WHERE RunId = ? ORDER BY Turn, TurnLogId', [ RunId ] );
}


//---------------------------------------------------------------------
module.exports = {
	STORE: STORE,
	Query: Query,
	Execute: Execute,
	ListTables: ListTables,
	CreateTable: CreateTable,
	ListSkills: ListSkills,
	GetSkill: GetSkill,
	UpsertSkillIfMissing: UpsertSkillIfMissing,
	CreateRun: CreateRun,
	GetRun: GetRun,
	ListRuns: ListRuns,
	UpdateRun: UpdateRun,
	DeleteRun: DeleteRun,
	InsertNode: InsertNode,
	GetNode: GetNode,
	ListNodes: ListNodes,
	UpdateNode: UpdateNode,
	InsertPosition: InsertPosition,
	ListPositions: ListPositions,
	InsertEvidence: InsertEvidence,
	ListEvidence: ListEvidence,
	InsertOverride: InsertOverride,
	PopPendingOverride: PopPendingOverride,
	AppendTurnLog: AppendTurnLog,
	ListTurnLog: ListTurnLog,
};
