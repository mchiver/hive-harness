/*
	index.js
---------------------------------------------------------------------
Public surface of ConsensusLib. Both the CLI and the Web wrapper
depend on this module; nothing else should reach into the internals.
*/


const Engine = require( './engine.js' );
const SessionModule = require( './session.js' );

const Provisioning = require( './provisioning.js' );
const Repository = require( './repository.js' );
const SkillTemplates = require( './skill_templates.js' );
const Renderer = require( './renderer.js' );


//---------------------------------------------------------------------
module.exports = {

	// High-level operations.
	EnsureApp:      Engine.EnsureApp,
	NewRun:         Engine.NewRun,
	ResumeRun:      Engine.ResumeRun,
	GetRun:         Engine.GetRun,
	ListRuns:       Engine.ListRuns,
	DeleteRun:      Engine.DeleteRun,
	SubmitOverride: Engine.SubmitOverride,
	PauseRun:       Engine.PauseRun,
	RenderReport:   Engine.RenderReport,
	GetTurnLog:     Engine.GetTurnLog,
	GetTopicTree:   Engine.GetTopicTree,
	GenerateRunId:  Engine.GenerateRunId,

	// Interactive driver.
	Session: SessionModule.Session,

	// Re-exports for advanced use.
	Provisioning:   Provisioning,
	Repository:     Repository,
	SkillTemplates: SkillTemplates,
	Renderer:       Renderer,

};
