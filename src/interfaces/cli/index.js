#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../../config/loader.js';
import MCPWatcherService from '../../core/service.js';

const program = new Command();
let service = null;

// Program metadata
program
  .name('mcp-watcher')
  .description('MCP Config Watcher CLI - Monitor MCP settings and generate documentation')
  .version('1.0.0');

// Start command
program
  .command('start')
  .description('Start the watcher service')
  .action(async () => {
    try {
      if (service && service.watcher.running) {
        console.log(chalk.yellow('Watcher is already running'));
        return;
      }
      
      console.log(chalk.blue('Starting MCP Config Watcher...'));
      
      const config = await loadConfig();
      service = new MCPWatcherService(config);
      
      setupEventHandlers(service);
      await service.start();
      
      console.log(chalk.green('Watcher started successfully'));
      console.log(chalk.blue(`Watching: ${config.paths.settings}`));
      console.log(chalk.blue(`Output: ${config.paths.markdown}`));
      console.log(chalk.gray('Press Ctrl+C to stop'));
      
      // Keep process alive
      process.stdin.resume();
    } catch (error) {
      console.error(chalk.red(`Error starting watcher: ${error.message}`));
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop the watcher service')
  .action(async () => {
    try {
      if (!service || !service.watcher.running) {
        console.log(chalk.yellow('Watcher is not running'));
        return;
      }
      
      console.log(chalk.blue('Stopping MCP Config Watcher...'));
      await service.stop();
      console.log(chalk.green('Watcher stopped successfully'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error stopping watcher: ${error.message}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check the status of the watcher service')
  .action(async () => {
    try {
      const config = await loadConfig();
      
      if (!service) {
        service = new MCPWatcherService(config);
      }
      
      const status = service.getStatus();
      
      console.log(chalk.blue('MCP Config Watcher Status'));
      console.log(chalk.blue('-------------------------'));
      console.log(`Running: ${status.running ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`Settings file: ${chalk.cyan(config.paths.settings)}`);
      console.log(`Markdown file: ${chalk.cyan(config.paths.markdown)}`);
      
      if (status.lastUpdate) {
        console.log(`Last update: ${chalk.yellow(status.lastUpdate.toLocaleString())}`);
      } else {
        console.log(`Last update: ${chalk.gray('Never')}`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error checking status: ${error.message}`));
      process.exit(1);
    }
  });

// Update command
program
  .command('update')
  .description('Force an update of the documentation')
  .action(async () => {
    try {
      const config = await loadConfig();
      
      if (!service) {
        service = new MCPWatcherService(config);
        setupEventHandlers(service);
      }
      
      console.log(chalk.blue('Forcing documentation update...'));
      await service.forceUpdate();
      console.log(chalk.green('Documentation updated successfully'));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error updating documentation: ${error.message}`));
      process.exit(1);
    }
  });

// Configure command
program
  .command('configure')
  .description('Edit configuration settings')
  .action(async () => {
    console.log(chalk.yellow('Configuration editor not implemented yet'));
    console.log(chalk.blue(`You can edit the config file directly at: ${process.cwd()}/config.yml`));
    process.exit(0);
  });

/**
 * Set up event handlers for the service
 * @param {MCPWatcherService} service - Service instance
 */
function setupEventHandlers(service) {
  service.on('info', (message) => console.log(chalk.blue(`[INFO] ${message}`)));
  service.on('error', (message) => console.error(chalk.red(`[ERROR] ${message}`)));
  service.on('warning', (message) => console.warn(chalk.yellow(`[WARNING] ${message}`)));
  service.on('started', (message) => console.log(chalk.green(`[STARTED] ${message}`)));
  service.on('stopped', (message) => console.log(chalk.yellow(`[STOPPED] ${message}`)));
  service.on('updated', (data) => {
    console.log(chalk.green(`[UPDATED] Generated markdown documentation`));
    console.log(chalk.blue(`  - Settings: ${data.settingsPath}`));
    console.log(chalk.blue(`  - Markdown: ${data.markdownPath}`));
    console.log(chalk.blue(`  - Time: ${data.timestamp.toLocaleString()}`));
  });
  
  // Handle shutdown
  const shutdown = async () => {
    console.log(chalk.yellow('\nShutting down...'));
    if (service) {
      await service.stop();
    }
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Parse command line arguments
program.parse(process.argv);

// If no commands were provided, display help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
