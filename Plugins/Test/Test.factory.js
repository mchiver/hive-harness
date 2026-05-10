/*
	Test.factory.js
---------------------------------------------------------------------
Test plugin factory - provides utility tools for testing and
demonstrating the tool calling system.
*/


class Factory
{
	static Initialize( Registry, Plugin )
	{
		Plugin.Description = 'Test utilities: arithmetic, echo, and time tools.';
		Plugin.RequiredRole = 'user';

		return Plugin;
	}
}

module.exports = Factory;