@echo off
:: ------------------------------------------------------------------
:: Windows Batch Script to start MCP Config Watcher and open the UI
:: ------------------------------------------------------------------

:: 1. (Optional) Set environment variables as needed
:: Replace or remove if not needed:
:: set OPENAI_API_KEY=YOUR_OPENAI_API_KEY

:: 2. Navigate to the project directory (using the script's location)
cd /d "%~dp0"

:: 3. Start the watcher service (synchronously)
call node bin/mcp-watcher.js start

:: 4. Start the web interface in a new window (asynchronously)
start cmd /c "node src/interfaces/web/index.js"

:: 5. Wait a moment for the server to start
timeout /t 2 /nobreak > nul

:: 6. Open the default browser to the web interface
start http://localhost:8080

:: 7. Keep the window open (optional)
pause