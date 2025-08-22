/**
 * ApiResponseCache Test Suite
 * 
 * Tests the API response caching functionality including:
 * - Cache strategies for different endpoints
 * - Request deduplication
 * - Rate limiting
 * - Cache invalidation
 */

import { ApiResponseCacheService } from '../../../services/cache/ApiResponseCache';
import { CacheStrategy, CachePriority } from '../../../utils/IntelligentCache';

// Mock NetworkService
jest.mock('../../../services/NetworkService', () => ({
  NetworkService: {
    getInstance: () => ({
      makeRequest: jest.fn(),
    }),
  },
}));

describe('ApiResponseCacheService', () => {
  let apiCache: ApiResponseCacheService;

  beforeEach(() => {
    apiCache = ApiResponseCacheService.getInstance({
      baseUrl: 'https://api.test.com',
      defaultTtl: 5000,
      maxRetries: 3,
      enableDeduplication: true,
    });
  });

  afterEach(async () => {
    await apiCache.clearCache();
  });

  describe('Basic API Requests', () => {
    it('should make successful API requests', async () => {
      const mockResponse = {
        data: { address: 'addr1test', balance: '1000000' },
        status: 200,
        headers: {},
      };

      // Mock network service
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue(mockResponse);

      const response = await apiCache.request('/accounts/addr1test');

      expect(response.data).toEqual(mockResponse.data);
      expect(response.status).toBe(200);
      expect(response.fromCache).toBe(false);
      expect(networkService.makeRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle API request failures', async () => {
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockRejectedValue(new Error('Network error'));

      await expect(apiCache.request('/accounts/invalid')).rejects.toThrow('Network error');
    });
  });

  describe('Cache Strategies', () => {
    it('should cache responses and return from cache on subsequent requests', async () => {
      const mockResponse = {
        data: { address: 'addr1test', balance: '1000000' },
        status: 200,
        headers: {},
      };

      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue(mockResponse);

      // First request should hit network
      const response1 = await apiCache.request('/accounts/addr1test', {
        cache: { strategy: CacheStrategy.CACHE_FIRST, ttl: 10000 }
      });

      expect(response1.fromCache).toBe(false);
      expect(networkService.makeRequest).toHaveBeenCalledTimes(1);

      // Second request should return from cache
      const response2 = await apiCache.request('/accounts/addr1test', {
        cache: { strategy: CacheStrategy.CACHE_FIRST, ttl: 10000 }
      });

      expect(response2.fromCache).toBe(true);
      expect(response2.data).toEqual(mockResponse.data);
      expect(networkService.makeRequest).toHaveBeenCalledTimes(1); // No additional network call
    });

    it('should bypass cache when requested', async () => {
      const mockResponse = {
        data: { address: 'addr1test', balance: '2000000' },
        status: 200,
        headers: {},
      };

      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue(mockResponse);

      // Make cached request first
      await apiCache.request('/accounts/addr1test');

      // Bypass cache
      const response = await apiCache.request('/accounts/addr1test', {
        bypassCache: true
      });

      expect(response.fromCache).toBe(false);
      expect(networkService.makeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('Specialized API Methods', () => {
    beforeEach(() => {
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        headers: {},
      });
    });

    it('should handle account info requests with appropriate caching', async () => {
      const response = await apiCache.getAccountInfo('addr1test');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle transaction info requests with long-term caching', async () => {
      const response = await apiCache.getTransactionInfo('tx123');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle UTXO requests with frequent refresh', async () => {
      const response = await apiCache.getAccountUtxos('addr1test');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle block info requests with medium-term caching', async () => {
      const response = await apiCache.getBlockInfo('block123');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle pool info requests with long-term caching', async () => {
      const response = await apiCache.getPoolInfo('pool123');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle asset metadata requests with very long-term caching', async () => {
      const response = await apiCache.getAssetMetadata('asset123');

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });

    it('should handle asset price requests with short-term caching', async () => {
      const response = await apiCache.getAssetPrices(['ADA', 'BTC']);

      expect(response.data).toBeDefined();
      expect(response.fromCache).toBeDefined();
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical concurrent requests', async () => {
      const mockResponse = {
        data: { address: 'addr1test', balance: '1000000' },
        status: 200,
        headers: {},
      };

      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue(mockResponse);

      // Make multiple concurrent requests
      const promises = [
        apiCache.request('/accounts/addr1test'),
        apiCache.request('/accounts/addr1test'),
        apiCache.request('/accounts/addr1test'),
      ];

      const responses = await Promise.all(promises);

      // All responses should be identical
      responses.forEach(response => {
        expect(response.data).toEqual(mockResponse.data);
      });

      // Network should only be called once due to deduplication
      expect(networkService.makeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      // Configure with very low rate limit for testing
      const limitedCache = ApiResponseCacheService.getInstance({
        baseUrl: 'https://api.test.com',
        maxRequestsPerMinute: 2,
      });

      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        headers: {},
      });

      // First two requests should succeed
      await limitedCache.request('/test1');
      await limitedCache.request('/test2');

      // Third request should be rate limited
      await expect(limitedCache.request('/test3')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        headers: {},
      });

      // Set up some cached data
      await apiCache.request('/accounts/addr1test');
      await apiCache.request('/accounts/addr2test');
      await apiCache.request('/txs/tx123');
    });

    it('should invalidate cache by pattern', async () => {
      await apiCache.invalidate(/^\/accounts\//);

      // Account data should be invalidated
      const accountResponse = await apiCache.getCached('/accounts/addr1test');
      expect(accountResponse).toBeNull();

      // Transaction data should still be cached
      const txResponse = await apiCache.getCached('/txs/tx123');
      expect(txResponse).not.toBeNull();
    });

    it('should invalidate cache by exact key', async () => {
      await apiCache.invalidate('/accounts/addr1test');

      // Specific account should be invalidated
      const response1 = await apiCache.getCached('/accounts/addr1test');
      expect(response1).toBeNull();

      // Other account should still be cached
      const response2 = await apiCache.getCached('/accounts/addr2test');
      expect(response2).not.toBeNull();
    });
  });

  describe('Cache Preloading', () => {
    it('should preload critical endpoints', async () => {
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        headers: {},
      });

      const endpoints = [
        { endpoint: '/network' },
        { endpoint: '/epochs/latest' },
        { endpoint: '/accounts/addr1test' },
      ];

      await apiCache.preload(endpoints);

      // All endpoints should be cached
      for (const { endpoint } of endpoints) {
        const response = await apiCache.getCached(endpoint);
        expect(response).not.toBeNull();
      }

      expect(networkService.makeRequest).toHaveBeenCalledTimes(endpoints.length);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track cache statistics', async () => {
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest.mockResolvedValue({
        data: { test: 'data' },
        status: 200,
        headers: {},
      });

      // Generate some cache activity
      await apiCache.request('/test1');
      await apiCache.request('/test1'); // Cache hit
      await apiCache.request('/test2');

      const stats = apiCache.getStats();

      expect(stats).toHaveProperty('pendingRequests');
      expect(stats).toHaveProperty('rateLimitedEndpoints');
      expect(typeof stats.pendingRequests).toBe('number');
      expect(Array.isArray(stats.rateLimitedEndpoints)).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should return stale cache data when network fails', async () => {
      const cachedData = { address: 'addr1test', balance: '1000000' };
      
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      
      // First request succeeds and caches data
      networkService.makeRequest.mockResolvedValueOnce({
        data: cachedData,
        status: 200,
        headers: {},
      });

      await apiCache.request('/accounts/addr1test');

      // Second request fails
      networkService.makeRequest.mockRejectedValueOnce(new Error('Network error'));

      const response = await apiCache.request('/accounts/addr1test');

      expect(response.data).toEqual(cachedData);
      expect(response.fromCache).toBe(true);
    });
  });
});

