import fs from 'fs-extra';
import path from 'path';
import AIHelper from './ai-helper.js';

/**
 * MCP Settings parser class
 * Parses MCP settings JSON and extracts server and tool information
 */
export class MCPSettingsParser {
  /**
   * Create a new parser instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    this.config = config;
    this.toolDescriptions = {};
    
    // Initialize AI helper if enabled
    if (config.ai?.enabled) {
      this.aiHelper = new AIHelper(config);
    } else {
      this.aiHelper = null;
    }
    
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
    const serverToolsMap = this.buildServerToolsMap();
    
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
        tools: this.getToolsForServer(serverId, serverToolsMap, serverConfig)
      };
    }
    
    return { servers };
  }

  /**
   * Build a mapping of servers to their tools
   * This helps associate tools with their servers
   * @returns {Object} Map of server IDs to arrays of tool names
   * @private
   */
  buildServerToolsMap() {
    // This is a mapping of server IDs to the tools they provide
    // Based on our knowledge of which servers provide which tools
    const map = {
      'github.com/Garoth/sleep-mcp': ['sleep'],
      'github.com/anaisbetts/mcp-youtube': ['download_youtube_url'],
      'github.com/ahujasid/blender': [
        'get_scene_info', 'get_object_info', 'create_object', 'modify_object',
        'delete_object', 'set_material', 'execute_blender_code', 'get_polyhaven_categories',
        'search_polyhaven_assets', 'download_polyhaven_asset', 'set_texture', 'get_polyhaven_status'
      ],
      'github.com/executeautomation/mcp-playwright': [
        'playwright_navigate', 'playwright_screenshot', 'playwright_click', 'playwright_iframe_click',
        'playwright_fill', 'playwright_select', 'playwright_hover', 'playwright_evaluate',
        'playwright_console_logs', 'playwright_close', 'playwright_get', 'playwright_post',
        'playwright_put', 'playwright_patch', 'playwright_delete'
      ],
      'github.com/NightTrek/Software-planning-mcp': [
        'start_planning', 'save_plan', 'add_todo', 'remove_todo',
        'get_todos', 'update_todo_status'
      ],
      'github.com/pashpashpash/perplexity-mcp': [
        'chat_perplexity', 'search', 'get_documentation', 'find_apis', 'check_deprecated_code'
      ],
      'github.com/21st-dev/magic-mcp': [
        '21st_magic_component_builder', 'logo_search', '21st_magic_component_inspiration'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/puppeteer': [
        'puppeteer_navigate', 'puppeteer_screenshot', 'puppeteer_click', 'puppeteer_fill',
        'puppeteer_select', 'puppeteer_hover', 'puppeteer_evaluate'
      ],
      'github.com/pashpashpash/mcp-taskmanager': [
        'request_planning', 'get_next_task', 'mark_task_done', 'approve_task_completion',
        'approve_request_completion', 'open_task_details', 'list_requests',
        'add_tasks_to_request', 'update_task', 'delete_task'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/github': [
        'create_or_update_file', 'search_repositories', 'create_repository', 'get_file_contents',
        'push_files', 'create_issue', 'create_pull_request', 'fork_repository', 'create_branch',
        'list_commits', 'list_issues', 'update_issue', 'add_issue_comment', 'search_code',
        'search_issues', 'search_users', 'get_issue'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/google-maps': [
        'maps_geocode', 'maps_reverse_geocode', 'maps_search_places', 'maps_place_details',
        'maps_distance_matrix', 'maps_elevation', 'maps_directions'
      ],
      'github.com/tavily-ai/tavily-mcp': [
        'tavily-search', 'tavily-extract'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking': [
        'sequentialthinking'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/brave-search': [
        'brave_web_search', 'brave_local_search'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/filesystem': [
        'read_file', 'read_multiple_files', 'write_file', 'edit_file', 'create_directory',
        'list_directory', 'directory_tree', 'move_file', 'search_files', 'get_file_info',
        'list_allowed_directories'
      ],
      'github.com/zcaceres/fetch-mcp': [
        'fetch_html', 'fetch_markdown', 'fetch_txt', 'fetch_json'
      ],
      'github.com/pashpashpash/mcp-notion-server': [
        'notion_append_block_children', 'notion_retrieve_block', 'notion_retrieve_block_children',
        'notion_delete_block', 'notion_retrieve_page', 'notion_update_page_properties',
        'notion_list_all_users', 'notion_retrieve_user', 'notion_retrieve_bot_user',
        'notion_create_database', 'notion_query_database', 'notion_retrieve_database',
        'notion_update_database', 'notion_create_database_item', 'notion_create_comment',
        'notion_retrieve_comments', 'notion_search'
      ],
      'github.com/pashpashpash/mcp-webresearch': [
        'search_google', 'visit_page', 'take_screenshot'
      ],
      'github.com/modelcontextprotocol/servers/tree/main/src/time': [
        'get_current_time', 'format_time', 'convert_timezone', 'get_unix_timestamp'
      ],
      'github.com/AgentDeskAI/browser-tools-mcp': [
        'getConsoleLogs', 'getConsoleErrors', 'getNetworkErrors', 'getNetworkLogs', 
        'takeScreenshot', 'getSelectedElement', 'wipeLogs', 'runAccessibilityAudit',
        'runPerformanceAudit', 'runSEOAudit', 'runNextJSAudit', 'runDebuggerMode',
        'runAuditMode', 'runBestPracticesAudit'
      ]
    };
    
    return map;
  }

  /**
   * Get tools for a specific server
   * @param {string} serverId - Server ID
   * @param {Object} serverToolsMap - Map of server IDs to tool names
   * @param {Object} serverConfig - Server configuration from settings
   * @returns {Array} Array of tool names
   * @private
   */
  getToolsForServer(serverId, serverToolsMap, serverConfig) {
    // Initialize empty array for tools
    let tools = [];
    
    // Priority 1: Use autoApprove array from server config
    if (serverConfig && Array.isArray(serverConfig.autoApprove) && serverConfig.autoApprove.length > 0) {
      tools = [...serverConfig.autoApprove];
    }
    
    // Priority 2: Check exact match in our static mapping
    if (serverToolsMap[serverId]) {
      for (const tool of serverToolsMap[serverId]) {
        if (!tools.includes(tool)) {
          tools.push(tool);
        }
      }
    } else {
      // Priority 3: Try to match by prefix for similar server URLs
      let bestMatch = null;
      let bestMatchLength = 0;
      
      for (const mappedServerId in serverToolsMap) {
        // Check if either ID is a prefix of the other
        if (serverId.startsWith(mappedServerId) || mappedServerId.startsWith(serverId)) {
          // Use the longer match as it's likely more specific
          const matchLength = Math.min(mappedServerId.length, serverId.length);
          if (matchLength > bestMatchLength) {
            bestMatch = mappedServerId;
            bestMatchLength = matchLength;
          }
        }
        
        // Also check for partial matches in the path components
        // This helps with matching servers with similar paths but different domains
        const serverParts = serverId.split('/');
        const mappedParts = mappedServerId.split('/');
        
        // Check if the last parts match (e.g., "time" in ".../src/time")
        if (serverParts.length > 0 && mappedParts.length > 0 && 
            serverParts[serverParts.length - 1] === mappedParts[mappedParts.length - 1]) {
          // If we have a match on the last part and it's better than our current match
          const matchLength = serverParts[serverParts.length - 1].length;
          if (matchLength > bestMatchLength) {
            bestMatch = mappedServerId;
            bestMatchLength = matchLength;
          }
        }
      }
      
      // If we found a prefix match, add its tools
      if (bestMatch) {
        for (const tool of serverToolsMap[bestMatch]) {
          if (!tools.includes(tool)) {
            tools.push(tool);
          }
        }
      }
    }
    
    // Priority 4: If we still don't have any tools, generate a reasonable default
    if (tools.length === 0) {
      // Extract server name from ID for a reasonable default
      const serverName = serverId.split('/').pop().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      // Generate a list of likely tools based on the server name
      const likelyTools = [];
      
      // Common prefixes for tools
      const commonPrefixes = ['get_', 'create_', 'update_', 'delete_', 'search_', 'list_'];
      
      // Add a generic tool based on the server name
      likelyTools.push(`${serverName}_tool`);
      
      // Add some common operations with the server name
      for (const prefix of commonPrefixes) {
        likelyTools.push(`${prefix}${serverName}`);
      }
      
      // Use just the first tool to avoid cluttering the documentation
      tools = [likelyTools[0]];
    }
    
    // Sort tools alphabetically for consistent output
    tools.sort();
    
    return tools;
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
   * Discover tools for a server using AI
   * @param {string} serverId - Server ID
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<Array>} Array of tool names
   */
  async discoverToolsForServer(serverId, serverConfig) {
    let tools = [];
    
    // First get tools from our static mapping
    const serverToolsMap = this.buildServerToolsMap();
    const knownTools = this.getToolsForServer(serverId, serverToolsMap, serverConfig);
    tools.push(...knownTools);
    
    // If AI is enabled and we still don't have tools, use AI prediction
    if (tools.length === 0 && this.aiHelper) {
      try {
        const aiTools = await this.aiHelper.predictToolsForServer(serverId);
        for (const tool of aiTools) {
          if (!tools.includes(tool)) {
            tools.push(tool);
          }
        }
      } catch (error) {
        console.error(`Error predicting tools with AI: ${error.message}`);
      }
    }
    
    // Ensure unique tools
    return [...new Set(tools)];
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
