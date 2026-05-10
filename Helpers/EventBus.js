/*
	EventBus.js
---------------------------------------------------------------------
Lightweight in-process pub/sub event bus.
Supports wildcard topic patterns (e.g. 'tool.*' matches 'tool.before').
Handlers are awaited sequentially for predictable ordering.
*/


//=====================================================================
class EventBus
{


	//---------------------------------------------------------------------
	constructor()
	{
		this.subscriptions = {};
		this.next_id = 1;
	}


	//---------------------------------------------------------------------
	// Subscribe a handler to an event name or wildcard pattern.
	// Returns a subscription ID that can be used to unsubscribe.
	Subscribe( EventName, Handler )
	{
		var id = this.next_id++;
		this.subscriptions[ id ] = {
			EventName: EventName,
			Handler: Handler,
			Regex: build_pattern_regex( EventName ),
		};
		return id;
	}


	//---------------------------------------------------------------------
	// Remove a subscription by ID.
	Unsubscribe( SubscriptionId )
	{
		delete this.subscriptions[ SubscriptionId ];
	}


	//---------------------------------------------------------------------
	// Publish an event. Awaits all matching handlers sequentially.
	async Publish( EventName, Data )
	{
		for ( var id in this.subscriptions )
		{
			var sub = this.subscriptions[ id ];
			if ( sub.Regex.test( EventName ) )
			{
				await sub.Handler( Data );
			}
		}
	}


	//---------------------------------------------------------------------
	// Remove all subscriptions.
	Clear()
	{
		this.subscriptions = {};
	}


}


//=====================================================================
// Build a regex from an event name pattern.
// Supports * as a wildcard for a single segment (between dots).
// Supports ** as a wildcard for any number of segments.
function build_pattern_regex( Pattern )
{
	// Replace ** and * with placeholders before any escaping
	var result = '';
	var index = 0;
	while ( index < Pattern.length )
	{
		if ( Pattern[ index ] === '*' && Pattern[ index + 1 ] === '*' )
		{
			result += '<<DOUBLESTAR>>';
			index += 2;
		}
		else if ( Pattern[ index ] === '*' )
		{
			result += '<<STAR>>';
			index += 1;
		}
		else if ( Pattern[ index ] === '.' )
		{
			result += '\\.';
			index += 1;
		}
		else
		{
			// Escape regex special characters
			var char = Pattern[ index ];
			if ( '+?^${}()|[]\\'.indexOf( char ) > -1 )
			{
				result += '\\' + char;
			}
			else
			{
				result += char;
			}
			index += 1;
		}
	}

	// Restore placeholders with regex patterns
	result = result.replace( /<<DOUBLESTAR>>/g, '.*' );
	result = result.replace( /<<STAR>>/g, '[^.]+' );

	return new RegExp( '^' + result + '$' );
}


module.exports = EventBus;
