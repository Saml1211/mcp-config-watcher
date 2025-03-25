# MCP Tool Discovery

This document describes the approach used by MCP Config Watcher to discover tools from MCP servers.

## Discovery Mechanism

MCP servers expose their available tools in different ways. Our discovery mechanism uses the following approaches in order of preference:

1. **JSON-RPC Method Call**: We send a standard JSON-RPC 2.0 request to the server with method `tools/list` and process the response. This is the recommended approach following the MCP standard protocol.

2. **OpenAI Function Format**: Many MCP servers use the OpenAI function format to declare their tools. We scan the server output for JSON objects with a `functions` array containing tool definitions.

3. **Alternative Formats**: For compatibility with non-standard servers, we also scan for:
   - Tools array format (similar to functions array)
   - Line-by-line JSON objects with name fields
   - Function-like declarations and name/value pairs
   - Tool-like identifiers (containing underscores)

## Implementation Details

The tool discovery works by:

1. Starting the MCP server with environment variables signaling discovery mode:
   - `MCP_LIST_FUNCTIONS=true`
   - `MCP_DISCOVERY_MODE=true`
   - `MCP_REQUIRE_DESCRIPTIONS=true`
   - `MCP_LIST_TOOLS=true`
   - `FUNCTIONS_DISCOVERY=true`
   - `NODE_ENV=discovery`

2. Sending a JSON-RPC 2.0 request to the server:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/list",
     "params": {}
   }
   ```

3. Parsing the response to extract tool names.

4. Applying fallback parsing methods if standard methods fail.

## Common Issues

- **Empty responses**: Some servers don't respond to discovery requests at all. In these cases, we fall back to auto-approved tools defined in the server configuration.

- **Non-standard formats**: Some servers use custom formats that don't strictly follow the MCP standard. Our multi-pattern approach helps handle these cases.

- **Timeouts**: Servers that hang during discovery are terminated after a timeout (default 10 seconds), and we attempt to parse any partial output.

## Testing

We've developed specialized testing tools:

- `test-rpc-discovery.js`: Test the RPC-based discovery on a specific server
- `test-discover-one.js`: Test all discovery methods on a single server
- `test-raw-output.js`: Capture raw server output for debugging

## Results

Our improved discovery mechanism successfully discovers tools from standard MCP servers, including:
- Puppeteer server (7 tools)
- Sequential Thinking server (1 tool)
- Web Research server (3 tools)
- And many others

For servers that don't respond to discovery, we safely fall back to the server's auto-approved tools list. 