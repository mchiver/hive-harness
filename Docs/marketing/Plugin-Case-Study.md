# Case Study: Building a "Jira Ticket Integrator" Plugin for HiveJS

## The Challenge
A development team wants their AI agent to be able to create Jira tickets based on local codebase analysis. They need the agent to:
1. Analyze a local bug report file.
2. Extract the summary and description.
3. Create a ticket in Jira without giving the AI agent the full Jira API key or raw HTTP access.

## The HiveJS Solution
Instead of writing a custom script, the team creates a **HiveJS Plugin**. This encapsulates the Jira API logic and exposes it as a structured tool.

### Step 1: Define the Tool
The plugin defines a tool called `Jira.CreateTicket` with a JSON Schema:
- `Summary`: String (Required)
- `Description`: String (Required)
- `ProjectKey`: String (Required)

### Step 2: Implement the Logic
The plugin handles the authentication using the `KeyStore` plugin to retrieve the API token securely from the Hive's isolated storage.

```js
// Simplified implementation logic
async function CreateTicket( hive, args )
{
    var token = await hive.InvokeTool( 'KeyStore.GetKey', { EntityName: 'Jira', Key: 'ApiToken' } );
    var response = await Fetch.Post( 'https://jira.company.com/rest/api/2/issue', {
        headers: { 'Authorization': `Bearer ${token}` },
        body: { fields: { summary: args.Summary, description: args.Description, project: { key: args.ProjectKey } } }
    });
    return response.json();
}
```

### Step 3: Integration
The plugin is dropped into the global `Plugins/` folder of the Registry. Immediately, any AI agent connected to a Hive can now "see" the `Jira.CreateTicket` tool via the `System.ListTools` command.

## The Result
- **Security:** The AI agent never sees the Jira API token; it only calls the tool.
- **Precision:** The JSON Schema prevents the agent from sending malformed requests.
- **Isolation:** The Jira configuration is stored within the project's `.hive/` folder, allowing different projects to map to different Jira boards.

## Key Takeaway
HiveJS turns a complex API integration into a **standardized capability**. By moving the complexity into a plugin, the AI agent can focus on the "what" (creating the ticket) while HiveJS handles the "how" (auth, transport, and validation).
