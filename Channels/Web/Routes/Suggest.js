/*
	Routes/Suggest.js
---------------------------------------------------------------------
Autocomplete suggestion route.
*/


//---------------------------------------------------------------------
module.exports = function ( App, Channel )
{


	//---------------------------------------------------------------------
	// GET /api/suggest?input=PartialText
	App.get( '/api/suggest', async function ( req, res )
	{
		try
		{
			var input = req.query.input || '';
			var suggestions = await Channel.GetSuggestions( req.Hive, input );
			res.json( { Suggestions: suggestions } );
		}
		catch ( error )
		{
			res.status( 500 ).json( { Error: error.message } );
		}
	} );


};
