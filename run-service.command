#!/bin/bash
# ---------------------------------------------------------------
# macOS .command Script to start MCP Config Watcher and UI
# ---------------------------------------------------------------

# 1. (Optional) Set environment variables
# export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"

# 2. Navigate to the project directory
cd /Users/samlyndon/repos/custom/mcp-config-watcher

# 3. Start the MCP watcher in the background
mcp-watcher start &

# 4. Also start the web interface in the background
npm run web &

# 5. Open the default browser to the UI
open "http://localhost:8080"

# 6. Keep the shell open so logs remain visible
exec $SHELL