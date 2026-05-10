# WebSearch Plugin Reference

## Overview

The WebSearch plugin provides tools for searching the web using various search engines. Currently supports Tavily API and Wikipedia search.

## Configuration

The plugin requires configuration for API keys:

```json
{
  "TavilyApiKey": "your-tavily-api-key"
}
```

Configure the plugin using the `System.ConfigPlugin` tool:

```
System.ConfigPlugin PluginName=WebSearch Settings={TavilyApiKey: "your-api-key"}
```

## Tools

### TavilySearch

Search the web using the Tavily API.

**Parameters:**
- `Text` (string, required): The search query text
- `SearchDepth` (string, optional): Search depth ("basic" or "advanced"), default: "basic"
- `MaxResults` (integer, optional): Maximum number of results to return (0 for all), default: 0

**Returns:**
- `Results` (array): Array of search results with Title, Url, Content, and Score
- `Error` (string): Error message if search failed

**Example:**
```
WebSearch.TavilySearch Text="latest developments in AI" SearchDepth="advanced" MaxResults=3
```

### WikipediaSearch

Search Wikipedia for articles.

**Parameters:**
- `Text` (string, required): The search query text
- `Limit` (integer, optional): Maximum number of results to return from initial search, default: 5
- `MaxResults` (integer, optional): Maximum number of results to return (0 for all), default: 0

**Returns:**
- `Results` (array): Array of Wikipedia search results with Title, Url, Snippet, and PageId
- `Error` (string): Error message if search failed

**Example:**
```
WebSearch.WikipediaSearch Text="artificial intelligence" MaxResults=3
```

## Requirements

- Internet connection for API access