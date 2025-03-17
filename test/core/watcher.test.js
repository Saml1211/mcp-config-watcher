import { MCPConfigWatcher } from '../../src/core/watcher.js';

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { jest } from '@jest/globals';

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(true)
  })
}));

describe('MCPConfigWatcher', () => {
  let watcher;
  const testConfig = {
    paths: {
      settings: '/test/path/settings.json'
    },
    watcher: {
      awaitWriteFinish: true
    }
  };
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock fs-extra methods directly in beforeEach
    fs.pathExists = jest.fn().mockResolvedValue(true);
    fs.readFile = jest.fn().mockResolvedValue('test file content');
    fs.ensureDir = jest.fn().mockResolvedValue();
    fs.writeFile = jest.fn().mockResolvedValue();
    fs.remove = jest.fn().mockResolvedValue();
    
    watcher = new MCPConfigWatcher(testConfig);
    
    // Add event listeners to prevent "possible memory leak" warnings
    watcher.on('info', () => {});
    watcher.on('error', () => {});
    watcher.on('warning', () => {});
    watcher.on('started', () => {});
    watcher.on('stopped', () => {});
    watcher.on('fileChanged', () => {});
  });
  
  describe('start()', () => {
    it('should start watching the settings file', async () => {
      const result = await watcher.start();
      
      expect(result).toBe(true);
      expect(watcher.running).toBe(true);
      expect(fs.pathExists).toHaveBeenCalledWith(testConfig.paths.settings);
    });
    
    it('should return true and emit info when already running', async () => {
      // Setup
      watcher.running = true;
      const infoSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.start();
      
      // Assert
      expect(result).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith('info', expect.any(String));
    });
    
    it('should return false when settings file does not exist', async () => {
      // Setup
      fs.pathExists.mockResolvedValue(false);
      const errorSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.start();
      
      // Assert
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('error', expect.stringContaining('not found'));
    });
  });
  
  describe('stop()', () => {
    it('should stop watching and return true', async () => {
      // Setup
      watcher.running = true;
      watcher.watcher = { close: jest.fn().mockResolvedValue(true) };
      
      // Act
      const result = await watcher.stop();
      
      // Assert
      expect(result).toBe(true);
      expect(watcher.running).toBe(false);
      expect(watcher.watcher).toBeNull();
    });
    
    it('should return true and emit info when not running', async () => {
      // Setup
      watcher.running = false;
      watcher.watcher = null;
      const infoSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.stop();
      
      // Assert
      expect(result).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith('info', expect.any(String));
    });
  });
  
  describe('getFileHash()', () => {
    it('should calculate hash of file content', async () => {
      // Setup
      const testContent = 'test file content';
      fs.readFile.mockResolvedValue(testContent);
      
      // Create expected hash
      const hashSum = crypto.createHash('sha256');
      hashSum.update(testContent);
      const expectedHash = hashSum.digest('hex');
      
      // Act
      const hash = await watcher.getFileHash('/test/file.txt');
      
      // Assert
      expect(hash).toBe(expectedHash);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf8');
    });
    
    it('should retry reading file when error occurs', async () => {
      // Setup - first call fails, second succeeds
      fs.readFile
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce('test file content');
      
      const warningSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      await watcher.getFileHash('/test/file.txt');
      
      // Assert
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(warningSpy).toHaveBeenCalledWith('warning', expect.stringContaining('Retry attempt'));
    });
    
    it('should return empty string after max retries', async () => {
      // Setup - all calls fail
      fs.readFile.mockRejectedValue(new Error('Test error'));
      
      const errorSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const hash = await watcher.getFileHash('/test/file.txt');
      
      // Assert
      expect(hash).toBe('');
      expect(errorSpy).toHaveBeenCalledWith('error', expect.stringContaining('Error calculating file hash'));
    });
  });
  
  describe('forceUpdate()', () => {
    it('should start watcher if not running and emit fileChanged event', async () => {
      // Setup
      watcher.running = false;
      watcher.start = jest.fn().mockResolvedValue(true);
      const fileChangedSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.forceUpdate();
      
      // Assert
      expect(result).toBe(true);
      expect(watcher.start).toHaveBeenCalled();
      expect(fileChangedSpy).toHaveBeenCalledWith('fileChanged', testConfig.paths.settings);
    });
    
    it('should emit fileChanged event when already running', async () => {
      // Setup
      watcher.running = true;
      const fileChangedSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.forceUpdate();
      
      // Assert
      expect(result).toBe(true);
      expect(fileChangedSpy).toHaveBeenCalledWith('fileChanged', testConfig.paths.settings);
    });
    
    it('should return false when settings file does not exist', async () => {
      // Setup
      watcher.running = true;
      fs.pathExists.mockResolvedValue(false);
      const errorSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.forceUpdate();
      
      // Assert
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('error', expect.stringContaining('not found'));
    });
  });
  
  describe('handleFileChange()', () => {
    it('should skip update when file hash is unchanged', async () => {
      // Setup
      watcher.lastHash = 'test-hash';
      watcher.getFileHash = jest.fn().mockResolvedValue('test-hash');
      const infoSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      await watcher.handleFileChange('/test/file.txt');
      
      // Assert
      expect(infoSpy).toHaveBeenCalledWith('info', expect.stringContaining('unchanged'));
      expect(infoSpy).not.toHaveBeenCalledWith('fileChanged', expect.any(String));
    });
    
    it('should emit fileChanged when hash changes', async () => {
      // Setup
      watcher.lastHash = 'old-hash';
      watcher.getFileHash = jest.fn().mockResolvedValue('new-hash');
      const fileChangedSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      await watcher.handleFileChange('/test/file.txt');
      
      // Assert
      expect(watcher.lastHash).toBe('new-hash');
      expect(fileChangedSpy).toHaveBeenCalledWith('fileChanged', '/test/file.txt');
    });
  });
  
  describe('withRetry()', () => {
    it('should return the operation result on success', async () => {
      // Setup
      const operation = jest.fn().mockResolvedValue('success');
      
      // Act
      const result = await watcher.withRetry(operation, 3, 'test operation');
      
      // Assert
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should retry the operation when it fails', async () => {
      // Setup
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('success');
      
      const warningSpy = jest.spyOn(watcher, 'emit');
      
      // Act
      const result = await watcher.withRetry(operation, 3, 'test operation');
      
      // Assert
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(warningSpy).toHaveBeenCalledWith('warning', expect.stringContaining('Retry attempt'));
    });
    
    it('should throw error after max retries', async () => {
      // Setup
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);
      
      // Act & Assert
      await expect(watcher.withRetry(operation, 3, 'test operation')).rejects.toThrow(error);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});
