import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { setTimeout as setTimeoutPromise } from 'timers/promises';

/**
 * MCP Direct Tool Discovery
 * 
 * This class handles direct discovery of tools from MCP servers by
 * launching the server and extracting the tool information from the output.
 */
export class MCPToolDiscovery extends EventEmitter {
  /**
   * Create a new tool discovery instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super();
    this.config = config;
    this.cachedTools = new Map();
  }

  /**
   * Discover tools directly from an MCP server
   * @param {string} serverId - Server ID
   * @param {Object} serverConfig - Server configuration 
   * @returns {Promise<string[]>} Discovered tools
   */
  async discoverTools(serverId, serverConfig) {
    // Check if we have cached tools for this server ID
    if (this.cachedTools.has(serverId)) {
      this.emit('debug', `Using cached tools for ${serverId}`);
      return this.cachedTools.get(serverId);
    }

    try {
      this.emit('info', `Discovering tools for ${serverId}`);
      
      // Extract command and args from server config
      const command = serverConfig.command;
      const args = serverConfig.args || [];
      
      if (!command) {
        throw new Error(`No command defined for server ${serverId}`);
      }

      // Launch the MCP server and capture output
      const tools = await this.queryServerForTools(command, args, serverConfig.env || {});
      
      // Cache the discovered tools
      this.cachedTools.set(serverId, tools);
      
      this.emit('debug', `Discovered ${tools.length} tools for ${serverId}: ${tools.join(', ')}`);
      return tools;
    } catch (error) {
      this.emit('error', `Failed to discover tools for ${serverId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Query an MCP server for its available tools
   * @param {string} command - Command to run
   * @param {string[]} args - Command arguments
   * @param {Object} env - Environment variables
   * @returns {Promise<string[]>} Array of tool names
   * @private
   */
  async queryServerForTools(command, args, env) {
    return new Promise((resolve, reject) => {
      // Merge process.env with the provided env
      const processEnv = { ...process.env, ...env };
      
      // Add environment variables to signal tool discovery mode
      // Using multiple standard environment variables to maximize compatibility
      processEnv.MCP_LIST_FUNCTIONS = 'true';
      processEnv.MCP_DISCOVERY_MODE = 'true';
      processEnv.MCP_REQUIRE_DESCRIPTIONS = 'true';
      processEnv.MCP_LIST_TOOLS = 'true';  // Alternative naming
      processEnv.FUNCTIONS_DISCOVERY = 'true';  // Alternative naming
      processEnv.NODE_ENV = 'discovery';  // Some servers check NODE_ENV
      
      // Add specific CLI arguments for discovery if none are provided
      let discoveryArgs = [...args];
      if (args.length === 0) {
        // Add standard discovery arguments that many MCP servers understand
        discoveryArgs = ['--list-functions', '--discovery'];
      }
      
      // Log the command for debugging
      this.emit('debug', `Running command: ${command} ${discoveryArgs.join(' ')}`);
      
      // Spawn the process
      const childProcess = spawn(command, discoveryArgs, {
        env: processEnv,
        shell: true
      });

      let output = '';
      let errorOutput = '';
      
      // Send JSON-RPC request for tool listing once the process is ready
      // Standard MCP protocol requires a JSON-RPC 2.0 request
      const jsonRpcRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }) + '\n';
      
      // Allow process to start up
      setTimeout(() => {
        try {
          // Write JSON-RPC request to stdin
          if (childProcess.stdin.writable) {
            this.emit('debug', `Sending JSON-RPC request: ${jsonRpcRequest.trim()}`);
            childProcess.stdin.write(jsonRpcRequest);
          }
        } catch (error) {
          this.emit('debug', `Failed to write to stdin: ${error.message}`);
        }
      }, 500);
      
      // Collect stdout
      childProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Check if the chunk looks like a JSON-RPC response
        if (chunk.includes('"jsonrpc"') && (chunk.includes('"result"') || chunk.includes('"error"'))) {
          this.emit('debug', `Received potential JSON-RPC response: ${chunk.substring(0, 100)}...`);
        }
        
        // Look for function descriptions in real-time
        if (chunk.includes('function') && chunk.includes('name')) {
          this.emit('debug', `Received potential tool data: ${chunk.substring(0, 100)}...`);
        }
      });
      
      // Collect stderr
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Handle process completion
      childProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          this.emit('warning', `Server process exited with code ${code}`);
          if (errorOutput) {
            this.emit('debug', `Error output: ${errorOutput}`);
          }
        } else if (code === null) {
          // This is expected when we kill the process
          this.emit('debug', `Server process was terminated as expected`);
        }
        
        // Extract tools from output
        const tools = this.extractToolsFromOutput(output);
        
        // If we still couldn't find tools, try again with any stderr output
        // (Some servers might output function info to stderr)
        if (tools.length === 0 && errorOutput) {
          const errorTools = this.extractToolsFromOutput(errorOutput);
          if (errorTools.length > 0) {
            this.emit('debug', `Found ${errorTools.length} tools in stderr output`);
            resolve(errorTools);
            return;
          }
        }
        
        resolve(tools);
      });
      
      // Handle errors
      childProcess.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
      
      // Set a timeout to kill the process if it runs too long
      const timeout = this.config.discovery?.timeout || 10000; // Default 10 seconds
      setTimeoutPromise(timeout).then(() => {
        if (!childProcess.killed) {
          childProcess.kill();
          this.emit('info', `Completed discovery - terminated server process after ${timeout}ms`);
          // Still try to extract tools from partial output
          const tools = this.extractToolsFromOutput(output);
          resolve(tools);
        }
      });
    });
  }

  /**
   * Extract tool names from server output
   * @param {string} output - Server output
   * @returns {string[]} Array of tool names
   * @private
   */
  extractToolsFromOutput(output) {
    const tools = [];
    
    try {
      // Check if output is empty
      if (!output.trim()) {
        this.emit('warning', 'Server output is empty');
        return tools;
      }
      
      // Try different patterns to extract tool information
      
      // Pattern 0: Standard JSON-RPC response (highest priority)
      try {
        // Find JSON-RPC responses in the output
        // Look for complete JSON objects that match the JSON-RPC 2.0 format
        const rpcMatches = output.match(/\{[\s\S]*?"jsonrpc"\s*:\s*"2.0"[\s\S]*?\}/g);
        
        if (rpcMatches && rpcMatches.length > 0) {
          // Process each matching JSON-RPC response
          for (const rpcMatch of rpcMatches) {
            try {
              const rpcResponse = JSON.parse(rpcMatch);
              
              // Check if this is a successful tools/list response
              if (rpcResponse.result && rpcResponse.result.tools && Array.isArray(rpcResponse.result.tools)) {
                for (const tool of rpcResponse.result.tools) {
                  if (tool && tool.name) {
                    tools.push(tool.name);
                  }
                }
                
                if (tools.length > 0) {
                  this.emit('debug', `Found ${tools.length} tools in JSON-RPC response`);
                  return tools;
                }
              }
            } catch (err) {
              // Continue to next match if parsing fails
            }
          }
        }
      } catch (error) {
        this.emit('debug', `JSON-RPC format parsing error: ${error.message}`);
      }
      
      // Pattern 1: Standard OpenAI format - Look for JSON objects with functions array
      try {
        // Find all JSON objects in the output (even across multiple lines)
        const jsonMatches = output.match(/\{[\s\S]*?\}/g);
        
        if (jsonMatches && jsonMatches.length > 0) {
          for (const jsonMatch of jsonMatches) {
            try {
              // Try to parse the JSON
              const parsedJson = JSON.parse(jsonMatch);
              
              // Check for functions array (OpenAI format)
              if (parsedJson.functions && Array.isArray(parsedJson.functions)) {
                for (const func of parsedJson.functions) {
                  if (func && func.name) {
                    tools.push(func.name);
                  }
                }
                
                if (tools.length > 0) {
                  this.emit('debug', `Found ${tools.length} tools using OpenAI format`);
                  return tools;
                }
              }
              
              // Check for tools array (alternative format)
              if (parsedJson.tools && Array.isArray(parsedJson.tools)) {
                for (const tool of parsedJson.tools) {
                  if (tool && tool.name) {
                    tools.push(tool.name);
                  }
                }
                
                if (tools.length > 0) {
                  this.emit('debug', `Found ${tools.length} tools using tools array format`);
                  return tools;
                }
              }
              
              // Check for single function object (simplified format)
              if (parsedJson.name && typeof parsedJson.name === 'string') {
                tools.push(parsedJson.name);
                this.emit('debug', `Found function using single object format: ${parsedJson.name}`);
              }
            } catch (err) {
              // Continue to next match if this one fails
            }
          }
        }
      } catch (error) {
        this.emit('debug', `OpenAI format parsing error: ${error.message}`);
      }
      
      // Pattern 2: Line-by-line search for tool names in JSON format
      if (tools.length === 0) {
        try {
          const lines = output.split('\n');
          let foundTools = 0;
          
          for (const line of lines) {
            // Look for lines that might contain tool names
            if (line.includes('"name"') || line.includes("'name'")) {
              try {
                // Try to parse the line as JSON
                const lineData = JSON.parse(line);
                if (lineData.name) {
                  tools.push(lineData.name);
                  foundTools++;
                }
              } catch (error) {
                // Try to extract just the name field using regex
                const nameMatch = /["']name["']\s*:\s*["']([^"']+)["']/i.exec(line);
                if (nameMatch && nameMatch[1]) {
                  tools.push(nameMatch[1]);
                  foundTools++;
                }
              }
            }
          }
          
          if (foundTools > 0) {
            this.emit('debug', `Found ${foundTools} tools using line-by-line search`);
          }
        } catch (error) {
          this.emit('debug', `Line-by-line search error: ${error.message}`);
        }
      }
      
      // Pattern 3: Look for function-like declarations
      if (tools.length === 0) {
        try {
          // Look for patterns like "function: name" or "name: function_name"
          const functionDeclarations = output.match(/["']?function["']?\s*:\s*["']?([a-zA-Z0-9_]+)["']?/gi);
          if (functionDeclarations) {
            for (const declaration of functionDeclarations) {
              const match = /["']?function["']?\s*:\s*["']?([a-zA-Z0-9_]+)["']?/i.exec(declaration);
              if (match && match[1]) {
                tools.push(match[1]);
              }
            }
          }
          
          // Look for "name: value" pairs
          const nameValueRegex = /["']?name["']?\s*:\s*["']?([^"',\n]+)["']?/gi;
          let match;
          while ((match = nameValueRegex.exec(output)) !== null) {
            if (match[1] && !tools.includes(match[1])) {
              tools.push(match[1]);
            }
          }
          
          if (tools.length > 0) {
            this.emit('debug', `Found ${tools.length} tools using function/name declaration pattern`);
          }
        } catch (error) {
          this.emit('debug', `Function declaration pattern error: ${error.message}`);
        }
      }
      
      // Pattern 4: If we still don't have tools, look for any words that might be tool names
      if (tools.length === 0) {
        try {
          // Look for patterns like function_name or tool_name (containing underscores)
          const toolRegex = /\b([a-zA-Z]\w+_[a-zA-Z]\w*)\b/g;
          let match;
          let foundTools = 0;
          
          while ((match = toolRegex.exec(output)) !== null) {
            const toolName = match[1];
            // Only add if it looks like a valid tool name (contains underscore, not JavaScript keyword)
            if (toolName.includes('_') && !tools.includes(toolName)) {
              tools.push(toolName);
              foundTools++;
            }
          }
          
          if (foundTools > 0) {
            this.emit('debug', `Found ${foundTools} potential tools using pattern 4`);
          }
        } catch (error) {
          this.emit('debug', `Pattern 4 error: ${error.message}`);
        }
      }
      
      // Log the raw output for debugging if no tools were found
      if (tools.length === 0) {
        this.emit('debug', `No tools found. Raw output (first 500 chars): ${output.substring(0, 500)}`);
      }
    } catch (error) {
      this.emit('warning', `Failed to parse server output: ${error.message}`);
    }
    
    // Return unique tools
    return [...new Set(tools)];
  }

  /**
   * Clear the tools cache
   */
  clearCache() {
    this.cachedTools.clear();
    this.emit('info', 'Tool discovery cache cleared');
  }
}

export default MCPToolDiscovery; 