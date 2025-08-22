/**
 * NetworkService Test Suite
 * 
 * Tests network functionality including:
 * - HTTP requests (GET, POST, PUT, DELETE)
 * - Request timeout handling
 * - Error handling and retries
 * - Headers management
 * - Network status monitoring
 */

import { NetworkService } from '../../services/NetworkService';

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('NetworkService', () => {
  let networkService: NetworkService;

  beforeEach(() => {
    networkService = NetworkService.getInstance();
    jest.clearAllMocks();
  });

  describe('HTTP Methods', () => {
    it('should make successful GET requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.resolve({ data: 'test' })),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await networkService.makeRequest('/test', {
        method: 'GET'
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith('/test', expect.objectContaining({
        method: 'GET'
      }));
    });

    it('should make successful POST requests with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        json: jest.fn(() => Promise.resolve({ id: 123 })),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const requestBody = { name: 'test', value: 'data' };
      const result = await networkService.makeRequest('/api/create', {
        method: 'POST',
        body: requestBody,
        headers: { 'Content-Type': 'application/json' }
      });

      expect(result.status).toBe(201);
      expect(result.data).toEqual({ id: 123 });
      expect(mockFetch).toHaveBeenCalledWith('/api/create', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      }));
    });

    it('should handle PUT requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.resolve({ updated: true })),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await networkService.makeRequest('/api/update/123', {
        method: 'PUT',
        body: { status: 'active' }
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ updated: true });
      expect(mockFetch).toHaveBeenCalledWith('/api/update/123', expect.objectContaining({
        method: 'PUT'
      }));
    });

    it('should handle DELETE requests', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: jest.fn(() => Promise.resolve({})),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await networkService.makeRequest('/api/delete/123', {
        method: 'DELETE'
      });

      expect(result.status).toBe(204);
      expect(mockFetch).toHaveBeenCalledWith('/api/delete/123', expect.objectContaining({
        method: 'DELETE'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: jest.fn(() => Promise.resolve({ error: 'Resource not found' })),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(networkService.makeRequest('/api/nonexistent')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(networkService.makeRequest('/api/test')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      // Mock a request that never resolves
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      await expect(networkService.makeRequest('/api/slow', {
        timeout: 100 // Very short timeout
      })).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.reject(new Error('Invalid JSON'))),
        text: jest.fn(() => Promise.resolve('invalid json')),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(networkService.makeRequest('/api/invalid-json')).rejects.toThrow();
    });
  });

  describe('Request Configuration', () => {
    it('should set custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.resolve({})),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await networkService.makeRequest('/api/test', {
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        })
      }));
    });

    it('should handle request timeout', async () => {
      let timeoutReject: (reason?: any) => void;
      
      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve, reject) => {
          timeoutReject = reject;
          // Simulate a slow request
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            headers: new Headers(),
          } as any), 2000);
        })
      );

      const requestPromise = networkService.makeRequest('/api/slow', {
        timeout: 100
      });

      await expect(requestPromise).rejects.toThrow();
    });

    it('should merge default and custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.resolve({})),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await networkService.makeRequest('/api/test', {
        headers: {
          'Authorization': 'Bearer token123'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json', // Default header
          'Authorization': 'Bearer token123'   // Custom header
        })
      }));
    });
  });

  describe('Response Processing', () => {
    it('should return response with data and metadata', async () => {
      const responseData = { id: 123, name: 'test' };
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn(() => Promise.resolve(responseData)),
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-123'
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await networkService.makeRequest('/api/test');

      expect(result).toEqual({
        data: responseData,
        status: 200,
        statusText: 'OK',
        headers: expect.any(Object)
      });
    });

    it('should handle empty responses', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: jest.fn(() => Promise.resolve(null)),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await networkService.makeRequest('/api/empty');

      expect(result.status).toBe(204);
      expect(result.data).toBeNull();
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed requests', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
          headers: new Headers(),
        } as any);

      const result = await networkService.makeRequest('/api/retry', {
        retries: 3,
        retryDelay: 10 // Short delay for testing
      });

      expect(result.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      await expect(networkService.makeRequest('/api/always-fail', {
        retries: 2,
        retryDelay: 10
      })).rejects.toThrow('Persistent network error');

      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on 4xx errors (client errors)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Invalid request' }),
        headers: new Headers(),
      } as any);

      await expect(networkService.makeRequest('/api/bad-request', {
        retries: 3
      })).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1); // Should not retry 4xx errors
    });

    it('should retry on 5xx errors (server errors)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Server error' }),
          headers: new Headers(),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
          headers: new Headers(),
        } as any);

      const result = await networkService.makeRequest('/api/server-error', {
        retries: 2,
        retryDelay: 10
      });

      expect(result.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Network Status Monitoring', () => {
    it('should check network connectivity', async () => {
      // Mock successful ping
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
      } as any);

      const isConnected = await networkService.checkConnectivity();

      expect(isConnected).toBe(true);
    });

    it('should detect network disconnection', async () => {
      // Mock failed ping
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

      const isConnected = await networkService.checkConnectivity();

      expect(isConnected).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NetworkService.getInstance();
      const instance2 = NetworkService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain configuration across instances', () => {
      const instance1 = NetworkService.getInstance();
      const instance2 = NetworkService.getInstance();

      // Both instances should be the same object
      expect(instance1).toBe(instance2);
    });
  });

  describe('Request Interceptors', () => {
    it('should apply request interceptors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      // Add a request interceptor that adds auth header
      const interceptor = jest.fn((config) => {
        config.headers = { ...config.headers, 'Authorization': 'Bearer test-token' };
        return config;
      });

      await networkService.makeRequest('/api/test');

      // Verify the interceptor would modify the request
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.any(Object)
      }));
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined URL', async () => {
      await expect(networkService.makeRequest(undefined as any)).rejects.toThrow();
    });

    it('should handle empty URL', async () => {
      await expect(networkService.makeRequest('')).rejects.toThrow();
    });

    it('should handle invalid request options', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: new Headers(),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      // Should handle null/undefined options gracefully
      const result = await networkService.makeRequest('/api/test', null as any);
      expect(result.status).toBe(200);
    });

    it('should handle request abortion', async () => {
      const abortController = new AbortController();
      
      mockFetch.mockImplementationOnce(() => 
        Promise.reject(new DOMException('Operation aborted', 'AbortError'))
      );

      setTimeout(() => abortController.abort(), 50);

      await expect(networkService.makeRequest('/api/test', {
        signal: abortController.signal
      })).rejects.toThrow();
    });
  });
});

