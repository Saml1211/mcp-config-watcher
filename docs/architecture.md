# MCP Config Watcher Architecture

## System Design

The MCP Config Watcher follows a modular design with clear separation of concerns. It is built around several core components that work together to monitor MCP server configurations and generate documentation.

```
                ┌───────────────┐
                │ Configuration │
                └───────┬───────┘
                        │
                        ▼
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Settings │◄───►│   Service   │◄───►│  Interfaces  │
│   File    │     │   Manager   │     │ (CLI/Web/Tray)│
└──────────┘     └──────┬──────┘     └──────────────┘
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
       ▼                ▼                 ▼
┌────────────┐   ┌────────────┐   ┌─────────────────┐
│   Watcher  │   │   Parser   │   │ MD Generator    │
└────────────┘   └────────────┘   └─────────────────┘
                                          │
                                          ▼
                                  ┌─────────────────┐
                                  │  Documentation  │
                                  │     Output      │
                                  └─────────────────┘
```

## Component Breakdown

### 1. Configuration System

- **Purpose**: Provides centralized configuration management
- **Key File**: `src/config/loader.js`
- **Responsibilities**:
  - Loading configuration from YAML file
  - Providing default configuration values
  - Validating configuration parameters

### 2. Service Manager

- **Purpose**: Coordinates all components and manages the lifecycle
- **Key File**: `src/core/service.js`
- **Responsibilities**:
  - Initializing components
  - Handling lifecycle events (start, stop)
  - Processing file change events
  - Coordinating documentation generation

### 3. File Watcher

- **Purpose**: Monitors the MCP settings file for changes
- **Key File**: `src/core/watcher.js`
- **Responsibilities**:
  - Setting up file watching
  - Detecting file modifications
  - Triggering update events
  - Handling filesystem errors

### 4. Parser

- **Purpose**: Extracts and processes MCP server and tool data
- **Key File**: `src/core/parser.js`
- **Responsibilities**:
  - Reading and parsing the settings file
  - Extracting server configurations
  - Mapping servers to their tools
  - Providing tool descriptions

### 5. Markdown Generator

- **Purpose**: Creates and updates documentation
- **Key File**: `src/core/generator.js`
- **Responsibilities**:
  - Building markdown content
  - Safe updating of existing documentation
  - Highlighting auto-approved tools
  - Preserving user-added content

### 6. Interfaces

- **Command Line Interface**
  - **Key File**: `src/interfaces/cli/index.js`
  - **Features**: Start, stop, status, update commands

- **Web Dashboard**
  - **Key File**: `src/interfaces/web/index.js`
  - **Features**: Visual monitoring, manual updates, configuration

- **System Tray Application**
  - **Key File**: `src/interfaces/tray/index.js`
  - **Features**: Quick access, status indicators, basic controls

## Code Organization

The project follows a structured organization:

```
mcp-config-watcher/
├── bin/                    # Executable scripts
│   └── mcp-watcher.js      # CLI entry point
├── src/                    # Source code
│   ├── index.js            # Main entry point
│   ├── config/             # Configuration handling
│   │   └── loader.js       # Config loader
│   ├── core/               # Core components
│   │   ├── generator.js    # Markdown generator
│   │   ├── parser.js       # Settings parser
│   │   ├── service.js      # Service manager
│   │   └── watcher.js      # File watcher
│   └── interfaces/         # User interfaces
│       ├── cli/            # Command line interface
│       ├── tray/           # System tray application
│       └── web/            # Web dashboard
├── config.yml              # Configuration file
└── docs/                   # Documentation
```

## Data Flow

1. The **Watcher** detects changes in the MCP settings file
2. The **Service Manager** receives the change notification
3. The **Parser** reads and extracts information from the settings file
4. The **Markdown Generator** creates or updates the documentation
5. The **Interfaces** are notified of the changes and update accordingly

## Key Algorithms

### Server-Tool Mapping

The Parser maintains a mapping of known MCP servers to their tools in the `buildServerToolsMap()` method. This mapping is used to associate servers with their available tools.

### MCP Tool Discovery

The tool discovery process uses a multi-layered approach to identify available tools:

1. **JSON-RPC Protocol**: Primary method that sends a standard JSON-RPC 2.0 request with method `tools/list` to the MCP server
2. **Server Output Parsing**: When direct JSON-RPC fails, parses server output for tool definitions using multiple pattern matching techniques
3. **Auto-Approved Tools**: Falls back to the auto-approved tools list from the server configuration
4. **AI Prediction**: Optionally uses AI to predict tools when both direct methods fail

The discovery process includes several patterns for identifying tools in server output:
- Standard JSON-RPC response format
- OpenAI function format
- Tools array format
- Line-by-line JSON parsing
- Function declaration detection

### Safe Documentation Update

The Markdown Generator uses a sophisticated algorithm to update the documentation without overwriting user-added content:

1. Parse existing documentation into sections
2. Generate new server sections
3. Merge the content, preserving non-server sections
4. Update the footer with the current timestamp

### Tool Auto-Approval Highlighting

Tools that are configured with `autoApprove: true` in the settings are visually highlighted in the documentation with a 🔓 icon and "(Auto-Approved)" label, making it easy to identify tools that have elevated permissions.

## Upcoming Enhancements

The architecture will be extended to include:

1. **Dynamic Tool Discovery**: Using AI to predict tools for new servers
2. **Server Introspection**: Ability to query servers for their available tools
3. **Enhanced Documentation**: More comprehensive tool information
