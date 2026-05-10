# MessageQueue Plugin Reference


## Summary

The MessageQueue plugin provides persistent message queues within a Hive.
Each MessageQueue is an entity instance backed by its own SQLite database at `.hive/Entities/<owner>/MessageQueue/<EntityName>/messages.db`.

Supports two subscription modes:
- **Notify** — messages queue up for consumers to peek/consume/ack at their own pace (polling model).
- **Invoke** — messages auto-dispatch a tool call when published (reactive model).

Messages that fail repeatedly are moved to a dead letter queue for inspection.


## Use Cases

- **Event-driven automation** — Publish events when things happen, subscribe tools to react.
- **Task queues** — Distribute work items to consumers via consume/ack.
- **Notification channels** — Queue messages for later retrieval.
- **Decoupled plugins** — Plugins communicate via topics without knowing about each other.
- **Retry and error handling** — Failed messages get retried, then dead-lettered.


## Entity Management

| Signature | Description |
|---|---|
| `ConfigEntity( EntityName, [Settings] )` | Read, create, or update a queue's configuration. |
| `ListEntities()` | Lists all MessageQueue instances. |
| `DeleteEntity( EntityName )` | Deletes a queue and all its data. |
| `RenameEntity( EntityName, NewEntityName )` | Renames a queue. |

### Entity Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `Name` | string | (required) | Queue name. |
| `Description` | string | `''` | Human-readable description. |
| `MaxRetries` | number | `3` | Maximum retry attempts before dead-lettering. |
| `RetryDelayMs` | number | `1000` | Delay between retries (reserved for future use). |


## Publishing & Subscribing

| Signature | Description |
|---|---|
| `Publish( EntityName, Topic, Payload )` | Publish a message to a topic. |
| `Subscribe( EntityName, TopicPattern, Mode, [ToolCall] )` | Register a subscription. |
| `Unsubscribe( EntityName, SubscriptionId )` | Remove a subscription. |
| `ListSubscriptions( EntityName )` | List all subscriptions. |

### Publish

Publishes a message. For `invoke`-mode subscriptions matching the topic, the tool call is executed automatically. The message payload is merged into the tool call arguments as `_MessageId`, `_Topic`, and `_Payload`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `Topic` | string | yes | Topic/routing key. |
| `Payload` | any | yes | Message payload (JSON-serializable). |

**Returns:** `{ MessageId }` or `{ Error }`.

### Subscribe

Registers a subscription. Subscriptions persist in the database.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `TopicPattern` | string | yes | Glob pattern (e.g. `"order.*"`). |
| `Mode` | string | yes | `"notify"` or `"invoke"`. |
| `ToolCall` | object | invoke only | `{ PluginName, ToolName, Arguments }`. |

**Returns:** `{ SubscriptionId }` or `{ Error }`.

**Usage:**
```js
// Notify mode — queue messages for polling
await hive.InvokeTool( 'MessageQueue.Subscribe', {
    EntityName: 'events',
    TopicPattern: 'order.*',
    Mode: 'notify',
} );

// Invoke mode — auto-dispatch a tool call
await hive.InvokeTool( 'MessageQueue.Subscribe', {
    EntityName: 'events',
    TopicPattern: 'order.created',
    Mode: 'invoke',
    ToolCall: { PluginName: 'KeyStore', ToolName: 'SetKey', Arguments: { EntityName: 'audit', Key: 'last_order' } },
} );
```


## Consuming Messages

| Signature | Description |
|---|---|
| `Peek( EntityName, [Topic], [Limit] )` | View pending messages without consuming. |
| `Consume( EntityName, [Topic], [Limit] )` | Fetch messages and mark as processing. |
| `Ack( EntityName, MessageId )` | Mark a message as completed. |
| `Reject( EntityName, MessageId, [Reason] )` | Retry or dead-letter a message. |

### Peek

View pending messages without changing their status.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `Topic` | string | no | Filter by topic. |
| `Limit` | number | no | Max messages (default: 10). |

**Returns:** `{ Messages: [ { MessageId, Topic, Payload, Status, RetryCount, CreatedAt } ] }`

### Consume

Fetch pending messages and mark them as `processing`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `Topic` | string | no | Filter by topic. |
| `Limit` | number | no | Max messages (default: 1). |

**Returns:** `{ Messages: [ { MessageId, Topic, Payload, RetryCount, CreatedAt } ] }`

### Ack

Acknowledge a message as successfully processed.

**Parameters:** `EntityName`, `MessageId`.

**Returns:** `{ Success }` or `{ Error }`.

### Reject

Reject a message. If retry count is under `MaxRetries`, the message goes back to `pending`. Otherwise, it moves to the dead letter queue.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `MessageId` | number | yes | Message ID. |
| `Reason` | string | no | Reason for rejection. |

**Returns:** `{ Action: "retried" | "dead_lettered" }` or `{ Error }`.


## Queue Management

| Signature | Description |
|---|---|
| `PurgeQueue( EntityName, [Topic], [Status] )` | Remove messages by filter. |
| `ListDeadLetters( EntityName, [Topic] )` | View dead letter messages. |

### PurgeQueue

Remove messages from the queue. Without filters, removes all messages.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `EntityName` | string | yes | Queue name. |
| `Topic` | string | no | Filter by topic. |
| `Status` | string | no | Filter by status. |

**Returns:** `{ Purged }` — number of messages removed.

### ListDeadLetters

View messages that failed after maximum retries.

**Parameters:** `EntityName`, optional `Topic`.

**Returns:** `{ DeadLetters: [ { DeadLetterId, OriginalMessageId, Topic, Payload, Error, CreatedAt } ] }`


## Data Storage

```
.hive/Entities/<owner>/MessageQueue/<EntityName>/<EntityName>.entity.json   # Entity configuration
.hive/Entities/<owner>/MessageQueue/<EntityName>/messages.db                # SQLite database
```
