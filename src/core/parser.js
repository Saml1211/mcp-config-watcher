import fs from 'fs-extra';
import path from 'path';
import AIHelper from './ai-helper.js';
import MCPToolDiscovery from './mcp-tool-discovery.js';
import { EventEmitter } from 'events';

/**
 * MCP Settings parser class
 * Parses MCP settings JSON and extracts server and tool information
 */
export class MCPSettingsParser extends EventEmitter {
  /**
   * Create a new parser instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super();
    this.config = config;
    this.toolDescriptions = {};
    
    // Initialize AI helper if enabled
    if (config.ai?.enabled) {
      this.aiHelper = new AIHelper(config);
      
      // Forward AI helper events
      this.aiHelper.on('info', (message) => this.emit('info', message));
      this.aiHelper.on('error', (message) => this.emit('error', message));
      this.aiHelper.on('warning', (message) => this.emit('warning', message));
      this.aiHelper.on('debug', (message) => this.emit('debug', message));
    } else {
      this.aiHelper = null;
    }
    
    // Initialize direct tool discovery
    this.toolDiscovery = new MCPToolDiscovery(config);
    
    // Forward tool discovery events
    this.toolDiscovery.on('info', (message) => this.emit('info', message));
    this.toolDiscovery.on('error', (message) => this.emit('error', message));
    this.toolDiscovery.on('warning', (message) => this.emit('warning', message));
    this.toolDiscovery.on('debug', (message) => this.emit('debug', message));
    
    this.loadToolDescriptions();
  }
  
  /**
   * Load tool descriptions from JSON file
   * @private
   */
  async loadToolDescriptions() {
    try {
      const descriptionsPath = path.join(process.cwd(), 'src/data/tool-descriptions.json');
      if (await fs.pathExists(descriptionsPath)) {
        const data = await fs.readFile(descriptionsPath, 'utf8');
        this.toolDescriptions = JSON.parse(data);
      } else {
        console.warn('Tool descriptions file not found. Using empty descriptions.');
      }
    } catch (error) {
      console.error(`Failed to load tool descriptions: ${error.message}`);
      // Initialize with empty object in case of failure
      this.toolDescriptions = {};
    }
  }

  /**
   * Parse MCP settings file
   * @param {string} filePath - Path to MCP settings file
   * @returns {Promise<Object>} Parsed data
   */
  async parse(filePath) {
    try {
      // Validate file path
      if (!await fs.pathExists(filePath)) {
        throw new Error(`MCP settings file not found at ${filePath}`);
      }

      const fileContent = await fs.readFile(filePath, 'utf8');
      let mcpSettings;
      
      try {
        mcpSettings = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON in MCP settings file: ${parseError.message}`);
      }
      
      if (!mcpSettings.mcpServers) {
        throw new Error('Invalid MCP settings format: missing mcpServers object');
      }
      
      return this.extractServerInfo(mcpSettings);
    } catch (error) {
      throw new Error(`Failed to parse MCP settings: ${error.message}`);
    }
  }

  /**
   * Extract server and tool information from MCP settings
   * @param {Object} mcpSettings - Parsed MCP settings object
   * @returns {Object} Extracted server and tool information
   * @private
   */
  extractServerInfo(mcpSettings) {
    const servers = {};
    
    // Extract server information
    for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
      // Skip disabled servers
      if (serverConfig.disabled === true) {
        continue;
      }
      
      servers[serverId] = {
        id: serverId,
        command: serverConfig.command,
        args: serverConfig.args || [],
        autoApprove: serverConfig.autoApprove || [],
        env: serverConfig.env || {},
        disabled: serverConfig.disabled || false,
        // Use autoApprove array as initial tools list
        tools: Array.isArray(serverConfig.autoApprove) ? [...serverConfig.autoApprove] : []
      };
    }
    
    return { servers };
  }

  /**
   * Discover tools for a server using direct server querying
   * @param {string} serverId - Server ID
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<Array>} Array of tool names
   */
  async discoverToolsForServer(serverId, serverConfig) {
    let tools = [];
    
    // Priority 1: Use autoApprove array from server config
    if (serverConfig && Array.isArray(serverConfig.autoApprove) && serverConfig.autoApprove.length > 0) {
      tools.push(...serverConfig.autoApprove);
      this.emit('debug', `Using ${serverConfig.autoApprove.length} auto-approved tools for ${serverId}`);
    }
    
    // Priority 2: Use direct tool discovery (if enabled)
    if (this.config.discovery?.enabled !== false) {
      try {
        this.emit('debug', `Attempting direct tool discovery for ${serverId}`);
        const discoveredTools = await this.toolDiscovery.discoverTools(serverId, serverConfig);
        
        // Add discovered tools
        if (discoveredTools.length > 0) {
          this.emit('debug', `Found ${discoveredTools.length} tools via direct discovery for ${serverId}`);
          for (const tool of discoveredTools) {
            if (!tools.includes(tool)) {
              tools.push(tool);
            }
          }
        } else {
          this.emit('debug', `No tools found via direct discovery for ${serverId}`);
        }
      } catch (error) {
        this.emit('error', `Error discovering tools directly: ${error.message}`);
      }
    }
    
    // Priority 3: If direct discovery didn't find any new tools and AI is enabled, use AI prediction
    if ((tools.length === 0 || tools.length === serverConfig.autoApprove?.length) && 
        this.aiHelper && this.config.ai?.fallbackToAi) {
      try {
        this.emit('debug', `Attempting AI-based tool prediction for ${serverId}`);
        const aiTools = await this.aiHelper.predictToolsForServer(serverId);
        
        if (aiTools.length > 0) {
          this.emit('debug', `Found ${aiTools.length} tools via AI prediction for ${serverId}`);
          for (const tool of aiTools) {
            if (!tools.includes(tool)) {
              tools.push(tool);
            }
          }
        } else {
          this.emit('debug', `No tools found via AI prediction for ${serverId}`);
        }
      } catch (error) {
        this.emit('error', `Error predicting tools with AI: ${error.message}`);
      }
    }
    
    // If we still don't have any tools, generate a default tool name based on server ID
    if (tools.length === 0) {
      // Extract a reasonable name from the serverId
      const serverName = path.basename(serverId).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      const defaultTool = `${serverName}_tool`;
      
      this.emit('debug', `No tools found for ${serverId}, using default tool: ${defaultTool}`);
      tools.push(defaultTool);
    }
    
    // Sort tools alphabetically for consistent output
    tools.sort();
    
    // Ensure unique tools
    return [...new Set(tools)];
  }
  
  /**
   * Extract server and tool information from MCP settings with direct tool discovery
   * @param {Object} mcpSettings - Parsed MCP settings object
   * @returns {Promise<Object>} Extracted server and tool information
   */
  async extractServerInfoWithDiscovery(mcpSettings) {
    const servers = {};
    
    // Extract server information
    for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
      // Skip disabled servers
      if (serverConfig.disabled === true) {
        continue;
      }
      
      // Discover tools with direct discovery
      const tools = await this.discoverToolsForServer(serverId, serverConfig);
      
      servers[serverId] = {
        id: serverId,
        command: serverConfig.command,
        args: serverConfig.args || [],
        autoApprove: serverConfig.autoApprove || [],
        env: serverConfig.env || {},
        disabled: serverConfig.disabled || false,
        tools: tools
      };
    }
    
    return { servers };
  }

  /**
   * Get description for a tool
   * @param {string} toolName - Tool name
   * @param {string} [serverId] - Optional server ID for context
   * @returns {Promise<string>} Tool description
   */
  async getToolDescription(toolName, serverId = null) {
    // First check our static descriptions
    const staticDescription = this.toolDescriptions[toolName];
    if (staticDescription) {
      return staticDescription;
    }
    
    // If AI is enabled and no static description, use AI
    if (this.aiHelper && serverId) {
      try {
        return await this.aiHelper.generateToolDescription(toolName, serverId);
      } catch (error) {
        console.error(`Error generating description with AI: ${error.message}`);
      }
    }
    
    return 'No description available.';
  }
  
  /**
   * Get description for a tool (synchronous version)
   * @param {string} toolName - Tool name
   * @returns {string} Tool description
   */
  getToolDescription(toolName) {
    return this.toolDescriptions[toolName] || 'No description available.';
  }
  
  /**
   * Extract server and tool information from MCP settings with AI assistance
   * @param {Object} mcpSettings - Parsed MCP settings object
   * @returns {Promise<Object>} Extracted server and tool information
   */
  async extractServerInfoWithAI(mcpSettings) {
    const servers = {};
    
    // Extract server information
    for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
      // Skip disabled servers
      if (serverConfig.disabled === true) {
        continue;
      }
      
      // Discover tools with potential AI assistance
      const tools = await this.discoverToolsForServer(serverId, serverConfig);
      
      servers[serverId] = {
        id: serverId,
        command: serverConfig.command,
        args: serverConfig.args || [],
        autoApprove: serverConfig.autoApprove || [],
        env: serverConfig.env || {},
        disabled: serverConfig.disabled || false,
        tools: tools
      };
    }
    
    return { servers };
  }
}

export default MCPSettingsParser;

