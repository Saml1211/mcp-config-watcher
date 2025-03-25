import { loadConfig } from './src/config/loader.js';
import MCPToolDiscovery from './src/core/mcp-tool-discovery.js';
import fs from 'fs-extra';

async function testToolDiscovery() {
  try {
    // Load configuration
    const config = await loadConfig();
    
    // Override timeout to be shorter for testing
    if (!config.discovery) {
      config.discovery = {};
    }
    config.discovery.timeout = 8000; // 8 seconds
    
    // Initialize tool discovery
    const discovery = new MCPToolDiscovery(config);
    
    // Set up event handlers
    discovery.on('info', (message) => console.log(`[INFO] ${message}`));
    discovery.on('error', (message) => console.error(`[ERROR] ${message}`));
    discovery.on('warning', (message) => console.warn(`[WARNING] ${message}`));
    discovery.on('debug', (message) => console.log(`[DEBUG] ${message}`));
    
    // Read MCP settings file
    const settingsPath = config.paths.settings;
    console.log(`Reading settings from: ${settingsPath}`);
    
    const fileContent = await fs.readFile(settingsPath, 'utf8');
    const mcpSettings = JSON.parse(fileContent);
    
    const serverCount = Object.keys(mcpSettings.mcpServers).length;
    console.log(`\nFound ${serverCount} MCP servers in settings file.`);
    console.log('Testing direct tool discovery for all configured MCP servers:');
    
    // Discover tools for each server
    let index = 1;
    for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
      console.log(`\n--- Server ${index}/${serverCount} ---`);
      if (serverConfig.disabled) {
        console.log(`\nSkipping disabled server: ${serverId}`);
        index++;
        continue;
      }
      
      console.log(`\nServer ID: ${serverId}`);
      console.log(`Command: ${serverConfig.command}`);
      console.log(`Args: ${serverConfig.args ? serverConfig.args.join(' ') : 'none'}`);
      console.log(`Environment Variables: ${JSON.stringify(serverConfig.env || {})}`);
      console.log(`Auto-approved tools: ${serverConfig.autoApprove ? serverConfig.autoApprove.join(', ') : 'none'}`);
      
      try {
        console.log(`\nDiscovering tools...`);
        console.time(`Server ${index} discovery time`);
        const tools = await discovery.discoverTools(serverId, serverConfig);
        console.timeEnd(`Server ${index} discovery time`);
        
        console.log(`\nDiscovered ${tools.length} tools:`);
        if (tools.length > 0) {
          tools.forEach((tool, i) => console.log(`  ${i+1}. ${tool}`));
        } else {
          console.log('  No tools discovered. Will fall back to auto-approved tools or AI prediction.');
        }
      } catch (error) {
        console.error(`Failed to discover tools: ${error.message}`);
      }
      
      index++;
    }
    
    console.log('\nTool discovery test completed');
  } catch (error) {
    console.error('Test failed:', error);
    console.error(error.stack);
  }
}

testToolDiscovery().catch(error => {
  console.error('Unhandled error:', error);
  console.error(error.stack);
}); 