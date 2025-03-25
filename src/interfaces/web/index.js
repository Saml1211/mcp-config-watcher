import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { loadConfig } from '../../config/loader.js';
import MCPWatcherService from '../../core/service.js';

// Setup paths for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

let service = null;
let config = null;
const logs = [];

/**
 * Initialize the web server
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Load configuration
    config = await loadConfig();
    
    // Create service
    service = new MCPWatcherService(config);
    
    // Setup middleware
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Setup routes
    setupRoutes();
    
    // Setup Socket.IO
    setupSocketIO();
    
    // Setup event handlers
    setupEventHandlers();
    
    // Start service if auto-start is enabled
    if (config.service.autoStart) {
      await service.start();
    }
    
    // Start server
    const port = config.service.port || 8080;
    server.listen(port, () => {
      console.log(`Web server started at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize web server:', error);
    process.exit(1);
  }
}

/**
 * Setup Express routes
 */
function setupRoutes() {
  // Root route - serves the dashboard
  app.get('/', async (req, res) => {
    const html = await generateHtml();
    res.send(html);
  });
  
  // API routes
  app.get('/api/status', (req, res) => {
    const status = service.getStatus();
    res.json({
      status,
      config: {
        settingsPath: config.paths.settings,
        markdownPath: config.paths.markdown,
        autoStart: config.service.autoStart
      },
      logs: logs.slice(-50) // Last 50 logs
    });
  });
  
  app.post('/api/start', async (req, res) => {
    try {
      if (service.watcher.running) {
        return res.json({ success: false, message: 'Service is already running' });
      }
      
      await service.start();
      res.json({ success: true, message: 'Service started successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  app.post('/api/stop', async (req, res) => {
    try {
      if (!service.watcher.running) {
        return res.json({ success: false, message: 'Service is not running' });
      }
      
      await service.stop();
      res.json({ success: true, message: 'Service stopped successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  app.post('/api/update', async (req, res) => {
    try {
      await service.forceUpdate();
      res.json({ success: true, message: 'Update triggered successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  app.post('/api/clear-logs', (req, res) => {
    logs.length = 0;
    res.json({ success: true, message: 'Logs cleared' });
    io.emit('logs-cleared');
  });
  
  // Configuration update endpoint
  app.post('/api/config/update', async (req, res) => {
    try {
      const { settingsPath, markdownPath } = req.body;
      
      // Validate paths
      await service.updateConfig({ settingsPath, markdownPath });
      res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });
}

/**
 * Setup Socket.IO for real-time updates
 */
function setupSocketIO() {
  io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send initial logs and status
    socket.emit('init', {
      logs: logs.slice(-50),
      status: service.getStatus()
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
    
    // Handle commands from client
    socket.on('start', async () => {
      try {
        await service.start();
        socket.emit('status', service.getStatus());
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('stop', async () => {
      try {
        await service.stop();
        socket.emit('status', service.getStatus());
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('update', async () => {
      try {
        await service.forceUpdate();
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  });
}

/**
 * Setup event handlers for the service
 */
function setupEventHandlers() {
  // Log event handler
  const logEvent = (type, message) => {
    const logEntry = {
      type,
      message,
      timestamp: new Date()
    };
    
    logs.push(logEntry);
    
    // Keep logs limited to last 500 entries
    if (logs.length > 500) {
      logs.shift();
    }
    
    // Emit log to connected clients
    io.emit('log', logEntry);
  };
  
  // Set up service event handlers
  service.on('info', (message) => logEvent('info', message));
  service.on('error', (message) => logEvent('error', message));
  service.on('warning', (message) => logEvent('warning', message));
  service.on('started', (message) => {
    logEvent('success', message);
    io.emit('status', service.getStatus());
  });
  service.on('config-updated', (data) => {
    logEvent('info', `Configuration updated: Settings=${data.settingsPath}, Markdown=${data.markdownPath}`);
    io.emit('config-updated', data);
  });
  service.on('stopped', (message) => {
    logEvent('info', message);
    io.emit('status', service.getStatus());
  });
  service.on('updated', (data) => {
    logEvent('success', `Generated markdown documentation at ${data.markdownPath}`);
    io.emit('updated', data);
  });
}

/**
 * Generate HTML for the dashboard
 * @returns {Promise<string>} HTML content
 */
async function generateHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Config Watcher</title>
  <style>
    /* Light mode (default) variables */
    :root {
      --primary-color: #4a6fa5;
      --secondary-color: #5d93d1;
      --success-color: #28a745;
      --danger-color: #dc3545;
      --warning-color: #ffc107;
      --info-color: #17a2b8;
      --dark-color: #343a40;
      --light-color: #f8f9fa;
      --text-color: #343a40;
      --background-color: #f5f7fa;
      --card-bg: #ffffff;
      --border-color: #eee;
      --code-bg: #f5f5f5;
      --code-color: #333;
    }

    /* Dark mode variables */
    [data-theme="dark"] {
      --primary-color: #6f9fdb;
      --secondary-color: #8ab4f2;
      --dark-color: #e0e0e0;
      --light-color: #3a3a3a;
      --text-color: #e0e0e0;
      --background-color: #1a1a1a;
      --card-bg: #2d2d2d;
      --border-color: #444;
      --code-bg: #444;
      --code-color: #f0f0f0;
    }
    
    /* Base styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--background-color);
      margin: 0;
      padding: 20px;
    }
    
    /* Ensure all text elements use the theme text color */
    p, li, ul, ol, span, div, strong, em, label, h1, h2, h3, h4, h5, h6 {
      color: var(--text-color);
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .title {
      font-size: 24px;
      font-weight: bold;
      color: var(--primary-color);
    }
    
    .dashboard {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
      align-items: start;
    }
    
    .left-column {
      height: 100%;
      position: sticky;
      top: 20px;
    }
    
    .right-column {
      display: flex;
      flex-direction: column;
    }
    
    .left-column .card {
      height: calc(100vh - 140px);
      display: flex;
      flex-direction: column;
    }
    
    .left-column .card .card-title {
      flex-shrink: 0;
    }
    
    .card {
      background-color: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .card-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      color: var(--text-color);
    }
    
    /* Ensure all text in cards is visible */
    .card p, .card li, .card ul, .card ol, .card span, .card div, .card strong {
      color: var(--text-color);
    }
    
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 10px;
    }
    
    .status-indicator.running {
      background-color: var(--success-color);
    }
    
    .status-indicator.stopped {
      background-color: var(--danger-color);
    }
    
    .status-details {
      margin-top: 15px;
    }
    
    .status-details p {
      margin: 5px 0;
      color: var(--text-color);
    }
    
    .status-details strong {
      color: var(--text-color);
    }
    
    .status-details span {
      color: var(--text-color);
    }
    
    #status-text {
      color: var(--text-color);
    }
    
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    button {
      cursor: pointer;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      transition: background-color 0.2s;
    }
    
    button.primary {
      background-color: var(--primary-color);
      color: white;
    }
    
    button.primary:hover {
      background-color: var(--secondary-color);
    }
    
    button.success {
      background-color: var(--success-color);
      color: white;
    }
    
    button.success:hover {
      background-color: #218838;
    }
    
    button.danger {
      background-color: var(--danger-color);
      color: white;
    }
    
    button.danger:hover {
      background-color: #c82333;
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .log-actions {
      margin-top: 10px;
      text-align: right;
      flex-shrink: 0;
    }
    
    .logs {
      flex-grow: 1;
      overflow-y: auto;
      background-color: var(--light-color);
      color: var(--text-color);
      padding: 10px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 14px;
      margin-bottom: 0;
    }
    
    .log-entry {
      margin: 5px 0;
      padding: 5px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .log-entry .timestamp {
      color: var(--secondary-color);
      margin-right: 10px;
    }
    
    .log-entry .message {
      color: var(--text-color);
    }
    
    .log-entry .type {
      padding: 2px 5px;
      border-radius: 3px;
      margin-right: 5px;
      font-size: 12px;
    }
    
    .log-entry .info {
      background-color: var(--info-color);
      color: white;
    }
    
    .log-entry .error {
      background-color: var(--danger-color);
      color: white;
    }
    
    .log-entry .warning {
      background-color: var(--warning-color);
      color: #333;
    }
    
    .log-entry .success {
      background-color: var(--success-color);
      color: white;
    }
    
    code {
      background-color: var(--code-bg);
      color: var(--code-color);
      padding: 2px 5px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
    }
    
    .invalid-feedback {
      color: var(--danger-color);
      margin-top: 5px;
      font-size: 14px;
    }
    
    #connection-status {
      color: var(--text-color);
    }
    
    /* Form styles */
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      color: var(--text-color);
      display: block;
      margin-bottom: 5px;
    }
    
    .form-control {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-top: 5px;
      background-color: var(--card-bg);
      color: var(--text-color);
    }
    
    .feedback {
      display: none;
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      font-weight: bold;
      transition: all 0.3s ease;
    }
    
    .feedback.success {
      background: var(--success-color);
      color: white;
    }
    
    .feedback.error {
      background: var(--danger-color);
      color: white;
    }
    
    /* Information section specific styles */
    .information p,
    .information li,
    .information code {
      color: var(--text-color);
    }
    
    @media (max-width: 768px) {
      .dashboard {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">MCP Config Watcher</div>
      <div style="display: flex; align-items: center;">
        <button id="theme-toggle" class="primary" style="margin-right: 10px; display: inline-block; visibility: visible;">
          🌓 Toggle Theme
        </button>
        <div id="connection-status">Connecting...</div>
      </div>
    </div>
    
    <div class="dashboard">
      <div class="left-column">
        <div class="card">
          <div class="card-title">Logs</div>
          <div id="logs" class="logs"></div>
          <div class="log-actions">
            <button id="clear-logs" class="danger">Clear Logs</button>
          </div>
        </div>
      </div>
      
      <div class="right-column">
        <div class="card">
          <div class="card-title">Status</div>
          <div id="status-indicator" class="status-indicator stopped"></div>
          <span id="status-text">Stopped</span>
          
          <div class="status-details">
            <p><strong>Settings File:</strong> <span id="settings-path"></span></p>
            <p><strong>Markdown File:</strong> <span id="markdown-path"></span></p>
            <p><strong>Last Update:</strong> <span id="last-update">Never</span></p>
          </div>
          
          <div class="button-group">
            <button id="start-button" class="success">Start Watcher</button>
            <button id="stop-button" class="danger" disabled>Stop Watcher</button>
            <button id="update-button" class="primary">Force Update</button>
          </div>
        </div>
        
        <div class="card">
          <div class="card-title">Configuration</div>
          <form id="config-form">
            <div class="form-group">
              <label for="settings-path-input">Settings File Path:</label>
              <input type="text" id="settings-path-input" 
                     class="form-control" 
                     required
                     pattern=".*\.json$">
              <div class="invalid-feedback">Valid JSON file path required</div>
            </div>
            
            <div class="form-group">
              <label for="markdown-path-input">Markdown Output Path:</label>
              <input type="text" id="markdown-path-input" 
                     class="form-control" 
                     required
                     pattern=".*\.md$">
              <div class="invalid-feedback">Valid Markdown file path required</div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="primary">
                Update Configuration
              </button>
              <div id="config-feedback" class="feedback" style="display: none;"></div>
            </div>
          </form>
        </div>

        <div class="card information">
          <div class="card-title">Information</div>
          <p>This dashboard allows you to control the MCP Config Watcher service that monitors your MCP settings file and automatically updates the markdown documentation.</p>
          <p><strong>CLI Commands:</strong></p>
          <ul>
            <li><code>mcp-watcher start</code> - Start the watcher</li>
            <li><code>mcp-watcher stop</code> - Stop the watcher</li>
            <li><code>mcp-watcher status</code> - Check status</li>
            <li><code>mcp-watcher update</code> - Force update</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script>
    // Connect to Socket.IO server
    const socket = io();
    let isRunning = false;
    
    // DOM elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const settingsPath = document.getElementById('settings-path');
    const markdownPath = document.getElementById('markdown-path');
    const lastUpdate = document.getElementById('last-update');
    const startButton = document.getElementById('start-button');
    const configForm = document.getElementById('config-form');
    const stopButton = document.getElementById('stop-button');
    const updateButton = document.getElementById('update-button');
    const connectionStatus = document.getElementById('connection-status');
    const logsContainer = document.getElementById('logs');
    const clearLogsButton = document.getElementById('clear-logs');
    
    // Connection status
    socket.on('connect', () => {
      connectionStatus.textContent = 'Connected';
      connectionStatus.style.color = 'var(--success-color)';
    });
    
    socket.on('disconnect', () => {
      connectionStatus.textContent = 'Disconnected';
      connectionStatus.style.color = 'var(--danger-color)';
    });
    
    // Initial data
    socket.on('init', (data) => {
      updateStatus(data.status);
      
      // Add logs
      logsContainer.innerHTML = '';
      data.logs.forEach(log => addLogEntry(log));
      scrollLogsToBottom();
    });
    
    // Status updates
    socket.on('status', (status) => {
      updateStatus(status);
    });
    
    // Log events
    socket.on('log', (log) => {
      addLogEntry(log);
      scrollLogsToBottom();
    });
    
    socket.on('logs-cleared', () => {
      logsContainer.innerHTML = '';
    });
    
    // Update event
    socket.on('updated', (data) => {
      lastUpdate.textContent = new Date(data.timestamp).toLocaleString();
    });
    
    // Config update event
    socket.on('config-updated', (data) => {
      settingsPath.textContent = data.settingsPath;
      markdownPath.textContent = data.markdownPath;
      document.getElementById('config-feedback').style.display = 'none';
    });
    
    // Error event
    socket.on('error', (error) => {
      showError(error.message);
    });
    
    // Button actions
    startButton.addEventListener('click', () => {
      socket.emit('start');
    });
    
    stopButton.addEventListener('click', () => {
      socket.emit('stop');
    });
    
    updateButton.addEventListener('click', () => {
      socket.emit('update');
    });
    
    clearLogsButton.addEventListener('click', () => {
      fetch('/api/clear-logs', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            logsContainer.innerHTML = '';
          }
        });
    });
    
    // Config form handling
    configForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Validate form inputs
      const settingsPathInput = document.getElementById('settings-path-input');
      const markdownPathInput = document.getElementById('markdown-path-input');
      
      if (!settingsPathInput.value.endsWith('.json')) {
        showFeedback('Settings path must be a JSON file', false);
        return;
      }
      
      if (!markdownPathInput.value.endsWith('.md')) {
        showFeedback('Markdown path must be a Markdown file', false);
        return;
      }
      
      const config = {
        settingsPath: document.getElementById('settings-path-input').value,
        markdownPath: document.getElementById('markdown-path-input').value
      };

      fetch('/api/config/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      .then(response => response.json())
      .then(data => {
        showFeedback(data.message, data.success);
        
        if (data.success) {
          // Update displayed paths
          settingsPath.textContent = config.settingsPath;
          markdownPath.textContent = config.markdownPath;
        }
      });
      
      function showFeedback(message, isSuccess) {
        const feedback = document.getElementById('config-feedback');
        feedback.textContent = message;
        feedback.className = 'feedback ' + (isSuccess ? 'success' : 'error');
        feedback.style.display = 'block';
        
        // Hide feedback after 5 seconds
        setTimeout(() => {
          feedback.style.display = 'none';
        }, 5000);
      }
    });

    // Fetch initial status
    fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        updateStatus(data.status);
        settingsPath.textContent = data.config.settingsPath;
        
        // Set form input values
        document.getElementById('settings-path-input').value = data.config.settingsPath;
        
        markdownPath.textContent = data.config.markdownPath;
        document.getElementById('markdown-path-input').value = data.config.markdownPath;
        
        // Add logs
        logsContainer.innerHTML = '';
        data.logs.forEach(log => addLogEntry(log));
        scrollLogsToBottom();
      })
      .catch(error => {
        showError('Failed to fetch status: ' + error.message);
      });

    // Theme management
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }

    function initializeTheme() {
      const savedTheme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      applyTheme(savedTheme);
    }

    // Helper functions
    function updateStatus(status) {
      isRunning = status.running;

      if (isRunning) {
        statusIndicator.className = 'status-indicator running';
        statusText.textContent = 'Running';
        startButton.disabled = true;
        stopButton.disabled = false;
      } else {
        statusIndicator.className = 'status-indicator stopped';
        statusText.textContent = 'Stopped';
        startButton.disabled = false;
        stopButton.disabled = true;
      }

      if (status.lastUpdate) {
        lastUpdate.textContent = new Date(status.lastUpdate).toLocaleString();
      }
    }

    function addLogEntry(log) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';

      const timestamp = document.createElement('span');
      timestamp.className = 'timestamp';
      timestamp.textContent = new Date(log.timestamp).toLocaleTimeString();

      const type = document.createElement('span');
      type.className = 'type ' + log.type;
      type.textContent = log.type.toUpperCase();

      const message = document.createElement('span');
      message.className = 'message';
      message.textContent = log.message;

      entry.appendChild(timestamp);
      entry.appendChild(type);
      entry.appendChild(document.createTextNode(' '));
      entry.appendChild(message);

      logsContainer.appendChild(entry);
    }

    function scrollLogsToBottom() {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    function showError(message) {
      console.error(message);
      // You could implement a more user-friendly error notification here
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    });

    // Initialize theme
    initializeTheme();
  </script>
</body>
</html>
  `;
}

// If this is the main script being run, initialize the server
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting MCP Config Watcher Web Interface...');
  init();
}

export default { init };
