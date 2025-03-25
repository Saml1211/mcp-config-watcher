# MCP Tool Discovery

This document provides technical details about the MCP tool discovery mechanism implemented in MCP Config Watcher.

## Overview

MCP Config Watcher uses a sophisticated approach to discover tools available in MCP servers, ensuring maximum compatibility with different server implementations while adhering to the MCP standard protocol.

## Discovery Process

The tool discovery process follows these steps:

1. **Launch the MCP Server**: The server is started with specific environment variables that signal discovery mode.
2. **Send JSON-RPC Request**: A standard JSON-RPC 2.0 request is sent to the server asking for its tools.
3. **Parse Response**: The JSON-RPC response is parsed to extract tool information.
4. **Apply Fallback Methods**: If the standard approach fails, multiple parsing patterns are applied to extract tool data.
5. **Use Auto-Approved Tools**: If no tools are discovered, fall back to the auto-approved tools list from the server configuration.
6. **Use AI Prediction (Optional)**: If enabled and previous methods fail, use AI to predict tools based on the server identifier.

## Implementation Details

### Environment Variables

When launching an MCP server for tool discovery, the following environment variables are set:

```javascript
// Standard MCP discovery signals
processEnv.MCP_LIST_FUNCTIONS = 'true';
processEnv.MCP_DISCOVERY_MODE = 'true';
processEnv.MCP_REQUIRE_DESCRIPTIONS = 'true';

// Alternative naming conventions
processEnv.MCP_LIST_TOOLS = 'true';
processEnv.FUNCTIONS_DISCOVERY = 'true';
processEnv.NODE_ENV = 'discovery';
```

### JSON-RPC Protocol

The tool discovery uses the standard JSON-RPC 2.0 protocol to communicate with MCP servers. The request format is:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

The expected response from compliant MCP servers follows this format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "tool_name",
        "description": "Tool description",
        "inputSchema": {
          "type": "object",
          "properties": {...}
        }
      },
      ...
    ]
  }
}
```

### Multi-Pattern Parsing

To ensure compatibility with various MCP server implementations, the following parsing patterns are applied when the standard JSON-RPC approach fails:

1. **OpenAI Functions Format**:
   ```json
   {
     "functions": [
       { "name": "tool_name", "description": "Tool description", ... }
     ]
   }
   ```

2. **Tools Array Format**:
   ```json
   {
     "tools": [
       { "name": "tool_name", "description": "Tool description", ... }
     ]
   }
   ```

3. **Line-by-Line JSON Objects**:
   ```
   {"name": "tool_name", "description": "Tool description"}
   ```

4. **Function-Like Declarations**:
   Patterns like `"function": "tool_name"` or `"name": "tool_name"`

5. **Tool-Like Identifiers**:
   Identifying words that match the pattern `word_word` and appear to be tool names

### Timeout and Error Handling

- A configurable timeout (default: 10 seconds) limits how long we wait for server responses
- Servers that hang or don't respond are automatically terminated
- Any available output up to the termination point is parsed for tool information
- Error output (stderr) is checked for tool information if standard output yields no results

## Configuration

Tool discovery behavior can be configured in the `config.yml` file:

```yaml
discovery:
  # Enable or disable direct tool discovery
  enabled: true
  # Timeout for server queries (milliseconds)
  timeout: 10000
  # Cache discovery results to avoid repeated queries
  cache: true
```

## Testing

Several test scripts are available to test the tool discovery mechanism:

- `test-rpc-discovery.js`: Test JSON-RPC-based discovery on specific servers
- `test-discover-one.js`: Test all discovery methods on a single server
- `test-raw-output.js`: Capture raw server output for debugging

## Troubleshooting

If tool discovery isn't working as expected:

1. **Check Server Compatibility**: Ensure the MCP server implements the JSON-RPC protocol correctly
2. **Examine Server Output**: Use the `test-raw-output.js` script to capture and analyze the server's output
3. **Increase Timeout**: Some servers may take longer to initialize; try increasing the timeout value
4. **Fall Back to Auto-Approved Tools**: For incompatible servers, rely on the auto-approved tools list in your settings

## Future Enhancements

Planned improvements to the tool discovery mechanism:

1. **Connection Pooling**: Maintain persistent connections to frequently used servers
2. **Discovery Caching**: More sophisticated caching to reduce startup time
3. **Server Capabilities Detection**: Automatically detect which discovery method works best for each server
4. **Parallel Discovery**: Run tool discovery for multiple servers simultaneously 