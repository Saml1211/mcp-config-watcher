#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import yaml from 'yaml';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue('MCP Config Watcher - AI Integration Upgrade'));
  console.log(chalk.blue('==========================================='));
  console.log('');
  console.log('This script will upgrade your MCP Config Watcher installation to use AI-powered tool discovery.');
  console.log('');
  
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
        execSync('npm install openai', { cwd: rootDir, stdio: 'inherit' });
        console.log(chalk.green('OpenAI package installed successfully.'));
      } catch (error) {
        console.error(chalk.red('Error installing OpenAI package:'), error);
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('Skipping OpenAI installation. AI features will not be available.'));
    }
  } else {
    console.log(chalk.green('OpenAI package is already installed.'));
  }
  
  // Check for OpenAI API key
  const { useApiKey } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useApiKey',
      message: 'Would you like to configure an OpenAI API key?',
      default: true
    }
  ]);
  
  let apiKey = '';
  if (useApiKey) {
    const { apiKeyInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKeyInput',
        message: 'Enter your OpenAI API key (or leave empty to use OPENAI_API_KEY environment variable):',
      }
    ]);
    apiKey = apiKeyInput;
  }
  
  // Update or create config
  let config;
  const configPath = path.join(rootDir, 'config.yml');
  
  try {
    if (await fs.pathExists(configPath)) {
      const configYaml = await fs.readFile(configPath, 'utf8');
      config = yaml.parse(configYaml);
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
    
    await fs.writeFile(configPath, yaml.stringify(config));
    console.log(chalk.green('Configuration updated successfully.'));
    
  } catch (error) {
    console.error(chalk.red('Error updating configuration:'), error);
    process.exit(1);
  }
  
  console.log('');
  console.log(chalk.green('AI integration setup complete!'));
  console.log(chalk.blue('Run the MCP Config Watcher to start using AI-powered tool discovery.'));
  console.log('');
  console.log('To use the AI features:');
  console.log('1. Make sure you have an OpenAI API key');
  console.log('2. Set the OPENAI_API_KEY environment variable or configure it in config.yml');
  console.log('3. Run the watcher with: npm start');
  console.log('');
  console.log(chalk.yellow('Note: AI-powered tool discovery uses the OpenAI API, which may incur costs.'));
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});
