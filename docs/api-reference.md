# MCP Config Watcher API Reference

This document provides detailed API reference for the MCP Config Watcher's core classes and methods.

## Core Components

### MCPSettingsParser

The parser class that extracts information from the MCP settings file.

```javascript
import { MCPSettingsParser } from 'mcp-config-watcher';

const parser = new MCPSettingsParser(config);
const data = await parser.parse('/path/to/settings.json');
```

#### Constructor

```javascript
new MCPSettingsParser(config)
```

- `config` (Object): Configuration object

#### Methods

##### parse(filePath)

Parses the MCP settings file and extracts server information.

- `filePath` (string): Path to the MCP settings file
- Returns: `Promise<Object>` - Parsed data

##### getToolDescription(toolName)

Gets the description for a specific tool.

- `toolName` (string): Name of the tool
- Returns: `string` - Tool description

##### getToolsForServer(serverId, serverToolsMap, serverConfig)

Gets tools for a specific server from the mapping or config.

- `serverId` (string): Server ID
- `serverToolsMap` (Object): Map of server IDs to tool names
- `serverConfig` (Object): Server configuration from settings
- Returns: `Array<string>` - Array of tool names

##### buildServerToolsMap()

Builds a mapping of server IDs to their tools.

- Returns: `Object` - Map of server IDs to arrays of tool names

##### extractServerInfo(mcpSettings)

Extracts server and tool information from MCP settings.

- `mcpSettings` (Object): Parsed MCP settings object
- Returns: `Object` - Extracted server and tool information

##### getToolDescriptionWithAI(toolName, serverId) [AI Enhanced]

Gets a tool description, using AI if no static description is available.

- `toolName` (string): Name of the tool
- `serverId` (string): Server ID
- Returns: `Promise<string>` - Tool description

##### discoverToolsForServer(serverId, serverConfig) [AI Enhanced]

Discovers tools for a server using static mapping, auto-approve list, and AI.

- `serverId` (string): Server ID
- `serverConfig` (Object): Server configuration
- Returns: `Promise<Array<string>>` - Discovered tools

##### extractServerInfoWithAI(mcpSettings) [AI Enhanced]

Extracts server info with AI-enhanced tool discovery.

- `mcpSettings` (Object): Parsed MCP settings object
- Returns: `Promise<Object>` - Extracted server and tool information

### MDGenerator

The generator class that creates and updates the markdown documentation.

```javascript
import { MDGenerator } from 'mcp-config-watcher';

const generator = new MDGenerator(config, parser);
await generator.generateMarkdown(data);
```

#### Constructor

```javascript
new MDGenerator(config, parser)
```

- `config` (Object): Configuration object
- `parser` (MCPSettingsParser): Parser instance

#### Methods

##### generateMarkdown(data)

Generates the markdown documentation.

- `data` (Object): Parsed MCP settings data
- Returns: `Promise<boolean>` - Success status

##### safeUpdateMarkdown(filePath, data, settings)

Safely updates the markdown file preserving user content.

- `filePath` (string): Path to the markdown file
- `data` (Object): Parsed MCP settings data
- `settings` (Object): Raw MCP settings
- Returns: `Promise<void>`

##### parseExistingContent(content)

Parses existing markdown content into sections.

- `content` (string): Existing markdown content
- Returns: `Object` - Parsed sections

##### generateServerSections(data, settings)

Generates server sections for the markdown file.

- `data` (Object): Parsed MCP settings data
- `settings` (Object): Raw MCP settings
- Returns: `Object` - Server sections

##### mergeContent(existingSections, newServerSections)

Merges existing content with new server sections.

- `existingSections` (Object): Existing content sections
- `newServerSections` (Object): New server sections
- Returns: `string` - Merged content

##### buildMarkdown(data, settings)

Builds markdown content for a new file.

- `data` (Object): Parsed MCP settings data
- `settings` (Object): Raw MCP settings
- Returns: `string` - Markdown content

### MCPWatcher

The watcher class that monitors the MCP settings file for changes.

```javascript
import { MCPWatcher } from 'mcp-config-watcher';

const watcher = new MCPWatcher(config);
await watcher.start();
```

#### Constructor

```javascript
new MCPWatcher(config)
```

- `config` (Object): Configuration object

#### Methods

##### start()

Starts watching the MCP settings file.

- Returns: `Promise<boolean>` - Success status

##### stop()

Stops watching the MCP settings file.

- Returns: `Promise<boolean>` - Success status

##### isRunning()

Checks if the watcher is running.

- Returns: `boolean` - Running status

##### update()

Manually updates the documentation.

- Returns: `Promise<boolean>` - Success status

### MCPService

The service class that coordinates the components and manages the lifecycle.

```javascript
import { MCPService } from 'mcp-config-watcher';

const service = new MCPService(config);
await service.start();
```

#### Constructor

```javascript
new MCPService(config)
```

- `config` (Object): Configuration object

#### Methods

##### start()

Starts the service.

- Returns: `Promise<boolean>` - Success status

##### stop()

Stops the service.

- Returns: `Promise<boolean>` - Success status

##### isRunning()

Checks if the service is running.

- Returns: `boolean` - Running status

##### processFileChange(filePath)

Processes a change to the MCP settings file.

- `filePath` (string): Path to the changed file
- Returns: `Promise<boolean>` - Success status

### AIHelper [Optional]

The AI helper class that enhances tool discovery and descriptions.

```javascript
import { AIHelper } from 'mcp-config-watcher';

const aiHelper = new AIHelper(config);
const tools = await aiHelper.predictToolsForServer('github.com/example/server');
```

#### Constructor

```javascript
new AIHelper(config)
```

- `config` (Object): Configuration object

#### Methods

##### predictToolsForServer(serverId)

Predicts tools for a server based on its ID.

- `serverId` (string): The server ID
- Returns: `Promise<Array<string>>` - Array of predicted tools

##### generateToolDescription(toolName, serverId)

Generates a description for a tool.

- `toolName` (string): The tool name
- `serverId` (string): The server ID for context
- Returns: `Promise<string>` - Generated description

## CLI

The command line interface for the MCP Config Watcher.

```bash
mcp-watcher <command> [options]
```

### Commands

- `start`: Start the watcher
- `stop`: Stop the watcher
- `status`: Check the status of the watcher
- `update`: Update the documentation
- `web`: Start the web dashboard
- `tray`: Start the system tray application

### Options

- `--config, -c`: Path to the configuration file
- `--verbose, -v`: Enable verbose logging
- `--help, -h`: Show help

## Web API

The web API for the MCP Config Watcher dashboard.

### Endpoints

#### GET /api/status

Get the status of the watcher.

- Response:
  ```json
  {
    "running": true,
    "uptime": 3600,
    "lastUpdate": "2025-03-15T16:58:42.000Z"
  }
  ```

#### POST /api/start

Start the watcher.

- Response:
  ```json
  {
    "success": true,
    "message": "Watcher started"
  }
  ```

#### POST /api/stop

Stop the watcher.

- Response:
  ```json
  {
    "success": true,
    "message": "Watcher stopped"
  }
  ```

#### POST /api/update

Update the documentation.

- Response:
  ```json
  {
    "success": true,
    "message": "Documentation updated"
  }
  ```

#### GET /api/logs

Get the logs of the watcher.

- Response:
  ```json
  {
    "logs": [
      {
        "timestamp": "2025-03-15T16:58:42.000Z",
        "level": "info",
        "message": "Watcher started"
      }
    ]
  }
  ```

#### GET /api/config

Get the configuration of the watcher.

- Response:
  ```json
  {
    "paths": {
      "settings": "/path/to/settings.json",
      "markdown": "/path/to/output.md"
    },
    "watcher": {
      "enabled": true,
      "pollInterval": 1000
    }
  }
  ```

#### PUT /api/config

Update the configuration of the watcher.

- Request:
  ```json
  {
    "paths": {
      "settings": "/path/to/settings.json",
      "markdown": "/path/to/output.md"
    },
    "watcher": {
      "enabled": true,
      "pollInterval": 1000
    }
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Configuration updated"
  }
  ```

## Configuration Schema

The schema for the configuration file.

```yaml
# Schema for config.yml
type: object
properties:
  paths:
    type: object
    properties:
      settings:
        type: string
        description: Path to the MCP settings file
      markdown:
        type: string
        description: Path to the output markdown file
    required:
      - settings
      - markdown
  watcher:
    type: object
    properties:
      enabled:
        type: boolean
        description: Enable or disable file watching
      pollInterval:
        type: number
        description: Poll interval in milliseconds
    required:
      - enabled
  ai:
    type: object
    properties:
      enabled:
        type: boolean
        description: Enable or disable AI-powered tool discovery
      openai:
        type: object
        properties:
          apiKey:
            type: string
            description: OpenAI API key
      cache:
        type: object
        properties:
          enabled:
            type: boolean
            description: Enable or disable caching
          maxAge:
            type: number
            description: Cache expiration in milliseconds
      fallback:
        type: object
        properties:
          enabled:
            type: boolean
            description: Generate fallback tool names if none are found
required:
  - paths
```

## Events

The events emitted by the MCP Config Watcher.

### MCPService Events

- `start`: Emitted when the service starts
- `stop`: Emitted when the service stops
- `fileChange`: Emitted when the settings file changes
- `updateStart`: Emitted when documentation update starts
- `updateEnd`: Emitted when documentation update completes
- `error`: Emitted when an error occurs

### MCPWatcher Events

- `start`: Emitted when the watcher starts
- `stop`: Emitted when the watcher stops
- `fileChange`: Emitted when the watched file changes
- `error`: Emitted when an error occurs

## Error Handling

The MCP Config Watcher throws the following errors:

- `ConfigError`: Configuration-related errors
- `FileError`: File-related errors
- `ParserError`: Parsing-related errors
- `GeneratorError`: Markdown generation errors
- `WatcherError`: Watcher-related errors
- `ServiceError`: Service-related errors
- `AIError`: AI-related errors

Example:

```javascript
import { ConfigError } from 'mcp-config-watcher';

try {
  // Code that might throw an error
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Environment Variables

The MCP Config Watcher uses the following environment variables:

- `MCP_CONFIG_PATH`: Path to the configuration file
- `MCP_SETTINGS_PATH`: Path to the MCP settings file
- `MCP_MARKDOWN_PATH`: Path to the output markdown file
- `OPENAI_API_KEY`: OpenAI API key for AI-powered tool discovery

Example:

```bash
export MCP_CONFIG_PATH=/path/to/config.yml
export OPENAI_API_KEY=your-api-key
mcp-watcher start
