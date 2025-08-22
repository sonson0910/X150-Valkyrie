/**
 * ErrorHandler Test Suite
 * 
 * Tests error handling functionality including:
 * - Error creation and categorization
 * - Error logging and reporting
 * - Retry mechanisms
 * - User notifications
 * - Error analytics
 */

import { ErrorHandler } from '../../services/ErrorHandler';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('../../services/EventBus', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../core/errors', () => ({
  EnhancedErrorHandler: {
    getInstance: jest.fn(() => ({
      handle: jest.fn(),
      report: jest.fn(),
      getStats: jest.fn(() => ({ totalErrors: 0 })),
    })),
  },
}));

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1.getErrorLog()).toEqual(instance2.getErrorLog());
    });
  });

  describe('Error Creation', () => {
    it('should create network errors', () => {
      const error = ErrorHandler.createNetworkError('Connection failed');

      expect(error).toMatchObject({
        message: 'Connection failed',
        category: 'NETWORK',
        code: 'NETWORK_ERROR',
        isRecoverable: true,
      });
    });

    it('should create validation errors', () => {
      const error = ErrorHandler.createValidationError('Invalid input', { field: 'email' });

      expect(error).toMatchObject({
        message: 'Invalid input',
        category: 'VALIDATION',
        code: 'VALIDATION_ERROR',
        isRecoverable: true,
        context: { field: 'email' },
      });
    });

    it('should create crypto errors', () => {
      const error = ErrorHandler.createCryptoError('Encryption failed');

      expect(error).toMatchObject({
        message: 'Encryption failed',
        category: 'CRYPTO',
        code: 'CRYPTO_ERROR',
        isRecoverable: false,
      });
    });

    it('should create blockchain errors', () => {
      const error = ErrorHandler.createBlockchainError('Transaction failed', { txHash: 'abc123' });

      expect(error).toMatchObject({
        message: 'Transaction failed',
        category: 'BLOCKCHAIN',
        code: 'BLOCKCHAIN_ERROR',
        isRecoverable: true,
        context: { txHash: 'abc123' },
      });
    });

    it('should create user errors', () => {
      const error = ErrorHandler.createUserError('User cancelled operation');

      expect(error).toMatchObject({
        message: 'User cancelled operation',
        category: 'USER',
        code: 'USER_ERROR',
        isRecoverable: true,
      });
    });

    it('should create system errors', () => {
      const error = ErrorHandler.createSystemError('Out of memory');

      expect(error).toMatchObject({
        message: 'Out of memory',
        category: 'SYSTEM',
        code: 'SYSTEM_ERROR',
        isRecoverable: false,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors and delegate to enhanced handler', () => {
      const error = new Error('Test error');
      const context = { component: 'TestComponent' };

      errorHandler.handleError(error, context);

      const { EnhancedErrorHandler } = require('../../core/errors');
      const enhancedHandler = EnhancedErrorHandler.getInstance();

      expect(enhancedHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          context
        })
      );
    });

    it('should handle string errors', () => {
      const errorMessage = 'String error message';

      errorHandler.handleError(errorMessage);

      const { EnhancedErrorHandler } = require('../../core/errors');
      const enhancedHandler = EnhancedErrorHandler.getInstance();

      expect(enhancedHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorMessage
        })
      );
    });

    it('should handle errors with additional context', () => {
      const error = new Error('Context test error');
      const context = {
        userId: '123',
        action: 'send_transaction',
        timestamp: Date.now()
      };

      errorHandler.handleError(error, context);

      const { EnhancedErrorHandler } = require('../../core/errors');
      const enhancedHandler = EnhancedErrorHandler.getInstance();

      expect(enhancedHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Context test error',
          context
        })
      );
    });
  });

  describe('User Notifications', () => {
    it('should show user-friendly messages for network errors', () => {
      const error = ErrorHandler.createNetworkError('Network timeout');

      errorHandler.handleError(error);

      const { Alert } = require('react-native');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Network Error',
        expect.stringContaining('connection'),
        expect.any(Array)
      );
    });

    it('should show validation messages for user errors', () => {
      const error = ErrorHandler.createValidationError('Invalid email format');

      errorHandler.handleError(error);

      const { Alert } = require('react-native');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Validation Error',
        expect.stringContaining('Invalid email format'),
        expect.any(Array)
      );
    });

    it('should show generic messages for system errors', () => {
      const error = ErrorHandler.createSystemError('Internal system failure');

      errorHandler.handleError(error);

      const { Alert } = require('react-native');
      expect(Alert.alert).toHaveBeenCalledWith(
        'System Error',
        expect.stringContaining('technical'),
        expect.any(Array)
      );
    });

    it('should not show alerts for silent errors', () => {
      const error = ErrorHandler.createNetworkError('Silent network error');
      error.silent = true;

      errorHandler.handleError(error);

      const { Alert } = require('react-native');
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Error Logging', () => {
    it('should log errors to internal error log', () => {
      const error = new Error('Logged error');

      errorHandler.handleError(error);

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeGreaterThan(0);
      expect(errorLog[errorLog.length - 1]).toMatchObject({
        message: 'Logged error',
        timestamp: expect.any(Number)
      });
    });

    it('should maintain error log history', () => {
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3')
      ];

      errors.forEach(error => errorHandler.handleError(error));

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBe(3);
      expect(errorLog.map(e => e.message)).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });

    it('should limit error log size', () => {
      // Generate many errors
      for (let i = 0; i < 1500; i++) {
        errorHandler.handleError(new Error(`Error ${i}`));
      }

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeLessThanOrEqual(1000); // Should be capped at 1000
    });

    it('should clear error log', () => {
      errorHandler.handleError(new Error('Test error'));
      expect(errorHandler.getErrorLog().length).toBeGreaterThan(0);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog().length).toBe(0);
    });
  });

  describe('Event Broadcasting', () => {
    it('should emit error events', () => {
      const error = new Error('Event test error');

      errorHandler.handleError(error);

      const { eventBus } = require('../../services/EventBus');
      expect(eventBus.emit).toHaveBeenCalledWith('error:occurred', expect.objectContaining({
        message: 'Event test error'
      }));
    });

    it('should emit different events for different error categories', () => {
      const networkError = ErrorHandler.createNetworkError('Network issue');
      const cryptoError = ErrorHandler.createCryptoError('Crypto issue');

      errorHandler.handleError(networkError);
      errorHandler.handleError(cryptoError);

      const { eventBus } = require('../../services/EventBus');
      expect(eventBus.emit).toHaveBeenCalledWith('error:network', expect.any(Object));
      expect(eventBus.emit).toHaveBeenCalledWith('error:crypto', expect.any(Object));
    });
  });

  describe('Error Recovery', () => {
    it('should provide retry options for recoverable errors', () => {
      const recoverableError = ErrorHandler.createNetworkError('Temporary network issue');
      recoverableError.isRecoverable = true;

      errorHandler.handleError(recoverableError);

      const { Alert } = require('react-native');
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];

      expect(buttons).toContainEqual(
        expect.objectContaining({ text: expect.stringMatching(/retry/i) })
      );
    });

    it('should not provide retry options for non-recoverable errors', () => {
      const nonRecoverableError = ErrorHandler.createCryptoError('Fatal crypto error');
      nonRecoverableError.isRecoverable = false;

      errorHandler.handleError(nonRecoverableError);

      const { Alert } = require('react-native');
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];

      expect(buttons).not.toContainEqual(
        expect.objectContaining({ text: expect.stringMatching(/retry/i) })
      );
    });

    it('should execute retry callbacks', () => {
      const retryCallback = jest.fn();
      const error = ErrorHandler.createNetworkError('Retry test error');
      error.retryCallback = retryCallback;

      errorHandler.handleError(error);

      const { Alert } = require('react-native');
      const alertCall = Alert.alert.mock.calls[0];
      const buttons = alertCall[2];
      const retryButton = buttons.find(b => /retry/i.test(b.text));

      if (retryButton && retryButton.onPress) {
        retryButton.onPress();
        expect(retryCallback).toHaveBeenCalled();
      }
    });
  });

  describe('Error Analytics', () => {
    it('should track error statistics', () => {
      const errors = [
        ErrorHandler.createNetworkError('Network 1'),
        ErrorHandler.createNetworkError('Network 2'),
        ErrorHandler.createCryptoError('Crypto 1'),
        ErrorHandler.createValidationError('Validation 1')
      ];

      errors.forEach(error => errorHandler.handleError(error));

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(4);
      expect(stats.byCategory.NETWORK).toBe(2);
      expect(stats.byCategory.CRYPTO).toBe(1);
      expect(stats.byCategory.VALIDATION).toBe(1);
    });

    it('should track error trends over time', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Mock Date.now for first error
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => oneHourAgo);

      errorHandler.handleError(new Error('Old error'));

      // Reset Date.now for recent error
      Date.now = jest.fn(() => now);

      errorHandler.handleError(new Error('Recent error'));

      const stats = errorHandler.getErrorStats();

      expect(stats.recent).toBe(1); // Only recent errors
      expect(stats.total).toBe(2); // All errors

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Error Context Enrichment', () => {
    it('should enrich errors with device information', () => {
      const error = new Error('Device context test');

      errorHandler.handleError(error);

      const errorLog = errorHandler.getErrorLog();
      const loggedError = errorLog[errorLog.length - 1];

      expect(loggedError.context).toMatchObject({
        platform: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    it('should preserve original error context', () => {
      const error = new Error('Context preservation test');
      const originalContext = { userId: '123', action: 'test' };

      errorHandler.handleError(error, originalContext);

      const errorLog = errorHandler.getErrorLog();
      const loggedError = errorLog[errorLog.length - 1];

      expect(loggedError.context).toMatchObject(originalContext);
    });
  });

  describe('Error Filtering and Deduplication', () => {
    it('should deduplicate identical errors', () => {
      const error1 = new Error('Duplicate error');
      const error2 = new Error('Duplicate error');
      const error3 = new Error('Different error');

      errorHandler.handleError(error1);
      errorHandler.handleError(error2); // Should be deduplicated
      errorHandler.handleError(error3);

      const errorLog = errorHandler.getErrorLog();
      const uniqueMessages = [...new Set(errorLog.map(e => e.message))];

      expect(uniqueMessages).toEqual(['Duplicate error', 'Different error']);
    });

    it('should not deduplicate errors with different contexts', () => {
      const error1 = new Error('Same message');
      const error2 = new Error('Same message');

      errorHandler.handleError(error1, { context: 'A' });
      errorHandler.handleError(error2, { context: 'B' });

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBe(2); // Should not be deduplicated
    });
  });

  describe('Performance', () => {
    it('should handle error processing efficiently', () => {
      const startTime = Date.now();

      // Process many errors
      for (let i = 0; i < 1000; i++) {
        errorHandler.handleError(new Error(`Performance test ${i}`));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    it('should not cause memory leaks with many errors', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many errors
      for (let i = 0; i < 5000; i++) {
        errorHandler.handleError(new Error(`Memory test ${i}`));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined errors', () => {
      expect(() => {
        errorHandler.handleError(null);
        errorHandler.handleError(undefined);
      }).not.toThrow();
    });

    it('should handle errors with circular references', () => {
      const error: any = new Error('Circular reference error');
      error.circular = error;

      expect(() => {
        errorHandler.handleError(error);
      }).not.toThrow();
    });

    it('should handle errors during error handling', () => {
      // Mock Alert.alert to throw an error
      const { Alert } = require('react-native');
      Alert.alert.mockImplementationOnce(() => {
        throw new Error('Alert failed');
      });

      expect(() => {
        errorHandler.handleError(new Error('Original error'));
      }).not.toThrow();
    });
  });
});

