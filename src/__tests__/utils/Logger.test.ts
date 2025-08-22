/**
 * Logger Test Suite
 * 
 * Tests logging functionality including:
 * - Different log levels
 * - Environment-specific behavior
 * - Error handling
 * - Performance logging
 */

import Logger from '../../utils/Logger';

// Mock environment
jest.mock('../../config/Environment', () => ({
  environment: {
    isProduction: jest.fn(() => false),
    isDevelopment: jest.fn(() => true),
    isTest: jest.fn(() => true),
    get: jest.fn((key) => {
      const config = {
        'ENVIRONMENT': 'test',
        'APP_NAME': 'Test App',
        'APP_VERSION': '1.0.0-test',
      };
      return config[key] || null;
    }),
  },
}));

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      Logger.info('Test info message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Test info message')
      );
    });

    it('should log warning messages', () => {
      Logger.warn('Test warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        expect.stringContaining('Test warning message')
      );
    });

    it('should log error messages', () => {
      Logger.error('Test error message');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Test error message')
      );
    });

    it('should log debug messages', () => {
      Logger.debug('Test debug message');

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('Test debug message')
      );
    });

    it('should log general messages', () => {
      Logger.log('Test general message');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[LOG]'),
        expect.stringContaining('Test general message')
      );
    });
  });

  describe('Message Formatting', () => {
    it('should include timestamp in log messages', () => {
      Logger.info('Test message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        expect.any(String)
      );
    });

    it('should include log level in messages', () => {
      Logger.error('Test error');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.any(String)
      );
    });

    it('should format messages consistently', () => {
      Logger.warn('Consistent formatting test');

      const call = consoleSpy.warn.mock.calls[0];
      const logMessage = call[0];

      // Check format: timestamp [LEVEL] message
      expect(logMessage).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[WARN\]/);
    });
  });

  describe('Error Object Handling', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error object');
      error.stack = 'Error stack trace';

      Logger.error('Error occurred', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Error occurred'),
        expect.objectContaining({
          message: 'Test error object',
          stack: 'Error stack trace'
        })
      );
    });

    it('should handle custom error objects', () => {
      const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        code: 'CUSTOM_ERR_001'
      };

      Logger.error('Custom error occurred', customError);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Custom error occurred'),
        expect.objectContaining({
          name: 'CustomError',
          message: 'Custom error message',
          code: 'CUSTOM_ERR_001'
        })
      );
    });

    it('should handle null and undefined errors gracefully', () => {
      Logger.error('Null error', null);
      Logger.error('Undefined error', undefined);

      expect(consoleSpy.error).toHaveBeenCalledTimes(2);
      expect(consoleSpy.error).toHaveBeenNthCalledWith(1,
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Null error'),
        null
      );
      expect(consoleSpy.error).toHaveBeenNthCalledWith(2,
        expect.stringContaining('[ERROR]'),
        expect.stringContaining('Undefined error'),
        undefined
      );
    });
  });

  describe('Multiple Arguments', () => {
    it('should handle multiple arguments', () => {
      const obj = { key: 'value' };
      const array = [1, 2, 3];

      Logger.info('Multiple args test', obj, array, 'string', 123);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Multiple args test'),
        obj,
        array,
        'string',
        123
      );
    });

    it('should handle empty arguments', () => {
      Logger.info();

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('')
      );
    });

    it('should handle complex objects', () => {
      const complexObj = {
        nested: {
          property: 'value',
          array: [1, { inner: true }],
          func: () => 'test'
        },
        circular: null as any
      };
      complexObj.circular = complexObj; // Create circular reference

      Logger.debug('Complex object test', complexObj);

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('Complex object test'),
        complexObj
      );
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should log differently in production', () => {
      // Mock production environment
      const { environment } = require('../../config/Environment');
      environment.isProduction.mockReturnValue(true);
      environment.isDevelopment.mockReturnValue(false);

      Logger.debug('Production debug message');

      // In production, debug messages might be suppressed
      // This depends on the actual implementation
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should include additional context in development', () => {
      // Mock development environment
      const { environment } = require('../../config/Environment');
      environment.isProduction.mockReturnValue(false);
      environment.isDevelopment.mockReturnValue(true);

      Logger.info('Development info message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Development info message')
      );
    });
  });

  describe('Performance', () => {
    it('should handle high volume logging efficiently', () => {
      const startTime = Date.now();

      // Log 1000 messages
      for (let i = 0; i < 1000; i++) {
        Logger.info(`Performance test message ${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
      expect(consoleSpy.info).toHaveBeenCalledTimes(1000);
    });

    it('should handle large objects without performance issues', () => {
      const largeObject = {
        data: new Array(10000).fill(0).map((_, i) => ({
          id: i,
          value: `item-${i}`,
          nested: { prop: i * 2 }
        }))
      };

      const startTime = Date.now();
      Logger.info('Large object test', largeObject);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Large object test'),
        largeObject
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle logging when console methods are undefined', () => {
      // Mock console.info as undefined
      const originalInfo = console.info;
      delete (console as any).info;

      expect(() => {
        Logger.info('Test message with undefined console.info');
      }).not.toThrow();

      // Restore console.info
      (console as any).info = originalInfo;
    });

    it('should handle circular references in objects', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      expect(() => {
        Logger.info('Circular reference test', obj);
      }).not.toThrow();

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining('Circular reference test'),
        obj
      );
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        Logger.info(longMessage);
      }).not.toThrow();

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining(longMessage)
      );
    });

    it('should handle special characters and unicode', () => {
      const specialMessage = '🔐 Special chars: \n\t\r\\ "quotes" & symbols! 中文 العربية';

      Logger.info(specialMessage);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.stringContaining(specialMessage)
      );
    });
  });

  describe('Thread Safety and Concurrency', () => {
    it('should handle concurrent logging safely', async () => {
      const promises = Array(100).fill(0).map(async (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            Logger.info(`Concurrent log ${i}`);
            resolve();
          }, Math.random() * 10);
        });
      });

      await Promise.all(promises);

      expect(consoleSpy.info).toHaveBeenCalledTimes(100);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated logging', () => {
      // This is more of a conceptual test since we can't easily measure memory in Jest
      const initialMemory = process.memoryUsage().heapUsed;

      // Log many messages
      for (let i = 0; i < 10000; i++) {
        Logger.info(`Memory test ${i}`, { data: new Array(100).fill(i) });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

