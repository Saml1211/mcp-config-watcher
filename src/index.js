#!/usr/bin/env node
import { loadConfig } from './config/loader.js';
import MCPWatcherService from './core/service.js';

let service = null;

/**
 * Initialize the MCP Config Watcher service
 * @returns {Promise<MCPWatcherService>} Service instance
 */
export async function initService() {
  try {
    // Load configuration
    const config = await loadConfig();
    
    // Create service
    service = new MCPWatcherService(config);
    
    // Set up event handlers
    setupEventHandlers(service);
    
    // Start service
    await service.start();
    
    return service;
  } catch (error) {
    console.error('Failed to initialize service:', error);
    process.exit(1);
  }
}

/**
 * Set up event handlers for the service
 * @param {MCPWatcherService} service - Service instance
 */
function setupEventHandlers(service) {
  service.on('info', (message) => console.log(`[INFO] ${message}`));
  service.on('error', (message) => console.error(`[ERROR] ${message}`));
  service.on('warning', (message) => console.warn(`[WARNING] ${message}`));
  service.on('started', (message) => console.log(`[STARTED] ${message}`));
  service.on('stopped', (message) => console.log(`[STOPPED] ${message}`));
  service.on('updated', (data) => {
    console.log(`[UPDATED] Generated markdown documentation`);
    console.log(`  - Settings: ${data.settingsPath}`);
    console.log(`  - Markdown: ${data.markdownPath}`);
    console.log(`  - Time: ${data.timestamp.toLocaleString()}`);
  });
  
  // Handle shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    if (service) {
      await service.stop();
    }
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// If this is the main script being run, initialize the service
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting MCP Config Watcher...');
  await initService();
  console.log('Service started. Press Ctrl+C to stop.');
}

export default { initService };
