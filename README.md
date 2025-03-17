# MCP Config Watcher

Automatically generate documentation for your MCP (Model Context Protocol) servers and tools by monitoring changes to your `cline_mcp_settings.json` file.

## Features

- 📋 **Automatic Documentation**: Monitors your MCP settings and generates up-to-date markdown documentation
- 🔄 **Real-time Updates**: Watches for changes and instantly updates documentation
- 🖥️ **Multiple Interfaces**: CLI, Web Dashboard, and System Tray access
- 🔧 **Highly Configurable**: Customize paths, update frequency, and more
- 💡 **Comprehensive Tool Descriptions**: Includes detailed descriptions for all MCP tools
- 🧠 **AI-Powered Tool Discovery**: Automatically identifies tools for new MCP servers
- 🔍 **Smart Server Matching**: Matches similar servers to provide accurate tool information

## Installation

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Quick Install

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-config-watcher.git
cd mcp-config-watcher

# Install dependencies
npm install

# Make the CLI executable 
chmod +x bin/mcp-watcher.js

# Link the CLI globally (optional)
npm link
```

## Configuration

The configuration file is located at `config.yml` in the project root. You can modify it to suit your needs:

```yaml
# File paths
paths:
  # Path to MCP settings JSON file
  settings: "/Users/yourname/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
  # Path to markdown documentation file
  markdown: "/path/to/your/mcp_servers_and_tools.md"

# Watcher settings
watcher:
  # How often to check for changes (milliseconds)
  pollInterval: 1000
  # Await write finish options
  awaitWriteFinish:
    stabilityThreshold: 2000
    pollInterval: 500

# Service settings
service:
  # Auto-start on application launch
  autoStart: true
  # Port for web interface
  port: 8080
  # Log levels: error, warn, info, verbose, debug, silly
  logLevel: "info"
  # Log file location (leave empty for console only)
  logFile: ""

# AI settings (optional)
ai:
  # Enable AI-powered tool discovery
  enabled: true
  # OpenAI configuration
  openai:
    # API key (or use OPENAI_API_KEY environment variable)
    apiKey: "${OPENAI_API_KEY}"
  # Cache settings
  cache:
    enabled: true
    maxAge: 86400000  # 24 hours in milliseconds
  # Fallback settings
  fallback:
    enabled: true     # Generate fallback tools if none found
```

## Usage

### Command Line Interface

```bash
# Start the watcher
mcp-watcher start

# Stop the watcher
mcp-watcher stop

# Check status
mcp-watcher status

# Force update documentation
mcp-watcher update

# View help
mcp-watcher --help
```

### Web Dashboard

Start the web server and access the dashboard:

```bash
npm run web
```

Then open your browser to http://localhost:8080

### Direct Usage in Code

You can also use MCP Config Watcher programmatically:

```javascript
import { initService } from 'mcp-config-watcher';

// Initialize and start the service
const service = await initService();

// Force an update
await service.forceUpdate();

// Stop the service
await service.stop();
```

## How It Works

1. The watcher monitors your MCP settings file for changes
2. When changes are detected, it parses the MCP server configurations
3. It identifies tools for each server using:
   - Known tool mappings
   - Auto-approved tools from settings
   - Similar server matching
   - AI-powered tool discovery (if enabled)
4. It generates a markdown file with comprehensive documentation of all servers and their tools
5. The documentation includes detailed descriptions of each tool's functionality and server configuration details

## AI Integration

MCP Config Watcher includes optional AI-powered tool discovery using OpenAI. This feature helps:

- Automatically identify tools for new or unknown MCP servers
- Generate descriptions for tools not in the static database
- Provide more accurate documentation for your MCP servers

### Enabling AI Integration

To enable AI integration, run the upgrade script:

```bash
# Make the script executable (if needed)
chmod +x bin/upgrade-ai.js

# Run the upgrade script
./bin/upgrade-ai.js
```

The script will:
1. Install the OpenAI package if needed
2. Help you configure your OpenAI API key
3. Update your config.yml file with AI settings

### AI Configuration

You can configure the AI integration in the `config.yml` file:

```yaml
ai:
  enabled: true                # Enable/disable AI features
  openai:
    apiKey: "${OPENAI_API_KEY}" # API key or environment variable
  cache:
    enabled: true              # Enable caching to reduce API calls
    maxAge: 86400000           # Cache lifetime in milliseconds (24h)
  fallback:
    enabled: true              # Generate fallback tools if none found
```

## Interfaces

### CLI Interface

The command-line interface provides quick access to all core functions through simple commands:
- `start` - Start the watcher service
- `stop` - Stop the watcher service
- `status` - Check the status of the service
- `update` - Force an update of the documentation
- `upgrade-ai` - Upgrade to use AI-powered tool discovery

### Web Dashboard

The web dashboard provides a visual interface with:
- Real-time status monitoring
- Log viewing
- Button controls for all functions
- Live updates via WebSockets

### System Tray (Coming Soon)

The system tray application will provide:
- Status indicator in your system tray
- Quick access to common actions
- Notifications for updates and errors

## License

MIT
