import chokidar from 'chokidar';
import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import crypto from 'crypto';

/**
 * File watcher class that monitors MCP settings file for changes
 */
export class MCPConfigWatcher extends EventEmitter {
  /**
   * Create a new watcher instance
   * @param {Object} config - Configuration object
   */
  constructor(config) {
    super();
    this.config = config;
    this.watcher = null;
    this.running = false;
    this.lastHash = null;
  }

  /**
   * Start watching the MCP settings file
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    if (this.running) {
      this.emit('info', 'Watcher is already running');
      return true;
    }

    try {
      const settingsPath = path.normalize(this.config.paths.settings);
      
      // Ensure the settings file exists
      if (!await fs.pathExists(settingsPath)) {
        this.emit('error', `MCP settings file not found at ${settingsPath}`);
        return false;
      }

      // Calculate initial file hash
      this.lastHash = await this.getFileHash(settingsPath);
      
      // Configure and start the watcher
      this.watcher = chokidar.watch(settingsPath, {
        persistent: true,
        awaitWriteFinish: this.config.watcher.awaitWriteFinish,
        ignoreInitial: true
      });

      // Set up event handlers
      this.watcher
        .on('change', async (filePath) => {
          this.emit('info', `Change detected in ${filePath}`);
          await this.handleFileChange(filePath);
        })
        .on('error', (error) => {
          this.emit('error', `Watcher error: ${error}`);
        });

      this.running = true;
      this.emit('started', `Started watching ${settingsPath}`);
      return true;
    } catch (error) {
      this.emit('error', `Failed to start watcher: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop watching the MCP settings file
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (!this.running || !this.watcher) {
      this.emit('info', 'Watcher is not running');
      return true;
    }

    try {
      await this.watcher.close();
      this.watcher = null;
      this.running = false;
      this.emit('stopped', 'Stopped watching MCP settings file');
      return true;
    } catch (error) {
      this.emit('error', `Failed to stop watcher: ${error.message}`);
      return false;
    }
  }

  /**
   * Get watcher status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      running: this.running,
      watchingFile: this.running ? this.config.paths.settings : null,
      lastUpdate: this.lastUpdated || null
    };
  }

  /**
   * Handle file change event
   * @param {string} filePath - Path to changed file
   * @private
   */
  async handleFileChange(filePath) {
    try {
      // Normalize the file path for cross-platform compatibility
      const normalizedPath = path.normalize(filePath);
      
      // Compare file hash to avoid duplicate processing
      const currentHash = await this.getFileHash(normalizedPath);
      if (this.lastHash === currentHash) {
        this.emit('info', 'File content unchanged, skipping update');
        return;
      }
      
      this.lastHash = currentHash;
      this.lastUpdated = new Date();
      
      // Emit change event for processors to handle
      this.emit('fileChanged', normalizedPath);
    } catch (error) {
      this.emit('error', `Error handling file change: ${error.message}`);
    }
  }

  /**
   * Calculate a hash of the file content for change detection
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} Hash string
   * @private
   */
  async getFileHash(filePath) {
    try {
      // Normalize the file path for cross-platform compatibility
      const normalizedPath = path.normalize(filePath);
      
      // Maximum retry attempts
      const maxRetries = 3;
      let attempts = 0;
      let hash = '';
      
      while (attempts < maxRetries) {
        try {
          attempts++;
          
          // Read file content
          const content = await fs.readFile(normalizedPath, 'utf8');
          
          // Create SHA256 hash of content
          const hashSum = crypto.createHash('sha256');
          hashSum.update(content);
          hash = hashSum.digest('hex');
          
          // If we got here, we succeeded
          break;
        } catch (retryError) {
          if (attempts >= maxRetries) {
            throw retryError;
          }
          
          // Log retry attempt
          this.emit('warning', `Retry attempt ${attempts} for hash calculation: ${retryError.message}`);
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempts)));
        }
      }
      
      return hash;
    } catch (error) {
      this.emit('error', `Error calculating file hash: ${error.message}`);
      return '';
    }
  }

  /**
   * Force an immediate update
   * @returns {Promise<boolean>} Success status
   */
  async forceUpdate() {
    if (!this.running) {
      this.emit('warning', 'Watcher is not running, starting first');
      await this.start();
    }
    
    try {
      const filePath = path.normalize(this.config.paths.settings);
      
      // Check if file exists before trying to process it
      if (!await fs.pathExists(filePath)) {
        this.emit('error', `Settings file not found at ${filePath}`);
        return false;
      }
      
      this.emit('info', 'Forcing update');
      this.emit('fileChanged', filePath);
      return true;
    } catch (error) {
      this.emit('error', `Error forcing update: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Performs an operation with retries using exponential backoff
   * @param {Function} operation - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise<any>} Result of the operation
   * @private
   */
  async withRetry(operation, maxRetries = 3, operationName = 'operation') {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        attempts++;
        return await operation();
      } catch (error) {
        if (attempts >= maxRetries) {
          throw error;
        }
        
        this.emit('warning', `Retry attempt ${attempts} for ${operationName}: ${error.message}`);
        
        // Exponential backoff (100ms, 200ms, 400ms, etc.)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempts)));
      }
    }
  }
}

export default MCPConfigWatcher;
