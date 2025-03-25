# MCP Config Watcher Overview

## Introduction

MCP Config Watcher is a utility designed to monitor and document Model Context Protocol (MCP) server configurations. It automatically generates and maintains up-to-date documentation for all configured MCP servers and their tools.

## Purpose

The primary purpose of the MCP Config Watcher is to:

1. **Monitor Configuration**: Watch for changes in the MCP settings file
2. **Generate Documentation**: Automatically create and update markdown documentation
3. **Highlight Auto-Approved Tools**: Visually indicate which tools are auto-approved in the configuration
4. **Preserve Custom Content**: Ensure that user-added content in the documentation is not overwritten

## Key Features

- **Real-time monitoring** of the MCP settings file
- **Direct tool discovery** using standard JSON-RPC protocol
- **Multi-pattern parsing** for maximum compatibility with different MCP server implementations
- **Safe update mechanism** that preserves user-added content
- **Visual highlighting** of auto-approved tools
- **Comprehensive tool information** with descriptions
- **Multiple interfaces**: CLI, web dashboard, and system tray application

## Components

The MCP Config Watcher consists of several key components:

1. **File Watcher**: Monitors the MCP settings file for changes
2. **Parser**: Extracts server and tool information from the settings
3. **Tool Discovery**: Identifies available tools from MCP servers using JSON-RPC and other techniques
4. **Markdown Generator**: Creates and updates the documentation
5. **Service Manager**: Coordinates the components and handles events

## Technology Stack

- **Node.js**: The core runtime environment
- **fs-extra**: Enhanced file system operations
- **chokidar**: File watching capabilities
- **Express**: Web server for the dashboard interface
- **Socket.io**: Real-time updates for the web dashboard
- **Electron**: System tray application (optional)

## Configuration

MCP Config Watcher can be configured via a YAML file, which specifies:

- Paths to the MCP settings file and output markdown file
- Watcher settings, such as poll interval
- Service settings, such as auto-start behavior
- Notification settings

## Interfaces

The tool provides multiple ways to interact with it:

1. **Command Line Interface (CLI)**: Simple commands to start, stop, and check status
2. **Web Dashboard**: Visual interface to monitor and manage the watcher
3. **System Tray Application**: Convenient access from the desktop

## Use Cases

- **Documentation Maintenance**: Keeping MCP server documentation up-to-date
- **Tool Discovery**: Understanding what tools are available in the MCP ecosystem
- **Security Awareness**: Highlighting which tools are auto-approved
