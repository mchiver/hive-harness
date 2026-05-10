

//---------------------------------------------------------------------
// Tool class - container for an executable function
class Tool
{


	//---------------------------------------------------------------------
	constructor()
	{
		this.ToolName = '';
		this.Description = '';
		this.MinimumRole = 'none';		// 'none' | 'user' | 'admin' | 'owner'
		this.Parameters = {
			type: 'object',
			properties: {},
		};
		this.Returns = {
			type: 'object',
			properties: {},
		};
	}


	//---------------------------------------------------------------------
	async Execute( Hive, Plugin, Arguments )
	{
		return; // NOOP
	}


}

//---------------------------------------------------------------------
module.exports = Tool;
