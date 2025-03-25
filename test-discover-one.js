import { loadConfig } from './src/config/loader.js';
import MCPToolDiscovery from './src/core/mcp-tool-discovery.js';
import fs from 'fs-extra';
import path from 'path';

// Command line arguments
const args = process.argv.slice(2);
const serverId = args[0];

async function testSingleServerDiscovery() {
  try {
    // Load configuration
    const config = await loadConfig();
    
    // Override timeout to be longer for testing
    if (!config.discovery) {
      config.discovery = {};
    }
    config.discovery.timeout = 15000; // 15 seconds
    
    // Initialize tool discovery
    const discovery = new MCPToolDiscovery(config);
    
    // Set up event handlers with detailed debug output
    discovery.on('info', (message) => console.log(`[INFO] ${message}`));
    discovery.on('error', (message) => console.error(`[ERROR] ${message}`));
    discovery.on('warning', (message) => console.warn(`[WARNING] ${message}`));
    discovery.on('debug', (message) => console.log(`[DEBUG] ${message}`));
    
    // Read MCP settings file
    const settingsPath = config.paths.settings;
    console.log(`Reading settings from: ${settingsPath}`);
    
    if (!await fs.pathExists(settingsPath)) {
      console.error(`Settings file not found at ${settingsPath}`);
      process.exit(1);
    }
    
    const fileContent = await fs.readFile(settingsPath, 'utf8');
    let mcpSettings;
    
    try {
      mcpSettings = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Failed to parse settings file: ${error.message}`);
      process.exit(1);
    }
    
    if (!mcpSettings.mcpServers) {
      console.error(`Invalid settings file: missing mcpServers object`);
      process.exit(1);
    }
    
    // If no server ID was provided, list available servers
    if (!serverId) {
      console.log(`\nAvailable MCP servers:`);
      Object.entries(mcpSettings.mcpServers).forEach(([id, config], index) => {
        const status = config.disabled ? 'DISABLED' : 'ENABLED';
        console.log(`${index+1}. ${id} [${status}]`);
        console.log(`   Command: ${config.command} ${config.args ? config.args.join(' ') : ''}`);
        console.log(`   Auto-approved tools: ${config.autoApprove ? config.autoApprove.join(', ') : 'none'}`);
      });
      console.log(`\nRun again with a server ID to test discovery.`);
      console.log(`Example: node test-discover-one.js "github.com/some/server"`);
      process.exit(0);
    }
    
    // Check if the server exists
    if (!mcpSettings.mcpServers[serverId]) {
      console.error(`Server "${serverId}" not found in settings file.`);
      process.exit(1);
    }
    
    const serverConfig = mcpSettings.mcpServers[serverId];
    
    // Skip if disabled
    if (serverConfig.disabled) {
      console.log(`\nServer "${serverId}" is disabled. Skipping.`);
      process.exit(0);
    }
    
    console.log(`\nTesting discovery for server: ${serverId}`);
    console.log(`Command: ${serverConfig.command}`);
    console.log(`Args: ${serverConfig.args ? serverConfig.args.join(' ') : 'none'}`);
    console.log(`Environment Variables: ${JSON.stringify(serverConfig.env || {})}`);
    console.log(`Auto-approved tools: ${serverConfig.autoApprove ? serverConfig.autoApprove.join(', ') : 'none'}`);
    
    try {
      console.log(`\nDiscovering tools...`);
      console.time(`Discovery time`);
      const tools = await discovery.discoverTools(serverId, serverConfig);
      console.timeEnd(`Discovery time`);
      
      console.log(`\nDiscovered ${tools.length} tools:`);
      if (tools.length > 0) {
        tools.forEach((tool, i) => console.log(`  ${i+1}. ${tool}`));
      } else {
        console.log('  No tools discovered.');
      }
    } catch (error) {
      console.error(`Failed to discover tools: ${error.message}`);
    }
  } catch (error) {
    console.error('Test failed:', error);
    console.error(error.stack);
  }
}

testSingleServerDiscovery().catch(error => {
  console.error('Unhandled error:', error);
  console.error(error.stack);
}); 