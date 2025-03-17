import { MCPSettingsParser } from '../../src/core/parser.js';

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { jest } from '@jest/globals';

describe('MCPSettingsParser', () => {
  let parser;
  const testConfig = {
    paths: {
      settings: '/test/path/settings.json'
    }
  };

  beforeEach(() => {
    parser = new MCPSettingsParser(testConfig);
  });

  describe('Tool Descriptions', () => {
    beforeEach(() => {
      // Mock the loadToolDescriptions method to set some test descriptions
      parser.toolDescriptions = {
        'sleep': 'Pauses execution for a specified number of milliseconds, useful for implementing delays in automated workflows.',
        'playwright_navigate': 'Navigates to a specified URL in a browser instance.',
        'get_scene_info': 'Retrieves detailed information about the current Blender scene.'
      };
    });
    
    it('should return correct description for known tools', () => {
      expect(parser.getToolDescription('sleep')).toBe('Pauses execution for a specified number of milliseconds, useful for implementing delays in automated workflows.');
      expect(parser.getToolDescription('playwright_navigate')).toBe('Navigates to a specified URL in a browser instance.');
      expect(parser.getToolDescription('get_scene_info')).toBe('Retrieves detailed information about the current Blender scene.');
    });

    it('should return "No description available" for unknown tools', () => {
      const unknownTool = 'non_existent_tool';
      expect(parser.getToolDescription(unknownTool)).toBe('No description available.');
    });
  });

  describe('parse()', () => {
    const testSettingsPath = path.join(process.cwd(), 'test/fixtures/mcp-settings.json');
    
    beforeEach(() => {
      // Mock fs-extra methods directly in beforeEach
      fs.ensureFile = jest.fn().mockResolvedValue();
      fs.writeJson = jest.fn().mockResolvedValue();
      fs.readJson = jest.fn().mockResolvedValue({
        servers: {
          'github.com/executeautomation/mcp-playwright': {
            tools: [
              'playwright_navigate',
              'playwright_screenshot',
              'playwright_click'
            ]
          },
          'github.com/modelcontextprotocol/servers/tree/main/src/time': {
            tools: [
              'get_current_time',
              'get_timezone'
            ]
          }
        }
      });
    });

    afterEach(async () => {
      // Clean up test file
      await fs.remove(testSettingsPath);
    });

    it('should parse MCP settings file successfully', async () => {
      const result = await parser.parse(testSettingsPath);
      
      expect(result).toBeInstanceOf(Object);
      expect(result.servers).toBeInstanceOf(Object);
      
      // Check Playwright server
      expect(result.servers['github.com/executeautomation/mcp-playwright'].tools).toEqual(
        expect.arrayContaining([
          'playwright_navigate',
          'playwright_screenshot',
          'playwright_click'
        ])
      );

      // Check Time server
      expect(result.servers['github.com/modelcontextprotocol/servers/tree/main/src/time']).toEqual(
        expect.objectContaining({
          tools: [
            'get_current_time',
            'get_timezone'
          ]
        })
      );
    });

    it('should throw error for non-existent settings file', async () => {
      const nonExistentPath = '/path/to/nonexistent/settings.json';
      
      await expect(parser.parse(nonExistentPath)).rejects.toThrow();
    });

    it('should handle malformed JSON in settings file', async () => {
      // Write malformed JSON
      await fs.writeFile(testSettingsPath, 'invalid json content');
      
      await expect(parser.parse(testSettingsPath)).rejects.toThrow();
    });
  });
});
