#!/bin/bash
# ---------------------------------------------------------------
# macOS .command Script to start MCP Config Watcher and UI
# ---------------------------------------------------------------

# 1. (Optional) Set environment variables
# export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

# 2. Navigate to the project directory (using the script's location)
cd "$(dirname "$0")"

# 3. Start the MCP watcher in the background
node bin/mcp-watcher.js start &

# 4. Start the web interface in the background
node src/interfaces/web/index.js &

# 5. Open the default browser to the UI (wait a moment for server to start)
sleep 2
open "http://localhost:8080"

# 6. Keep the shell open so logs remain visible
exec $SHELL