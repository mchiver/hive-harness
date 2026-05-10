# HiveJS

HiveJS is a lightweight, plugin-based runtime for Node.js.
It provides per-folder data isolation, user authentication, and a tool execution framework designed for AI integration.


## What is it?

HiveJS is a small engine with three core concepts:

- **Registry** - A global store of plugin definitions and user accounts. Typically lives at a path like `~/.hives`.
- **Hive** - A per-folder instance opened against a Registry with user credentials. Each folder gets its own `.hive/` data directory, keeping plugin data isolated between projects.
- **Plugins and Tools** - Plugins are loaded from the Registry and provide executable Tools. Tools have JSON Schema definitions for their parameters and return values, making them directly consumable by AI tool-use interfaces.


## What is it for?

HiveJS is designed to be the backend for AI agent harnesses.
Plugins expose structured tools that AI agents can discover, understand, and invoke.
Each Hive provides a sandboxed, authenticated workspace where agents operate on a specific folder with access to configured plugins.


## How does it work?

```js
// Open a registry and authenticate
var registry = await Registry.Open( '~/.hives' );
var hive = await Hive.Open( registry, '/path/to/project', 'username', 'password' );

// Invoke a tool
var result = await hive.InvokeTool( 'KeyStore.SetKey', {
    EntityName: 'my-store',
    Key: 'greeting',
    Value: 'hello world',
} );
```

Plugins are loaded from the Registry's `Plugins/` folder. Each plugin can define:
- **Tools** - Executable functions with typed parameters and returns.
- **Entities** - Managed instances with automatic CRUD operations (list, configure, delete, rename).

Data is stored per-Hive in the `.hive/` directory, ensuring complete isolation between folders.


## Documentation

### Guides

- [Application Developer Guide](Docs/Application-Developers-Guide.md) - How to integrate HiveJS into your application.
- [Plugin Developer Guide](Docs/Plugin-Developers-Guide.md) - How to build plugins and tools for HiveJS.

### References

- [KeyStore Plugin Reference](Docs/Reference/KeyStore-Plugin-Reference.md)

## License

MIT - See [license.md](license.md) for details.
