

//---------------------------------------------------------------------
// Plugin class - container for plugin metadata and methods
class Plugin
{


	//---------------------------------------------------------------------
	constructor( Registry, PluginName )
	{
		// Plugin Properties
		this.Registry = Registry;		// The registry used to initialize plugin.
		this.PluginName = PluginName;	// The name of the plugin.
		this.Description = '';
		this.RequiredRole = 'guest';
		this.SourcePath = '';
		// Plugin Configuration Schema
		this.ConfigSchema = {};
		// Entity Configuration Schema
		this.EntitySchema = null;
		// Plugin Tools
		this.Tools = {};
		return;
	}


} // end class Plugin



//---------------------------------------------------------------------
module.exports = Plugin;
