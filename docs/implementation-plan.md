# MCP Config Watcher Implementation Plan

## Current Issues

The MCP Config Watcher currently has the following limitations:

1. **Hard-coded server-tool mapping**: New MCP servers require manual updates to the codebase
2. **"Tools information not available" error**: For unrecognized servers, an unhelpful message is displayed
3. **Static tool descriptions**: Descriptions are maintained manually in the code

These issues were highlighted when a new time server was added, which displayed "*Tools information not available for this server.*" in the documentation, despite being properly configured in the settings.

## Implementation Plan

### Phase 1: Immediate Fix for Tool Discovery

#### 1.1 Enhance Parser and Mapping

**Implementation Details**:

```javascript
// In parser.js - Update getToolsForServer method
getToolsForServer(serverId, serverToolsMap, serverConfig) {
  let tools = [];
  
  // First attempt: Check our static mapping
  if (serverToolsMap[serverId]) {
    tools = [...serverToolsMap[serverId]];
  } else {
    // Second attempt: Try to match by prefix
    for (const mappedServerId in serverToolsMap) {
      if (serverId.startsWith(mappedServerId) || mappedServerId.startsWith(serverId)) {
        tools = [...serverToolsMap[mappedServerId]];
        break;
      }
    }
  }
  
  // Third attempt: Use autoApprove array from server config
  if (serverConfig && serverConfig.autoApprove && serverConfig.autoApprove.length > 0) {
    // Add any auto-approved tools not already in the list
    for (const tool of serverConfig.autoApprove) {
      if (!tools.includes(tool)) {
        tools.push(tool);
      }
    }
  }
  
  return tools;
}

// In extractServerInfo method
extractServerInfo(mcpSettings) {
  const servers = {};
  const serverToolsMap = this.buildServerToolsMap();
  
  for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
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
      // Pass serverConfig to enhance tool discovery
      tools: this.getToolsForServer(serverId, serverToolsMap, serverConfig)
    };
  }
  
  return { servers };
}
```

#### 1.2 Update Generator to Remove Error Message

**Implementation Details**:

```javascript
// In generator.js - Update generateServerSections method
generateServerSections(data, settings) {
  const { servers } = data;
  const serverSections = {};
  
  // Create autoApprove map
  const autoApproveMap = {};
  if (settings && settings.mcpServers) {
    for (const [serverId, serverConfig] of Object.entries(settings.mcpServers)) {
      if (serverConfig.autoApprove && Array.isArray(serverConfig.autoApprove)) {
        autoApproveMap[serverId] = serverConfig.autoApprove;
      }
    }
  }
  
  for (const [serverId, server] of Object.entries(servers)) {
    let content = '';
    
    // Get tools for this server
    let serverTools = server.tools || [];
    
    // Get auto-approved tools directly from settings
    const autoApproveTools = autoApproveMap[serverId] || [];
    
    // Combine tools from all sources, ensuring we have at least the auto-approved tools
    for (const tool of autoApproveTools) {
      if (!serverTools.includes(tool)) {
        serverTools.push(tool);
      }
    }
    
    // Generate a default tool name if none are found
    if (serverTools.length === 0) {
      // Extract server name from ID for a reasonable default
      const serverName = serverId.split('/').pop().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      // Add a generic tool based on the server name
      serverTools = [`${serverName}_tool`];
    }
    
    // Sort tools alphabetically
    serverTools.sort();
    
    // Generate tool entries
    for (const toolName of serverTools) {
      const description = this.parser.getToolDescription(toolName);
      const isAutoApproved = autoApproveTools.includes(toolName);
      
      if (isAutoApproved) {
        content += `- **${toolName}** 🔓 (Auto-Approved): ${description}\n`;
      } else {
        content += `- **${toolName}**: ${description}\n`;
      }
    }
    
    serverSections[serverId] = content;
  }
  
  return serverSections;
}
```

### Phase 2: AI-Powered Tool Discovery

#### 2.1 Add OpenAI Integration (Optional Enhancement)

**Implementation Details**:

```javascript
// New file: src/core/ai-helper.js
import { OpenAI } from 'openai';

export class AIHelper {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY
    });
    
    // Cache to avoid redundant API calls
    this.cache = new Map();
  }
  
  /**
   * Predict tools for a server based on its ID
   * @param {string} serverId - The server ID
   * @returns {Promise<Array>} Array of predicted tools
   */
  async predictToolsForServer(serverId) {
    // Check cache first
    if (this.cache.has(serverId)) {
      return this.cache.get(serverId);
    }
    
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
      
      // Cache the result
      this.cache.set(serverId, tools);
      
      return tools;
    } catch (error) {
      console.error('Error predicting tools:', error);
      return [];
    }
  }
  
  /**
   * Generate a description for a tool
   * @param {string} toolName - The tool name
   * @param {string} serverId - The server ID for context
   * @returns {Promise<string>} Generated description
   */
  async generateToolDescription(toolName, serverId) {
    const cacheKey = `${serverId}:${toolName}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
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
      
      // Cache the result
      this.cache.set(cacheKey, description);
      
      return description;
    } catch (error) {
      console.error('Error generating description:', error);
      return 'No description available.';
    }
  }
}

export default AIHelper;
```

#### 2.2 Integrate AI Helper with Parser and Generator

**Implementation Details**:

```javascript
// In parser.js - Add AI integration
import AIHelper from './ai-helper.js';

class MCPSettingsParser {
  constructor(config) {
    this.config = config;
    this.toolDescriptions = { /* existing descriptions */ };
    
    // Initialize AI helper if enabled
    if (config.useAi) {
      this.aiHelper = new AIHelper(config);
    }
  }
  
  // Add method to get AI-powered tool description
  async getToolDescriptionWithAI(toolName, serverId) {
    // First check our static descriptions
    const staticDescription = this.toolDescriptions[toolName];
    if (staticDescription) {
      return staticDescription;
    }
    
    // If AI is enabled and no static description, use AI
    if (this.aiHelper) {
      return await this.aiHelper.generateToolDescription(toolName, serverId);
    }
    
    return 'No description available.';
  }
  
  // Enhanced method to discover tools with AI
  async discoverToolsForServer(serverId, serverConfig) {
    let tools = [];
    
    // First get tools from our static mapping
    const knownTools = this.getToolsForServer(serverId, this.buildServerToolsMap(), serverConfig);
    tools.push(...knownTools);
    
    // Add tools from autoApprove array
    if (serverConfig && serverConfig.autoApprove) {
      for (const tool of serverConfig.autoApprove) {
        if (!tools.includes(tool)) {
          tools.push(tool);
        }
      }
    }
    
    // If AI is enabled and we still don't have tools, use AI prediction
    if (tools.length === 0 && this.aiHelper) {
      const aiTools = await this.aiHelper.predictToolsForServer(serverId);
      for (const tool of aiTools) {
        if (!tools.includes(tool)) {
          tools.push(tool);
        }
      }
    }
    
    return [...new Set(tools)]; // Return unique tools
  }
  
  // Enhanced extract method using async/await
  async extractServerInfoWithAI(mcpSettings) {
    const servers = {};
    const serverToolsMap = this.buildServerToolsMap();
    
    // Process each server
    for (const [serverId, serverConfig] of Object.entries(mcpSettings.mcpServers)) {
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
```

### Phase 3: Integration Testing and Deployment

#### 3.1 Create Test Scripts

**Implementation Details**:

```javascript
// test/ai-helper.test.js
import { expect } from 'chai';
import AIHelper from '../src/core/ai-helper.js';

describe('AIHelper', () => {
  let aiHelper;
  
  before(() => {
    // Initialize with test config
    aiHelper = new AIHelper({
      openai: { apiKey: process.env.OPENAI_API_KEY || 'sk-test' }
    });
  });
  
  it('should predict tools for a server', async () => {
    const tools = await aiHelper.predictToolsForServer('github.com/modelcontextprotocol/servers/tree/main/src/time');
    
    expect(tools).to.be.an('array');
    expect(tools.length).to.be.greaterThan(0);
    
    // Tools should look like reasonable MCP tool names
    for (const tool of tools) {
      expect(tool).to.be.a('string');
      expect(tool.length).to.be.greaterThan(0);
    }
  });
  
  it('should generate a description for a tool', async () => {
    const description = await aiHelper.generateToolDescription(
      'get_current_time',
      'github.com/modelcontextprotocol/servers/tree/main/src/time'
    );
    
    expect(description).to.be.a('string');
    expect(description.length).to.be.greaterThan(10);
  });
});
```

#### 3.2 Update Configuration Schema

**Implementation Details**:

```yaml
# config.yml with AI configuration
paths:
  settings: "/Users/samlyndon/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
  markdown: "/Users/samlyndon/repos/custom/mcp_servers_and_tools.md"

watcher:
  enabled: true
  pollInterval: 1000

ai:
  enabled: true
  openai:
    apiKey: "${OPENAI_API_KEY}"  # Read from environment variable
  cache:
    enabled: true
    maxAge: 86400000  # 24 hours in milliseconds
  fallback:
    enabled: true     # Generate fallback tools if none found
```

#### 3.3 Create Upgrade Script

**Implementation Details**:

```javascript
// bin/upgrade-ai.js
#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function main() {
  console.log(chalk.blue('MCP Config Watcher - AI Integration Upgrade'));
  
  // Check if OpenAI is already installed
  let packageJson;
  try {
    packageJson = await fs.readJSON(path.join(rootDir, 'package.json'));
  } catch (error) {
    console.error(chalk.red('Error reading package.json:'), error);
    process.exit(1);
  }
  
  const hasOpenAI = packageJson.dependencies && packageJson.dependencies.openai;
  
  if (!hasOpenAI) {
    const { install } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'install',
        message: 'OpenAI package is not installed. Would you like to install it?',
        default: true
      }
    ]);
    
    if (install) {
      console.log(chalk.yellow('Installing OpenAI package...'));
      try {
        const { execa } = await import('execa');
        await execa('npm', ['install', 'openai'], { cwd: rootDir });
        console.log(chalk.green('OpenAI package installed successfully.'));
      } catch (error) {
        console.error(chalk.red('Error installing OpenAI package:'), error);
        process.exit(1);
      }
    }
  }
  
  // Check for OpenAI API key
  const { apiKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your OpenAI API key (or leave empty to use OPENAI_API_KEY environment variable):',
    }
  ]);
  
  // Update or create config
  let config;
  const configPath = path.join(rootDir, 'config.yml');
  
  try {
    const { load } = await import('js-yaml');
    const { dump } = await import('js-yaml');
    
    if (await fs.pathExists(configPath)) {
      const configYaml = await fs.readFile(configPath, 'utf8');
      config = load(configYaml);
    } else {
      config = {
        paths: {
          settings: "/Users/samlyndon/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
          markdown: "/Users/samlyndon/repos/custom/mcp_servers_and_tools.md"
        },
        watcher: {
          enabled: true,
          pollInterval: 1000
        }
      };
    }
    
    // Add or update AI configuration
    config.ai = config.ai || {};
    config.ai.enabled = true;
    
    if (apiKey) {
      config.ai.openai = config.ai.openai || {};
      config.ai.openai.apiKey = apiKey;
    } else {
      config.ai.openai = config.ai.openai || {};
      config.ai.openai.apiKey = "${OPENAI_API_KEY}";
    }
    
    config.ai.cache = config.ai.cache || {};
    config.ai.cache.enabled = true;
    config.ai.cache.maxAge = 86400000;  // 24 hours
    
    config.ai.fallback = config.ai.fallback || {};
    config.ai.fallback.enabled = true;
    
    await fs.writeFile(configPath, dump(config));
    console.log(chalk.green('Configuration updated successfully.'));
    
  } catch (error) {
    console.error(chalk.red('Error updating configuration:'), error);
    process.exit(1);
  }
  
  console.log(chalk.green('AI integration setup complete!'));
  console.log(chalk.blue('Run the MCP Config Watcher to start using AI-powered tool discovery.'));
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
```

## Testing Plan

1. **Unit Testing**:
   - Test each component individually, especially the new AI integration
   - Verify tool discovery works with different server configurations
   - Check error handling when OpenAI API is not available

2. **Integration Testing**:
   - Test the full workflow with real MCP settings
   - Verify documentation generation with and without AI
   - Check performance with a large number of servers

3. **User Acceptance Testing**:
   - Test with actual users to ensure the documentation is helpful
   - Gather feedback on AI-generated tool descriptions
   - Validate that the "Tools information not available" message is gone

## Rollout Plan

1. **Phase 1 - Immediate Fix**:
   - Implement the enhanced parser and generator
   - Deploy without the AI integration
   - Verify that the time server and other servers show tool information

2. **Phase 2 - AI Integration (Optional)**:
   - Add the AI helper component
   - Test thoroughly before enabling by default
   - Make AI integration optional via configuration

3. **Phase 3 - Full Deployment**:
   - Release the complete solution
   - Provide migration guide for existing users
   - Monitor for any issues and gather feedback

## Success Criteria

1. The time server and any new servers show tool information without error messages
2. Auto-approved tools are properly highlighted
3. User content in the documentation is preserved
4. (Optional) AI-generated tool descriptions are accurate and helpful

## Future Improvements

1. **Improved AI Prompting**: Refine prompts to generate more accurate tool descriptions
2. **Local Models**: Support for local AI models for privacy and offline operation
3. **UI Integration**: Add AI settings to the web dashboard
4. **Server Introspection**: Direct querying of MCP servers for tool information
5. **Enhanced Documentation**: Include example usage, parameter descriptions, etc.
