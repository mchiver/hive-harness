# Architecture Visuals: Design Specifications

This document defines the requirements for the visual diagrams needed to explain the HiveJS architecture.

## Diagram 1: Registry vs. Hive (The Scope Model)
**Goal:** Visualize the relationship between the global registry and the per-folder hive instances.

```mermaid
graph TD
    subgraph Registry [Global Registry]
        RP[Plugins Folder]
        RU[Users Folder]
    end

    subgraph ProjectA [Project A Folder]
        HA[".hive/ Folder"]
        HAP[Plugin Data]
        HAD[Local DBs/Files]
        HA --> HAP
        HA --> HAD
    end

    subgraph ProjectB [Project B Folder]
        HB[".hive/ Folder"]
        HBP[Plugin Data]
        HBD[Local DBs/Files]
        HB --> HBP
        HB --> HBD
    end

    subgraph ProjectC [Project C Folder]
        HC[".hive/ Folder"]
        HCP[Plugin Data]
        HCD[Local DBs/Files]
        HC --> HCP
        HC --> HCD
    end

    HA -- "Opens against" --> Registry
    HB -- "Opens against" --> Registry
    HC -- "Opens against" --> Registry
```

**Visual Elements:**
- **Global Registry (Center):** A large box containing:
    - `Plugins/` folder (Shared blueprints for all Hives)
    - `Users/` folder (Central identity store)
- **Project Folders (Periphery):** Three separate project folder icons (e.g., `Project-A`, `Project-B`, `Project-C`).
- **The Hive (Inside Projects):** Inside each project folder, a smaller `.hive/` folder containing:
    - `PluginData/` (Project-specific configuration and state)
    - Local DBs/Files (Isolated data)
- **Connecting Lines:** Arrows showing a Hive "opening" against the Registry to load plugin definitions.

## Diagram 2: The Tool Invocation Flow (The Request Path)
**Goal:** Trace a request from the user's intent to the local system action.

```mermaid
sequenceDiagram
    participant U as User/Developer
    participant A as AI Agent
    participant H as HiveJS Core
    participant P as Plugin (Workspace)
    participant FS as Local File System

    U->>A: "Fix the bug in user.js"
    A->>A: Analyzes intent
    A->>H: InvokeTool('Workspace.WriteFile', args)
    H->>H: Validates tool & permissions
    H->>P: Execute tool logic
    P->>FS: fs.writeFile(relative_path)
    FS-->>P: Success/Error
    P-->>H: Result
    H-->>A: Structured Result
    A-->>U: "I've fixed the bug in user.js"
```

**Flow Sequence:**
1. **User/Developer:** "Fix the bug in user.js" $\rightarrow$
2. **AI Agent:** Analyzes intent $\rightarrow$ selects tool `Workspace.WriteFile` $\rightarrow$
3. **HiveJS Core:** Validates tool name $\rightarrow$ checks user permissions $\rightarrow$
4. **Plugin (Workspace):** Executes the actual Node.js `fs.writeFile` logic using the project-relative path $\rightarrow$
5. **Local File System:** File is updated on disk.
6. **Response Loop:** Result $\rightarrow$ HiveJS $\rightarrow$ AI Agent $\rightarrow$ User.

## Diagram 3: The "Sandbox of Truth" (Comparison)
**Goal:** Contrast raw shell access vs. HiveJS tool access.

```mermaid
graph LR
    subgraph RawShell [Raw Shell Access]
        A1[AI Agent] --> B1[bash/shell]
        B1 --> C1[Full System Access]
        style C1 fill:#f96,stroke:#333,stroke-width:2px
    end

    subgraph HiveJS [HiveJS Tool Access]
        A2[AI Agent] --> B2[Curated Toolset]
        subgraph Tools [Available Tools]
            T1[Tool A]
            T2[Tool B]
            T3[Tool C]
        end
        B2 --> Tools
        Tools --> C2[Specific Project Folder]
        style C2 fill:#9f9,stroke:#333,stroke-width:2px
    end
```

- **Left Side (Raw Shell):** A "Wild West" visual. AI agent $\rightarrow$ `bash` $\rightarrow$ Full system access (Risky).
- **Right Side (HiveJS):** A "Curated Gallery" visual. AI agent $\rightarrow$ [ Tool A | Tool B | Tool C ] $\rightarrow$ Specific project folder (Secure).
