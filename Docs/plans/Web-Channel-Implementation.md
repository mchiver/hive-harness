# Web Channel Implementation Plan

## Context

HiveJS has a working Channel system (base class + CLI) and a Conversation plugin with chat, history, and tool calling. The Web channel will be the primary interface for hive administration and chat. It serves multiple concurrent users against a single Hive instance, with an Express backend streaming chat events via SSE, and an AngularJS + Bootstrap frontend.

The current `Conversation.Chat` pipeline works but is a black box — it returns a final result with no visibility into intermediate steps. The history schema stores flat text rows. Both need to change to support the detailed chat UI (prompt inspection, tool call tracking, per-step timestamps).

## New Dependency

- `express` (^4.21.0) — Web server. Only new npm dependency.
- AngularJS 1.8.3 + Bootstrap 5.3.0 — loaded from CDN in `index.html`

## Scope Overview

### Backend Changes (Conversation Plugin)
1. History schema: replace single `History` table with `Messages` + `Tools` tables
2. Chat EventBus events: emit structured events during Chat execution
3. Update all Conversation tools for new schema

### New Files (Web Channel)
4. Express server with auth middleware and REST/SSE routes
5. AngularJS SPA with three views: Dashboard, Management, Chat

---

## Phase 1: History Schema Change

**Why:** The web chat UI needs per-message detail (prompt context, token count, individual tool calls with timing/status). The current flat `(Source, Content, Tokens)` schema can't represent this.

### New Tables

**File:** `Plugins/Conversation/Conversation.factory.js`

Replace `HISTORY_TABLE` / `HISTORY_SCHEMA` with:

```sql
-- messages table
CREATE TABLE Messages (
    MessageID INTEGER PRIMARY KEY AUTOINCREMENT,
    Timestamp TEXT NOT NULL,
    Username TEXT NOT NULL DEFAULT '',
    LlmName TEXT NOT NULL DEFAULT '',
    Context TEXT NOT NULL DEFAULT '',
    Text TEXT NOT NULL
);

-- tools table
CREATE TABLE Tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageID INTEGER NOT NULL,
    Timestamp TEXT NOT NULL,
    ConversationName TEXT NOT NULL DEFAULT '',
    ToolName TEXT NOT NULL,
    Status TEXT NOT NULL DEFAULT 'ok',
    Arguments TEXT NOT NULL DEFAULT '{}',
    Results TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (MessageID) REFERENCES Messages(MessageID)
);
```

### Factory Method Changes

Replace `AppendHistory` with two methods:
- `AppendMessage( Hive, EntityName, Username, LlmName, Context, Text )` → returns `{ MessageID }`
- `AppendToolCall( Hive, EntityName, MessageID, ConversationName, ToolName, Status, Arguments, Results )`

Replace `GetRecentHistory` with:
- `GetRecentMessages( Hive, EntityName, MaxItems )` → returns array of `{ MessageID, Timestamp, Username, LlmName, Context, Text, Tools: [...] }`
- Query: SELECT from messages LEFT JOIN tools, group tool rows under their parent message

### Migration

No backwards compatibility needed. Drop the old `History` table and schema entirely. `OpenHistoryDatabase` creates the new `Messages` and `Tools` tables fresh. Existing conversation history databases will need to be deleted manually if they exist (or they'll be ignored since the old table is never queried).

### Files Affected
- `Conversation.factory.js` — Schema, AppendMessage, AppendToolCall, GetRecentMessages, migration
- `Tools/Chat/Chat.js` — Use AppendMessage/AppendToolCall instead of AppendHistory
- `Tools/GetHistory/GetHistory.js` — Use GetRecentMessages, return new format
- `Tools/ClearHistory/ClearHistory.js` — Delete from both tables
- `Tests/300-Conversation-Tools.test.js` — Update assertions for new schema/format

---

## Phase 2: Chat EventBus Events

**Why:** The web channel needs to stream intermediate steps (prompt built, tool calls in progress, final response) via SSE. The EventBus is the natural mechanism — it already exists on `Hive.Events` and `tool.before`/`tool.after` events are already emitted by CommandProcessor.

**File:** `Plugins/Conversation/Tools/Chat/Chat.js`

Add event emissions at key points in `Tool.Execute`:

```
After building prompt:
  Hive.Events.Publish( 'conversation.prompt.built', {
      ConversationName, MessageID, Tokens
  })

Before each tool call:
  Hive.Events.Publish( 'conversation.tool.start', {
      ConversationName, MessageID, ToolName, Arguments
  })

After each tool call:
  Hive.Events.Publish( 'conversation.tool.complete', {
      ConversationName, MessageID, ToolName, Status, Duration
  })

After final response:
  Hive.Events.Publish( 'conversation.response', {
      ConversationName, MessageID, Text
  })
```

The `MessageID` comes from the `AppendMessage` call for the user's message (the first INSERT). Tool call timing uses `Date.now()` before/after `Hive.InvokeTool`.

**Note:** Events carry summary data only (no full prompt text or full tool results in events). The full detail is stored in the database tables. The SSE client uses events for real-time status, then fetches full detail from `/api/chat/history` as needed.

---

## Phase 3: Web Channel Server

### Architecture

The Web channel does **not** use `Channel.Run()`. It defines its own `WebChannel.Serve()` entry point because:
- `Channel.Run()` assumes single user, single process
- Web needs multi-user, long-running server
- Auth is interactive (login form), not CLI flags

The Hive is opened once at startup with `--username`/`--password` for the service account. Per-request user identity comes from JWT in the Authorization header.

### File Structure

```
Channels/Web/
    Web.js                  — WebChannel class + Express setup + Serve()
    Middleware/
        Auth.js             — JWT verification middleware
    Routes/
        Auth.js             — POST /api/auth/login, GET /api/auth/me
        System.js           — GET /api/system/info, /plugins, /tools
        Entities.js         — CRUD /api/plugins/:plugin/entities/:name
        Chat.js             — POST /api/chat, GET /api/chat/stream (SSE), GET /api/chat/history
        Conversations.js    — GET/POST /api/conversations
        Tools.js            — POST /api/tools/invoke
        Suggest.js          — GET /api/suggest?input=X
    public/
        index.html          — SPA shell
        css/
            theme.css       — Light/dark + scale (small/normal/large)
        js/
            app.js          — AngularJS app, routing, nav
            services/
                AuthService.js
                ApiService.js
                SseService.js
                SchemaService.js
            controllers/
                LoginController.js
                DashboardController.js
                ManagementController.js
                ChatController.js
            directives/
                SchemaEditor.js
                ChatMessage.js
                TreeView.js
            views/
                login.html
                dashboard.html
                management.html
                chat.html
```

### Web.js Entry Point

```js
class WebChannel extends Channel
{
    constructor()
    {
        super();
        this.ChannelName = 'web';
        this.SseClients = new Map();  // connectionId → { res, username, conversation }
    }

    static async Serve()
    {
        var channel = new WebChannel();
        channel.Options = MINIMIST( process.argv.slice( 2 ) );

        // --help
        if ( channel.Options.help ) { channel.ShowHelp(); return; }

        // Initialize Registry + Hive (with service account credentials)
        await channel.Initialize();

        // Build Express app
        var app = EXPRESS();
        app.use( EXPRESS.json() );
        app.use( EXPRESS.static( PATH.join( __dirname, 'public' ) ) );

        // Mount routes (each gets channel reference for Hive access)
        require( './Routes/Auth.js' )( app, channel );
        // ... etc

        // SPA fallback
        app.get( '*', ( req, res ) => res.sendFile( 'index.html', { root: ... } ) );

        var port = channel.Options.port || 3000;
        channel.Server = app.listen( port );
    }
}

WebChannel.Serve();
```

### CLI Args for Web

| Flag | Description | Default |
|---|---|---|
| `--registry <path>` | Registry path | `~/.hives` |
| `--hive <path>` | Hive workspace path | cwd |
| `--username <name>` | Service account username | OS username |
| `--password <pass>` | Service account password | none |
| `--port <number>` | HTTP port | 3000 |
| `--help` | Show help | — |

### Auth Middleware

JWT verification per-request:
1. Skip `/api/auth/login` and static file paths
2. Extract `Authorization: Bearer <token>` header
3. Decode JWT (without verification) to get `Username`
4. Load user file from Registry to get `PasswordHash`
5. `JWT.verify( token, PasswordHash )` — validates signature + expiry
6. Set `req.User = { Username, Role }` on success; 401 on failure

### SSE Pattern (Routes/Chat.js)

```
GET /api/chat/stream?conversation=X
    res.setHeader( 'Content-Type', 'text/event-stream' )
    res.setHeader( 'Cache-Control', 'no-cache' )
    res.setHeader( 'Connection', 'keep-alive' )

    Subscribe to Hive.Events for conversation.* events
    Filter events matching the requested ConversationName
    Write each as: `data: ${JSON.stringify(event)}\n\n`

    On res 'close': unsubscribe from EventBus, remove from SseClients

POST /api/chat
    Body: { ConversationName, Text }
    Call Hive.InvokeTool( 'Conversation.Chat', { ConversationName, Text } )
    Return: { MessageID, Response, ToolCalls }
    (SSE stream delivers real-time events during execution)
```

---

## Phase 4: REST API Endpoints

### Auth
- `POST /api/auth/login` → `{ Username, Password }` → `{ Token, UserName, UserRole }`
- `GET /api/auth/me` → `{ UserName, UserRole }` (from JWT)

### System
- `GET /api/system/info` → `System.Info`
- `GET /api/system/plugins` → `System.ListPlugins`
- `GET /api/system/tools?plugin=X` → `System.ListTools`

### Entities (generic CRUD)
- `GET /api/plugins/:plugin/entities` → `<Plugin>.ListEntities`
- `GET /api/plugins/:plugin/entities/:name` → `<Plugin>.ConfigEntity` (read)
- `PUT /api/plugins/:plugin/entities/:name` → `<Plugin>.ConfigEntity` (create/update with body as Settings)
- `DELETE /api/plugins/:plugin/entities/:name` → `<Plugin>.DeleteEntity`
- Validate `:plugin` exists in `Hive.Plugins` and has `EntitySchema`

### Chat
- `POST /api/chat` → `{ ConversationName, Text }` → `{ MessageID, Response, ToolCalls }`
- `GET /api/chat/stream?conversation=X` → SSE stream
- `GET /api/chat/history?conversation=X&limit=N` → `Conversation.GetHistory`

### Conversations
- `GET /api/conversations` → `Conversation.ListConversations` (filtered by req.User.Username + ChannelName='web')
- `POST /api/conversations` → Create new conversation entity (body: `{ Name?, ChatLlm? }`)
- `GET /api/conversations/:name` → Conversation entity config

### Tools (direct invocation)
- `POST /api/tools/invoke` → `{ PluginName, ToolName, Arguments }` → tool result

### Autocomplete
- `GET /api/suggest?input=X` → `{ Suggestions: [...] }`

---

## Phase 5: Frontend SPA

### SPA Shell (`index.html`)
- AngularJS 1.8.3 + angular-route from CDN
- Bootstrap 5.3.0 from CDN
- Navbar: logo/title, view tabs (Dashboard, Management, Chat), theme toggle, scale selector, user dropdown (username + logout)
- `<div ng-view></div>` for routed content

### Routing (`app.js`)
- `#!/login` → LoginController + login.html
- `#!/dashboard` → DashboardController + dashboard.html
- `#!/management` → ManagementController + management.html
- `#!/chat` → ChatController + chat.html
- Route change guard: redirect to login if no token

### Services

**AuthService** — Login/logout, JWT in localStorage, sets `$http` default Authorization header

**ApiService** — Thin wrapper around `$http` for all endpoints. Returns promises.

**SseService** — Manages `EventSource` to `/api/chat/stream`. Connect/disconnect/onEvent. Auto-reconnect. Fires Angular `$rootScope.$apply` on events.

**SchemaService** — Utilities for JSON Schema: extract property list, determine input type for property, generate default values, basic validation.

### Controllers

**LoginController** — Username + password form, calls AuthService.Login, redirects to dashboard.

**DashboardController** — Fetches System.Info, ListPlugins (with entity counts per plugin), recent Audit.Get entries. Displays cards/tables.

**ManagementController** — Left: TreeView of plugins → entities. Right: SchemaEditor for selected entity. Toolbar: New, Save, Delete, Rename. The EntitySchema for each plugin drives the editor. Tool argument schemas can also be edited via SchemaEditor for direct tool invocation.

**ChatController** — Status bar (conversation switcher dropdown, LLM name, connection indicator). Message list rendered via ChatMessage directives. Input bar with autocomplete dropdown (debounced fetch from /api/suggest). On send: POST to /api/chat, SSE events update status in real-time, final result appended to message list.

### Directives

**SchemaEditor** — Recursive directive. Given `schema` (JSON Schema) and `model` (object), renders form controls:
- `string` → text input (or textarea if description hints at long text)
- `number` → number input
- `boolean` → checkbox
- `array` → list with add/remove buttons
- `object` with `properties` → nested SchemaEditor
- `any` / `object` without properties → JSON textarea

**ChatMessage** — Renders one message:
- User: text bubble + collapsible "Prompt Details" panel (full prompt context, token count)
- LLM: text bubble + collapsible panel with tool call timeline (each call: name, timestamp, status badge, nested collapsibles for args/result)

**TreeView** — Hierarchical expandable tree. Click-to-select. Icons for plugins vs entities.

### Theming (`theme.css`)
- CSS custom properties: `--bg-primary`, `--text-primary`, `--accent`, etc.
- `.dark-theme` class toggles property values
- `.scale-small` / `.scale-normal` / `.scale-large` on body adjusts base font-size
- Toggle persisted in localStorage

---

## Phase 6: Tests

### `Tests/300-Conversation-Tools.test.js` — Update
- All history-related tests updated for new AppendMessage/AppendToolCall/GetRecentMessages API
- BuildPrompt tests already passing (unchanged)

### `Tests/301-Conversation-Chat-Live.test.js` — Update
- Verify ToolCalls in result match new schema (MessageID, Timestamps)
- Verify EventBus events are emitted during Chat execution

### `Tests/330-Web-Channel.test.js` — New
- Start Express server on random port in test setup, shut down in teardown
- Auth: login success/failure, token validation, /me endpoint
- System: info, plugins, tools endpoints
- Entities: CRUD lifecycle for a test entity
- Chat: send message + verify history endpoint returns detail
- SSE: connect to stream, send chat, verify events received
- Suggest: autocomplete returns expected results
- Static: index.html served at /

---

## Implementation Order

| Step | What | Files |
|---|---|---|
| 1 | History schema change + migration | `Conversation.factory.js` |
| 2 | Update Conversation tools for new schema | `Chat.js`, `GetHistory.js`, `ClearHistory.js` |
| 3 | Update existing Conversation tests | `300-Conversation-Tools.test.js` |
| 4 | Add EventBus events to Chat.js | `Chat.js` |
| 5 | `npm install express`, update `package.json` | `package.json` |
| 6 | Web.js + Auth middleware + Auth routes | `Web.js`, `Middleware/Auth.js`, `Routes/Auth.js` |
| 7 | API routes (System, Entities, Chat, Conversations, Tools, Suggest) | `Routes/*.js` |
| 8 | Frontend SPA shell + login | `index.html`, `app.js`, `theme.css`, `AuthService.js`, `LoginController.js` |
| 9 | Dashboard view | `DashboardController.js`, `dashboard.html` |
| 10 | Management view + SchemaEditor | `ManagementController.js`, `management.html`, `SchemaEditor.js`, `TreeView.js` |
| 11 | Chat view + SSE | `ChatController.js`, `chat.html`, `SseService.js`, `ChatMessage.js` |
| 12 | Web channel tests | `330-Web-Channel.test.js` |
| 13 | Update live chat tests for EventBus assertions | `301-Conversation-Chat-Live.test.js` |

Steps 1-4 are backend-only changes to the Conversation plugin.
Steps 5-7 are the Express server (testable with curl before any frontend).
Steps 8-11 are the frontend (incremental, each view independent).
Steps 12-13 are test coverage.

## Verification

1. `npm test` — All existing tests pass with history schema changes
2. `curl POST /api/auth/login` — Returns JWT
3. `curl GET /api/system/info` (with token) — Returns hive info
4. `curl GET /api/chat/stream` (with token) — SSE connection stays open
5. `curl POST /api/chat` — Returns response, SSE stream shows events
6. Browser: `http://localhost:3000` — Login, Dashboard, Management CRUD, Chat with tool calling
