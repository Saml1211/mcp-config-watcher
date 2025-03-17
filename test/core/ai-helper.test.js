import { AIHelper } from '../../src/core/ai-helper.js';
import { jest } from '@jest/globals';

describe('AIHelper', () => {
  let aiHelper;
  let mockOpenAI;
  let mockConfig;
  
  beforeEach(() => {
    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    // Mock config
    mockConfig = {
      ai: {
        enabled: true,
        openai: {
          apiKey: 'test-api-key'
        },
        cache: {
          enabled: true,
          maxAge: 3600000 // 1 hour
        }
      }
    };
    
    // Create AI helper instance
    aiHelper = new AIHelper(mockConfig);
    
    // Mock the OpenAI instance
    aiHelper.openai = mockOpenAI;
    
    // Add event listeners to prevent "possible memory leak" warnings
    aiHelper.on('info', () => {});
    aiHelper.on('error', () => {});
    aiHelper.on('warning', () => {});
    aiHelper.on('debug', () => {});
  });
  
  describe('isAvailable()', () => {
    it('should return true when AI is available', () => {
      expect(aiHelper.isAvailable()).toBe(true);
    });
    
    it('should return false when AI is disabled', () => {
      aiHelper.config.ai.enabled = false;
      expect(aiHelper.isAvailable()).toBe(false);
    });
    
    it('should return false when OpenAI is not initialized', () => {
      aiHelper.openai = null;
      expect(aiHelper.isAvailable()).toBe(false);
    });
  });
  
  describe('getOrCompute()', () => {
    it('should return cached value if available and not expired', async () => {
      // Set up cache with a test value
      const testKey = 'test-key';
      const testValue = 'test-value';
      aiHelper.cache.set(testKey, {
        value: testValue,
        timestamp: Date.now()
      });
      
      // Mock compute function
      const computeFunc = jest.fn().mockResolvedValue('computed-value');
      
      // Call getOrCompute
      const result = await aiHelper.getOrCompute(testKey, computeFunc);
      
      // Check result
      expect(result).toBe(testValue);
      expect(computeFunc).not.toHaveBeenCalled();
    });
    
    it('should compute value if cache is disabled', async () => {
      // Disable cache
      aiHelper.config.ai.cache.enabled = false;
      
      // Set up cache with a test value
      const testKey = 'test-key';
      const testValue = 'test-value';
      aiHelper.cache.set(testKey, {
        value: testValue,
        timestamp: Date.now()
      });
      
      // Mock compute function
      const computeFunc = jest.fn().mockResolvedValue('computed-value');
      
      // Call getOrCompute
      const result = await aiHelper.getOrCompute(testKey, computeFunc);
      
      // Check result
      expect(result).toBe('computed-value');
      expect(computeFunc).toHaveBeenCalled();
    });
    
    it('should compute value if cached value is expired', async () => {
      // Set up cache with an expired test value
      const testKey = 'test-key';
      const testValue = 'test-value';
      aiHelper.cache.set(testKey, {
        value: testValue,
        timestamp: Date.now() - 3600001 // 1 hour + 1 ms ago (expired)
      });
      
      // Mock compute function
      const computeFunc = jest.fn().mockResolvedValue('computed-value');
      
      // Call getOrCompute
      const result = await aiHelper.getOrCompute(testKey, computeFunc);
      
      // Check result
      expect(result).toBe('computed-value');
      expect(computeFunc).toHaveBeenCalled();
    });
    
    it('should cache computed value if caching is enabled', async () => {
      // Mock compute function
      const testKey = 'test-key';
      const computeFunc = jest.fn().mockResolvedValue('computed-value');
      
      // Call getOrCompute
      await aiHelper.getOrCompute(testKey, computeFunc);
      
      // Check cache
      expect(aiHelper.cache.has(testKey)).toBe(true);
      const cachedItem = aiHelper.cache.get(testKey);
      expect(cachedItem.value).toBe('computed-value');
      expect(cachedItem.timestamp).toBeCloseTo(Date.now(), -3); // Within 1 second
    });
  });
  
  describe('predictToolsForServer()', () => {
    it('should return empty array if AI is not available', async () => {
      // Disable AI
      aiHelper.openai = null;
      
      // Call predictToolsForServer
      const result = await aiHelper.predictToolsForServer('test-server');
      
      // Check result
      expect(result).toEqual([]);
    });
    
    it('should call OpenAI API and parse JSON response', async () => {
      // Mock OpenAI response
      const mockResponse = {
        choices: [
          {
            message: {
              content: '["tool1", "tool2", "tool3"]'
            }
          }
        ]
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      // Call predictToolsForServer
      const result = await aiHelper.predictToolsForServer('test-server');
      
      // Check result
      expect(result).toEqual(['tool1', 'tool2', 'tool3']);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      
      // Check prompt contains server name
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('test-server');
    });
    
    it('should handle non-JSON response using regex', async () => {
      // Mock OpenAI response with non-JSON content
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Here are some tools: "tool1", "tool2", "tool3"'
            }
          }
        ]
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      // Call predictToolsForServer
      const result = await aiHelper.predictToolsForServer('test-server');
      
      // Check result
      expect(result).toEqual(['tool1', 'tool2', 'tool3']);
    });
    
    it('should handle API errors gracefully', async () => {
      // Mock OpenAI error
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));
      
      // Call predictToolsForServer
      const result = await aiHelper.predictToolsForServer('test-server');
      
      // Check result
      expect(result).toEqual([]);
    });
  });
  
  describe('generateToolDescription()', () => {
    it('should return default description if AI is not available', async () => {
      // Disable AI
      aiHelper.openai = null;
      
      // Call generateToolDescription
      const result = await aiHelper.generateToolDescription('test-tool', 'test-server');
      
      // Check result
      expect(result).toBe('No description available.');
    });
    
    it('should call OpenAI API and return description', async () => {
      // Mock OpenAI response
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is a test tool description.'
            }
          }
        ]
      };
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      // Call generateToolDescription
      const result = await aiHelper.generateToolDescription('test-tool', 'test-server');
      
      // Check result
      expect(result).toBe('This is a test tool description.');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      
      // Check prompt contains tool name and server ID
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('test-tool');
      expect(callArgs.messages[1].content).toContain('test-server');
    });
    
    it('should handle API errors gracefully', async () => {
      // Mock OpenAI error
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));
      
      // Call generateToolDescription
      const result = await aiHelper.generateToolDescription('test-tool', 'test-server');
      
      // Check result
      expect(result).toBe('No description available.');
    });
  });
  
  describe('clearCache()', () => {
    it('should clear the cache', () => {
      // Set up cache with a test value
      const testKey = 'test-key';
      const testValue = 'test-value';
      aiHelper.cache.set(testKey, {
        value: testValue,
        timestamp: Date.now()
      });
      
      // Call clearCache
      aiHelper.clearCache();
      
      // Check cache
      expect(aiHelper.cache.size).toBe(0);
      expect(aiHelper.cache.has(testKey)).toBe(false);
    });
  });
});
