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
    
    const configFile = await fs.readFile(configPath, 'utf8');
    return YAML.parse(configFile);
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
      notifications: config.notifications
    }));
    
    // Use JSON.stringify and then parse to ensure clean object
    const configYaml = YAML.stringify(configToSave, { quotingType: '"', lineWidth: 0 });
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
  return {
    paths: {
      settings: "/Users/samlyndon/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
      markdown: "/Users/samlyndon/repos/custom/mcp_servers_and_tools.md"
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
      logFile: ""
    },
    notifications: {
      enabled: true,
      onSuccess: true,
      onError: true
    }
  };
}

export default { loadConfig, saveConfig, getDefaultConfig };
