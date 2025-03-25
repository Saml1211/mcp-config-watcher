import { EventEmitter } from 'events';
import fs from 'fs-extra';
import MCPConfigWatcher from './watcher.js';
import path from 'path';
import { saveConfig } from '../config/loader.js';
import MCPSettingsParser from './parser.js';
import MDGenerator from './generator.js';

/**
 * MCP Config Watcher service class
 * Manages the watcher, parser, and generator components
 */
export class MCPWatcherService extends EventEmitter {
  /**
   * Create a new service instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super();
    this.config = config;
    this.parser = new MCPSettingsParser(config);
    this.generator = new MDGenerator(config, this.parser);
    this.watcher = new MCPConfigWatcher(config);
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Set default event handlers for unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      this.emit('error', `Unhandled Promise Rejection: ${reason}`);
    });
    
    process.on('uncaughtException', (error) => {
      this.emit('error', `Uncaught Exception: ${error.message}`);
    });
  }

  /**
   * Setup event handlers
   * @private
   */
  setupEventHandlers() {
    // Forward watcher events
    this.watcher.on('info', (message) => this.emit('info', message));
    this.watcher.on('error', (message) => this.emit('error', message));
    this.watcher.on('warning', (message) => this.emit('warning', message));
    this.watcher.on('started', (message) => this.emit('started', message));
    this.watcher.on('stopped', (message) => this.emit('stopped', message));
    
    // Forward generator events
    this.generator.on('debug', (message) => this.emit('debug', message));
    this.generator.on('error', (message) => this.emit('error', message));
    
    // Forward parser events
    this.parser.on('info', (message) => this.emit('info', message));
    this.parser.on('error', (message) => this.emit('error', message));
    this.parser.on('warning', (message) => this.emit('warning', message));
    this.parser.on('debug', (message) => this.emit('debug', message));
    
    // Handle file changes
    this.watcher.on('fileChanged', async (filePath) => {
      try {
        this.emit('info', `Processing changes in ${filePath}`);
        await this.processFileChange(filePath);
      } catch (error) {
        this.emit('error', `Error processing file change: ${error.message}`);
        // Log stack trace to help with debugging
        this.emit('debug', `Stack trace: ${error.stack}`);
      }
    });
  }

  /**
   * Start the service
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    try {
      // Check if we should auto-start watcher
      if (this.config.service.autoStart) {
        const started = await this.watcher.start();
        if (started) {
          this.emit('info', 'Auto-started watcher service');
        }
      }
      
      return true;
    } catch (error) {
      this.emit('error', `Failed to start service: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop the service
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    try {
      await this.watcher.stop();
      return true;
    } catch (error) {
      this.emit('error', `Failed to stop service: ${error.message}`);
      return false;
    }
  }

  /**
   * Process file change
   * @param {string} filePath - Path to changed file
   * @private
   */
  async processFileChange(filePath) {
    try {
      // Parse MCP settings
      this.emit('info', 'Parsing MCP settings');
      
      // Read the settings file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const mcpSettings = JSON.parse(fileContent);
      
      // Use direct tool discovery if enabled
      let parsedData;
      if (this.config.discovery?.enabled !== false) {
        this.emit('info', 'Using direct tool discovery');
        // Use direct tool discovery
        parsedData = await this.parser.extractServerInfoWithDiscovery(mcpSettings);
      } 
      // Use AI-powered discovery if direct discovery is disabled but AI is enabled
      else if (this.config.ai?.enabled) {
        this.emit('info', 'Using AI-powered tool discovery');
        // Use AI-powered extraction
        parsedData = await this.parser.extractServerInfoWithAI(mcpSettings);
      } 
      // Fall back to regular parsing
      else {
        this.emit('info', 'Using basic server info extraction');
        // Use regular parsing
        parsedData = await this.parser.parse(filePath);
      }
      
      // Generate markdown
      this.emit('info', 'Generating markdown documentation');
      await this.generator.generateMarkdown(parsedData);
      
      this.emit('updated', {
        settingsPath: filePath,
        markdownPath: this.config.paths.markdown,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      this.emit('error', `Failed to process file: ${error.message}`);
      // Log stack trace to help with debugging
      this.emit('debug', `Stack trace: ${error.stack}`);
      return false;
    }
  }

  /**
   * Force an update
   * @returns {Promise<boolean>} Success status
   */
  async forceUpdate() {
    return this.watcher.forceUpdate();
  }

  /**
   * Get service status
   * @returns {Object} Status object
   */
  getStatus() {
    const watcherStatus = this.watcher.getStatus();
    
    return {
      ...watcherStatus,
      settingsPath: this.config.paths.settings,
      markdownPath: this.config.paths.markdown
    };
  }

  /**
   * Update service configuration
   * @param {Object} configUpdate - Configuration updates
   * @returns {Promise<boolean>} Success status
   */
  async updateConfig(configUpdate) {
    try {
      // Validate file paths
      if (configUpdate.settingsPath && path.extname(configUpdate.settingsPath).toLowerCase() !== '.json') {
        throw new Error('Settings path must be a JSON file');
      }
      
      if (configUpdate.markdownPath && path.extname(configUpdate.markdownPath).toLowerCase() !== '.md') {
        throw new Error('Markdown path must be a Markdown file');
      }
      
      // Update configuration paths
      if (configUpdate.settingsPath) {
        // Ensure the path is absolute
        this.config.paths.settings = path.isAbsolute(configUpdate.settingsPath) 
          ? configUpdate.settingsPath : path.resolve(configUpdate.settingsPath);
      }
      if (configUpdate.markdownPath) {
        // Ensure the path is absolute
        this.config.paths.markdown = path.isAbsolute(configUpdate.markdownPath)
          ? configUpdate.markdownPath : path.resolve(configUpdate.markdownPath);
      }
      
      // Update components with new configuration
      this.parser = new MCPSettingsParser(this.config);
      this.generator = new MDGenerator(this.config, this.parser);
      
      // Save updated configuration to config file
      await saveConfig(this.config);
      
      // Restart watcher if it's running
      const wasRunning = this.watcher.running;
      if (wasRunning) {
        await this.watcher.stop();
        this.watcher = new MCPConfigWatcher(this.config);
        
        // Re-setup event handlers for the new watcher
        this.setupEventHandlers();
        await this.watcher.start();
      }
      
      // Emit config updated event
      this.emit('config-updated', {
        settingsPath: this.config.paths.settings,
        markdownPath: this.config.paths.markdown,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      this.emit('error', `Failed to update configuration: ${error.message}`);
      return false;
    }
  }
}

export default MCPWatcherService;
