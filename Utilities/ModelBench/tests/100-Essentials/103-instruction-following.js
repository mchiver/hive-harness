/*
	03-instruction-following.js
---------------------------------------------------------------------
Tests whether the model respects instructions embedded in the
<instructions> section of the prompt (e.g. word count constraints).
*/

module.exports = function ( TEST, ASSERT, Context )
{
	var model_id = Context.Model.ModelName.replace( /[^a-zA-Z0-9]/g, '-' ).toLowerCase();
	var conversation_name = 'cap-b03-' + model_id;


	//-----------------------------------------------------------------
	TEST.it( 'should follow instruction to respond in exactly 5 words', async function ()
	{
		var hive = Context.Hive;

		// Create a Skill entity with a strict word-count instruction
		var skill_name = 'FiveWordSkill';
		await hive.InvokeTool( 'Skill.ConfigEntity', {
			EntityName: skill_name,
			Settings: {
				Description: 'Enforce five-word responses.',
				Text: 'Always respond in exactly 5 words. No more, no fewer.',
			},
		} );

		// Create conversation referencing the skill
		await hive.InvokeTool( 'Conversation.ConfigEntity', {
			EntityName: conversation_name,
			Settings: {
				Username: Context.TestConfig.Username,
				ChannelName: 'test',
				ChatLlm: Context.LlmEntityName,
				Skills: [ 'Skill.FiveWordSkill' ],
			},
		} );

		var result = await hive.InvokeTool( 'Conversation.Chat', {
			EntityName: conversation_name,
			Text: 'Tell me about dogs.',
		} );

		ASSERT.ok( result.Success, 'Chat call should succeed' );
		ASSERT.ok( !result.Result.Error, 'should not have error: ' + ( result.Result.Error || '' ) );
		ASSERT.ok( result.Result.Response, 'should have a response' );

		// Count words in response (split by whitespace, filter empty)
		var words = result.Result.Response.trim().split( /\s+/ ).filter( function ( w )
		{
			return w.length > 0;
		} );
		var word_count = words.length;

		// Allow some slack: +/-2 words from the target of 5
		ASSERT.ok( word_count >= 3 && word_count <= 7,
			'response should be approximately 5 words (got ' + word_count + '): '
			+ result.Result.Response );

		// Cleanup
		await hive.InvokeTool( 'Conversation.DeleteEntity', { EntityName: conversation_name } );
		await hive.InvokeTool( 'Skill.DeleteEntity', { EntityName: skill_name } );
	} );

};
