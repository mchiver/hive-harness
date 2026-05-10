# HiveJS: Feature Comparison Matrix

## Positioning: The AI-Ready Runtime vs. Traditional Frameworks

This matrix contrasts HiveJS with general-purpose AI agent frameworks (e.g., LangChain, AutoGPT) and raw shell execution.

| Feature | Raw Shell Execution | Generic AI Frameworks | **HiveJS** |
| :--- | :--- | :--- | :--- |
| **Data Isolation** | None (Global Access) | Limited/Application-level | **Per-Folder Isolation (`.hive/`)** |
| **Tool Discovery** | Manual/Hardcoded | Prompt-based/Dynamic | **JSON Schema Standardized** |
| **Security Model** | OS Permissions (Risky) | App-level logic | **Built-in Auth & RBAC** |
| **State Management** | Manual File I/O | In-memory/External DB | **Project-Centric Local State** |
| **Extensibility** | Write new scripts | Custom Python/JS classes | **Modular Plugin Registry** |
| **Deployment** | System-wide | Cloud/Container | **Local Runtime / Portable** |
| **LLM Integration** | High-friction glue code | High-level abstractions | **Direct Tool-Use Mapping** |

## Key Differentiators

### 1. Data Locality vs. Data Centralization
Most AI frameworks treat data as something to be "ingested" into a vector store or database. HiveJS treats data as something that **belongs to the project**. By using the "Hive" model, the AI operates *in situ*, maintaining the natural structure of the user's workspace.

### 2. Structured Tools vs. Unstructured Prompts
Rather than relying on a prompt to "try and use this command," HiveJS provides a formal contract. The JSON Schema ensures the LLM knows exactly what `KeyStore.SetKey` requires, reducing hallucinations and execution errors.

### 3. The "Developer's Safety Valve"
Unlike raw shell access—where a hallucinated `rm -rf /` could be catastrophic—HiveJS limits the agent to the tools provided by installed plugins. If a "Delete All Files" tool doesn't exist in the plugin, the agent simply cannot do it.
