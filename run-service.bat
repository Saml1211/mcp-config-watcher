@echo off
:: ------------------------------------------------------------------
:: Windows Batch Script to start MCP Config Watcher and open the UI
:: ------------------------------------------------------------------

:: 1. (Optional) Set environment variables as needed
:: Replace or remove if not needed:
:: set OPENAI_API_KEY=YOUR_OPENAI_API_KEY

:: 2. Navigate to the project directory
cd /Users/samlyndon/repos/custom/mcp-config-watcher

:: 3. Start the watcher service (synchronously)
call mcp-watcher start

:: 4. Start the web interface in a new window (asynchronously)
start cmd /c "npm run web"

:: 5. Open the default browser to the web interface
start http://localhost:8080

:: 6. Keep the window open (optional)
pause