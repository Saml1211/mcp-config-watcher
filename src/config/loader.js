import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE_NAME = 'config.yml';
const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '../../', CONFIG_FILE_NAME);

/**
 * Load configuration from config.yml file
 * @param {string} configPath - Path to config file (optional)
 * @returns {Object} Config object
 */
export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  try {
    const configExists = await fs.pathExists(configPath);
    
    if (!configExists) {
      console.warn(`Config file not found at ${configPath}, using defaults`);
      return getDefaultConfig();
    }
    
    let configFile = await fs.readFile(configPath, 'utf8');
    
    // Pre-process the YAML content on Windows to handle backslashes in paths
    // by converting them to forward slashes temporarily for YAML parsing
    if (process.platform === 'win32') {
      // Use regex with negative lookahead to escape backslashes that aren't already escaped
      // This modifies only actual Windows path backslashes while preserving YAML escapes
      configFile = configFile.replace(/\\(?!\\)/g, '\\\\');
    }
    
    const config = YAML.parse(configFile);
    
    // Normalize paths in the loaded config to ensure they use proper platform-specific separators
    if (config.paths) {
      if (config.paths.settings) {
        config.paths.settings = config.paths.settings.split(/[\/\\]/).join(path.sep);
      }
      if (config.paths.markdown) {
        config.paths.markdown = config.paths.markdown.split(/[\/\\]/).join(path.sep);
      }
    }
    if (config.service && config.service.logFile) {
      config.service.logFile = config.service.logFile.split(/[\/\\]/).join(path.sep);
    }
    
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    return getDefaultConfig();
  }
}

/**
 * Save configuration to config.yml file
 * @param {Object} config - Config object to save
 * @param {string} configPath - Path to config file (optional)
 */
export async function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  try {
    // Ensure paths are properly quoted to handle spaces
    // Create a clean config object to avoid any reference issues
    const configToSave = JSON.parse(JSON.stringify({
      paths: {
        settings: config.paths.settings,
        markdown: config.paths.markdown
      },
      watcher: config.watcher,
      service: config.service,
      notifications: config.notifications,
      discovery: config.discovery,
      ai: config.ai
    }));
    
    // Use JSON.stringify and then parse to ensure clean object
    // Ensure all paths use proper path separators for the current platform
    if (configToSave.paths) {
      if (configToSave.paths.settings) {
        configToSave.paths.settings = configToSave.paths.settings.split(/[\/\\]/).join(path.sep);
      }
      if (configToSave.paths.markdown) {
        configToSave.paths.markdown = configToSave.paths.markdown.split(/[\/\\]/).join(path.sep);
      }
    }
    if (configToSave.service && configToSave.service.logFile) {
      configToSave.service.logFile = configToSave.service.logFile.split(/[\/\\]/).join(path.sep);
    }
    
    // Escape backslashes in Windows paths before stringifying to YAML
    if (process.platform === 'win32') {
      if (configToSave.paths) {
        if (configToSave.paths.settings) {
          configToSave.paths.settings = configToSave.paths.settings.replace(/\\/g, '\\\\');
        }
        if (configToSave.paths.markdown) {
          configToSave.paths.markdown = configToSave.paths.markdown.replace(/\\/g, '\\\\');
        }
      }
      if (configToSave.service && configToSave.service.logFile) {
        configToSave.service.logFile = configToSave.service.logFile.replace(/\\/g, '\\\\');
      }
    }
    
    const configYaml = YAML.stringify(configToSave, { quotingType: '\"', lineWidth: 0 });
    await fs.writeFile(configPath, configYaml, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Get default configuration
 * @returns {Object} Default config object
 */
function getDefaultConfig() {
  // Determine platform-specific default paths
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  
  // Create platform-agnostic paths using path.join
  const settingsPath = process.platform === 'win32'
    ? path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
    : path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
  
  const markdownPath = path.join(homeDir, 'repos', 'custom', 'mcp_servers_and_tools.md');
  
  return {
    paths: {
      settings: settingsPath,
      markdown: markdownPath
    },
    watcher: {
      pollInterval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500
      }
    },
    service: {
      autoStart: true,
      port: 8080,
      logLevel: "info",
      logFile: path.join('.', 'logs', 'app.log')
    },
    notifications: {
      enabled: true,
      onSuccess: true,
      onError: true
    },
    discovery: {
      enabled: true,
      timeout: 10000,
      cache: true
    },
    ai: {
      enabled: false,
      fallbackToAi: true,
      cache: {
        enabled: true,
        maxAge: 86400000 // 24 hours
      }
    }
  };
}

export default { loadConfig, saveConfig, getDefaultConfig };
