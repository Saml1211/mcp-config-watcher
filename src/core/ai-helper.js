import { EventEmitter } from 'events';

/**
 * AI Helper class for MCP Config Watcher
 * Provides AI-powered tool discovery and description generation
 */
export class AIHelper extends EventEmitter {
  /**
   * Create a new AI helper instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super();
    this.config = config;
    this.cache = new Map();
    
    // Initialize OpenAI if available and enabled
    if (config.ai?.enabled) {
      try {
        // Dynamic import to avoid dependency if not used
        import('openai').then(({ OpenAI }) => {
          this.openai = new OpenAI({
            apiKey: config.ai?.openai?.apiKey || process.env.OPENAI_API_KEY
          });
          this.emit('info', 'AI helper initialized with OpenAI');
        }).catch(error => {
          this.emit('warning', `Failed to initialize OpenAI: ${error.message}`);
          this.emit('warning', 'Install OpenAI package with: npm install openai');
          this.openai = null;
        });
      } catch (error) {
        this.emit('warning', `Failed to initialize OpenAI: ${error.message}`);
        this.openai = null;
      }
    } else {
      this.openai = null;
    }
  }
  
  /**
   * Check if AI is available
   * @returns {boolean} Whether AI is available
   */
  isAvailable() {
    return this.openai !== null && this.config.ai?.enabled === true;
  }
  
  /**
   * Get a cached value or compute it
   * @param {string} key - Cache key
   * @param {Function} computeFunc - Function to compute value if not cached
   * @returns {Promise<any>} Cached or computed value
   * @private
   */
  async getOrCompute(key, computeFunc) {
    // Check if caching is enabled
    if (this.config.ai?.cache?.enabled) {
      // Check if we have a cached value
      if (this.cache.has(key)) {
        const { value, timestamp } = this.cache.get(key);
        
        // Check if the cached value is still valid
        const maxAge = this.config.ai?.cache?.maxAge || 86400000; // Default: 24 hours
        if (Date.now() - timestamp < maxAge) {
          return value;
        }
      }
    }
    
    // Compute the value
    const value = await computeFunc();
    
    // Cache the value if caching is enabled
    if (this.config.ai?.cache?.enabled) {
      this.cache.set(key, {
        value,
        timestamp: Date.now()
      });
    }
    
    return value;
  }
  
  /**
   * Predict tools for a server based on its ID
   * @param {string} serverId - The server ID
   * @returns {Promise<Array>} Array of predicted tools
   */
  async predictToolsForServer(serverId) {
    // If AI is not available, return empty array
    if (!this.isAvailable()) {
      return [];
    }
    
    return this.getOrCompute(`predict:${serverId}`, async () => {
      try {
        // Extract meaningful parts from server ID
        const serverName = serverId.split('/').pop();
        
        const prompt = `
You are assisting in documenting MCP (Model Context Protocol) servers. 
For a server named "${serverName}", predict the most likely tools it would provide.
MCP servers typically provide tools related to their name or purpose.
For example, a "github" server might provide tools like "create_repository", "get_file_contents", etc.
A "weather" server might provide tools like "get_forecast", "get_current_temperature", etc.

Given the server name "${serverName}", list the 3-5 most likely tools it would provide.
Return ONLY a JSON array of tool names, nothing else.
`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that predicts MCP server tools.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 150
        });
        
        // Parse the response
        const content = response.choices[0].message.content.trim();
        let tools = [];
        
        try {
          // Try to parse as JSON
          tools = JSON.parse(content);
        } catch (error) {
          // If not valid JSON, try to extract tool names using regex
          const matches = content.match(/["']([^"']+)["']/g);
          if (matches) {
            tools = matches.map(m => m.replace(/["']/g, ''));
          }
        }
        
        // Ensure tools is an array
        if (!Array.isArray(tools)) {
          tools = [];
        }
        
        this.emit('debug', `Predicted tools for ${serverId}: ${tools.join(', ')}`);
        return tools;
      } catch (error) {
        this.emit('error', `Error predicting tools: ${error.message}`);
        return [];
      }
    });
  }
  
  /**
   * Generate a description for a tool
   * @param {string} toolName - The tool name
   * @param {string} serverId - The server ID for context
   * @returns {Promise<string>} Generated description
   */
  async generateToolDescription(toolName, serverId) {
    // If AI is not available, return default description
    if (!this.isAvailable()) {
      return 'No description available.';
    }
    
    return this.getOrCompute(`describe:${serverId}:${toolName}`, async () => {
      try {
        const prompt = `
Generate a brief, one-line description for an MCP tool named "${toolName}" from a server "${serverId}".
The description should explain what the tool does in a clear, concise manner.
Return ONLY the description text, nothing else.
`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that writes tool descriptions.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 100
        });
        
        const description = response.choices[0].message.content.trim();
        this.emit('debug', `Generated description for ${toolName}: ${description}`);
        
        return description;
      } catch (error) {
        this.emit('error', `Error generating description: ${error.message}`);
        return 'No description available.';
      }
    });
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.emit('info', 'AI helper cache cleared');
  }
}

export default AIHelper;
