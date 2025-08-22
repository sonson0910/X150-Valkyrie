/**
 * IntelligentCache Test Suite
 * 
 * Tests the core caching functionality including:
 * - Cache strategies
 * - TTL handling
 * - Memory management
 * - Background sync
 */

import { IntelligentCacheManager, CacheStrategy, CachePriority } from '../../utils/IntelligentCache';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('IntelligentCacheManager', () => {
  let cacheManager: IntelligentCacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = IntelligentCacheManager.getInstance();
  });

  afterEach(async () => {
    await cacheManager.clearAll();
  });

  describe('Cache Strategy Tests', () => {
    it('should handle CACHE_FIRST strategy correctly', async () => {
      const key = 'test-cache-first';
      const testData = { value: 'test-data' };
      const fetchFunction = jest.fn(() => Promise.resolve(testData));

      // First call should fetch from network
      const result1 = await cacheManager.get(key, fetchFunction, {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 5000
      });

      expect(result1).toEqual(testData);
      expect(fetchFunction).toHaveBeenCalledTimes(1);

      // Second call should return from cache
      const result2 = await cacheManager.get(key, fetchFunction, {
        strategy: CacheStrategy.CACHE_FIRST,
        ttl: 5000
      });

      expect(result2).toEqual(testData);
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Should not call again
    });

    it('should handle NETWORK_FIRST strategy correctly', async () => {
      const key = 'test-network-first';
      const testData = { value: 'test-data' };
      const fetchFunction = jest.fn(() => Promise.resolve(testData));

      const result = await cacheManager.get(key, fetchFunction, {
        strategy: CacheStrategy.NETWORK_FIRST,
        ttl: 5000
      });

      expect(result).toEqual(testData);
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle CACHE_ONLY strategy correctly', async () => {
      const key = 'test-cache-only';
      const testData = { value: 'test-data' };

      // Set data first
      await cacheManager.set(key, testData, { ttl: 5000 });

      // Get with CACHE_ONLY should return cached data
      const result = await cacheManager.get(key, undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });

      expect(result).toEqual(testData);
    });
  });

  describe('TTL and Expiration Tests', () => {
    it('should respect TTL and expire cached data', async () => {
      const key = 'test-ttl';
      const testData = { value: 'test-data' };

      // Set data with very short TTL
      await cacheManager.set(key, testData, { ttl: 1 }); // 1ms TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await cacheManager.get(key, undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });

      expect(result).toBeNull();
    });

    it('should return fresh data when TTL is valid', async () => {
      const key = 'test-valid-ttl';
      const testData = { value: 'test-data' };

      // Set data with long TTL
      await cacheManager.set(key, testData, { ttl: 60000 }); // 1 minute

      const result = await cacheManager.get(key, undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });

      expect(result).toEqual(testData);
    });
  });

  describe('Priority and Eviction Tests', () => {
    it('should respect cache priorities during eviction', async () => {
      const criticalData = { value: 'critical' };
      const lowData = { value: 'low-priority' };

      // Set critical priority data
      await cacheManager.set('critical-key', criticalData, {
        priority: CachePriority.CRITICAL,
        ttl: 60000
      });

      // Set low priority data
      await cacheManager.set('low-key', lowData, {
        priority: CachePriority.LOW,
        ttl: 60000
      });

      // Critical data should still be accessible
      const criticalResult = await cacheManager.get('critical-key', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });

      expect(criticalResult).toEqual(criticalData);
    });
  });

  describe('Cache Invalidation Tests', () => {
    it('should invalidate cache by key pattern', async () => {
      const testData1 = { value: 'data1' };
      const testData2 = { value: 'data2' };

      await cacheManager.set('user:123:profile', testData1, { ttl: 60000 });
      await cacheManager.set('user:123:settings', testData2, { ttl: 60000 });
      await cacheManager.set('user:456:profile', testData1, { ttl: 60000 });

      // Invalidate all user:123 data
      await cacheManager.invalidate(/^user:123:/);

      // user:123 data should be gone
      const result1 = await cacheManager.get('user:123:profile', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });
      expect(result1).toBeNull();

      // user:456 data should still exist
      const result2 = await cacheManager.get('user:456:profile', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });
      expect(result2).toEqual(testData1);
    });

    it('should invalidate cache by tags', async () => {
      const testData = { value: 'tagged-data' };

      await cacheManager.set('tagged-key', testData, {
        ttl: 60000,
        tags: ['user', 'profile']
      });

      await cacheManager.set('other-key', testData, {
        ttl: 60000,
        tags: ['system']
      });

      // Invalidate by tag
      await cacheManager.invalidate('', ['user']);

      // Tagged data should be gone
      const result1 = await cacheManager.get('tagged-key', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });
      expect(result1).toBeNull();

      // Other data should still exist
      const result2 = await cacheManager.get('other-key', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });
      expect(result2).toEqual(testData);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle fetch function errors gracefully', async () => {
      const key = 'test-error';
      const fetchFunction = jest.fn(() => Promise.reject(new Error('Network error')));

      const result = await cacheManager.get(key, fetchFunction, {
        strategy: CacheStrategy.CACHE_FIRST
      });

      expect(result).toBeNull();
      expect(fetchFunction).toHaveBeenCalledTimes(1);
    });

    it('should return cached data when fetch fails', async () => {
      const key = 'test-fallback';
      const cachedData = { value: 'cached-data' };
      const fetchFunction = jest.fn(() => Promise.reject(new Error('Network error')));

      // Set cached data first
      await cacheManager.set(key, cachedData, { ttl: 60000 });

      const result = await cacheManager.get(key, fetchFunction, {
        strategy: CacheStrategy.NETWORK_FIRST
      });

      // Should fallback to cached data
      expect(result).toEqual(cachedData);
    });
  });

  describe('Statistics Tests', () => {
    it('should track cache statistics correctly', async () => {
      const key = 'test-stats';
      const testData = { value: 'test-data' };
      const fetchFunction = jest.fn(() => Promise.resolve(testData));

      // Generate some cache activity
      await cacheManager.get(key, fetchFunction);
      await cacheManager.get(key, fetchFunction); // Cache hit
      await cacheManager.get('missing-key', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      }); // Cache miss

      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('memoryCache');
      expect(stats).toHaveProperty('storageCache');
      expect(stats.memoryCache.count).toBeGreaterThan(0);
      expect(stats.memoryCache.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Cache Warmup Tests', () => {
    it('should warm up cache with provided entries', async () => {
      const entries = [
        {
          key: 'warmup-1',
          fetchFunction: () => Promise.resolve({ value: 'warmed-1' }),
          options: { priority: CachePriority.HIGH }
        },
        {
          key: 'warmup-2',
          fetchFunction: () => Promise.resolve({ value: 'warmed-2' }),
          options: { priority: CachePriority.HIGH }
        }
      ];

      await cacheManager.warmup(entries);

      // Check if data was warmed up
      const result1 = await cacheManager.get('warmup-1', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });
      const result2 = await cacheManager.get('warmup-2', undefined, {
        strategy: CacheStrategy.CACHE_ONLY
      });

      expect(result1).toEqual({ value: 'warmed-1' });
      expect(result2).toEqual({ value: 'warmed-2' });
    });
  });
});

