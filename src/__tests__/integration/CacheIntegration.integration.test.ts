/**
 * Cache Integration Test Suite
 * 
 * Tests the integration between caching services and wallet operations:
 * - API response caching with CardanoAPIService
 * - Wallet data caching across services
 * - Portfolio data caching and synchronization
 * - Cache invalidation and refresh strategies
 * - Performance optimization through caching
 */

import { CardanoAPIService } from '../../services/CardanoAPIService';
import { ApiResponseCacheService } from '../../services/cache/ApiResponseCache';
import { WalletDataCacheService } from '../../services/cache/WalletDataCache';
import { PortfolioDataCacheService } from '../../services/cache/PortfolioDataCache';
import { AccountManager } from '../../services/wallet/AccountManager';
import { PortfolioService } from '../../services/portfolio/PortfolioService';
import { intelligentCache } from '../../utils/IntelligentCache';
import { mockApiCacheInstance } from '../setup';

describe('Cache Integration', () => {
  let apiService: CardanoAPIService;
  let apiCache: ApiResponseCacheService;
  let walletDataCache: WalletDataCacheService;
  let portfolioDataCache: PortfolioDataCacheService;
  let accountManager: AccountManager;
  let portfolioService: PortfolioService;

  beforeEach(() => {
    apiService = CardanoAPIService.getInstance();
    apiCache = ApiResponseCacheService.getInstance({
      baseUrl: 'https://cardano-testnet.blockfrost.io/api/v0',
      defaultTtl: 30000, // 30 seconds for testing
      maxRetries: 3,
      enableDeduplication: true,
    });
    walletDataCache = WalletDataCacheService.getInstance('testnet');
    portfolioDataCache = PortfolioDataCacheService.getInstance();
    accountManager = AccountManager.getInstance('testnet');
    portfolioService = PortfolioService.getInstance();
  });

  afterEach(async () => {
    await intelligentCache.clearAll();
    await apiCache.clearCache();
    await walletDataCache.clearCache();
    await portfolioDataCache.clearCache();
  });

  describe('API Response Caching Integration', () => {
    it('should cache API responses and serve from cache on subsequent requests', async () => {
      const testAddress = 'addr1test_caching_example';
      const mockAddressInfo = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '5000000' }],
        stake_address: 'stake1u_test',
        type: 'shelley'
      };

      // Mock API cache to return expected data
      const cacheServiceSpy = jest.spyOn(mockApiCacheInstance, 'getAccountInfo')
        .mockResolvedValue({
          data: mockAddressInfo,
          fromCache: false
        });

      // First call should use cache service
      const response1 = await apiService.getAddressInfo(testAddress);
      expect(response1).toEqual(mockAddressInfo);
      expect(cacheServiceSpy).toHaveBeenCalledTimes(1);

      // Mock second call to return cached data
      cacheServiceSpy.mockResolvedValueOnce({
        data: mockAddressInfo,
        fromCache: true
      });

      // Second call should still work (cached or not)
      const response2 = await apiService.getAddressInfo(testAddress);
      expect(response2).toEqual(mockAddressInfo);
      expect(cacheServiceSpy).toHaveBeenCalledTimes(2);

      cacheServiceSpy.mockRestore();
    });

    it('should handle cache invalidation and refresh', async () => {
      const testAddress = 'addr1test_invalidation';
      const initialData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '5000000' }]
      };
      const updatedData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '7000000' }]
      };

      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      const networkServiceSpy = jest.spyOn(mockInstance, 'makeRequest')
        .mockResolvedValueOnce({
          status: 200,
          data: initialData,
          headers: {}
        })
        .mockResolvedValueOnce({
          status: 200,
          data: updatedData,
          headers: {}
        });

      // Initial request
      const response1 = await apiService.getAddressInfo(testAddress);
      expect(response1).toEqual(initialData);

      // Invalidate cache for this address
      await apiService.invalidateAddressCache(testAddress);

      // Next request should fetch fresh data
      const response2 = await apiService.getAddressInfo(testAddress);
      expect(response2).toEqual(updatedData);
      expect(networkServiceSpy).toHaveBeenCalledTimes(2);

      networkServiceSpy.mockRestore();
    });

    it('should deduplicate concurrent requests', async () => {
      const testAddress = 'addr1test_deduplication';
      const mockData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '3000000' }]
      };

      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      const networkServiceSpy = jest.spyOn(mockInstance, 'makeRequest')
        .mockResolvedValue({
          status: 200,
          data: mockData,
          headers: {}
        });

      // Make multiple concurrent requests
      const promises = Array(5).fill(0).map(() => 
        apiService.getAddressInfo(testAddress)
      );

      const responses = await Promise.all(promises);

      // All responses should be identical
      responses.forEach(response => {
        expect(response).toEqual(mockData);
      });

      // Network should only be called once due to deduplication
      expect(networkServiceSpy).toHaveBeenCalledTimes(1);

      networkServiceSpy.mockRestore();
    });
  });

  describe('Wallet Data Cache Integration', () => {
    it('should cache transaction history and account balances', async () => {
      const testAddress = 'addr1test_wallet_cache';
      const mockTransactions = {
        transactions: [
          {
            hash: 'tx_hash_1',
            block: 'block_1',
            block_time: Date.now() - 3600000, // 1 hour ago
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            fees: '200000'
          },
          {
            hash: 'tx_hash_2',
            block: 'block_2',
            block_time: Date.now() - 7200000, // 2 hours ago
            amount: [{ unit: 'lovelace', quantity: '-1000000' }],
            fees: '180000'
          }
        ],
        totalCount: 2
      };

      const mockBalance = {
        confirmed: '5000000',
        unconfirmed: '0'
      };

      // Mock API responses
      jest.spyOn(apiService, 'getAddressTransactions').mockResolvedValue(mockTransactions.transactions);
      jest.spyOn(apiService, 'getAddressInfo').mockResolvedValue({
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: mockBalance.confirmed }]
      });

      // First request should fetch and cache data
      const txHistory1 = await walletDataCache.getTransactionHistory(testAddress);
      expect(txHistory1.data.transactions).toHaveLength(2);
      expect(txHistory1.syncStatus).toBe('synced');

      const balance1 = await walletDataCache.getAccountBalance(testAddress);
      expect(balance1.data.confirmed).toBe('5000000');

      // Subsequent requests should return cached data (faster)
      const startTime = Date.now();
      const txHistory2 = await walletDataCache.getTransactionHistory(testAddress);
      const balance2 = await walletDataCache.getAccountBalance(testAddress);
      const endTime = Date.now();

      // Should be very fast (from cache)
      expect(endTime - startTime).toBeLessThan(50);
      expect(txHistory2.data).toEqual(txHistory1.data);
      expect(balance2.data).toEqual(balance1.data);
    });

    it('should handle background sync and cache warming', async () => {
      const testAddresses = [
        'addr1test_warm_1',
        'addr1test_warm_2',
        'addr1test_warm_3'
      ];

      // Mock API responses for all addresses
      testAddresses.forEach((address, index) => {
        jest.spyOn(apiService, 'getAddressInfo').mockResolvedValueOnce({
          address,
          amount: [{ unit: 'lovelace', quantity: `${(index + 1) * 1000000}` }]
        });
      });

      // Warm up cache for multiple addresses
      const warmupPromises = testAddresses.map(address =>
        walletDataCache.getAccountBalance(address, { 
          enableBackgroundSync: true,
          priority: 'HIGH'
        })
      );

      const balances = await Promise.all(warmupPromises);

      // All balances should be available
      expect(balances).toHaveLength(3);
      balances.forEach((balance, index) => {
        expect(balance.data.confirmed).toBe(`${(index + 1) * 1000000}`);
        expect(balance.syncStatus).toBe('synced');
      });
    });

    it('should sync wallet data across multiple services', async () => {
      const testAddress = 'addr1test_sync';
      const mockUtxos = [
        {
          tx_hash: 'utxo_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '2000000' }],
          address: testAddress,
          block: 'block_1'
        },
        {
          tx_hash: 'utxo_2',
          tx_index: 1,
          amount: [{ unit: 'lovelace', quantity: '3000000' }],
          address: testAddress,
          block: 'block_2'
        }
      ];

      // Mock API service
      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(mockUtxos);

      // Get UTXOs through AccountManager (should use cache)
      const utxos1 = await accountManager.getAccountUTXOs(testAddress);
      expect(utxos1).toHaveLength(2);

      // Get UTXOs through cache service directly
      const cachedUtxos = await walletDataCache.getAccountUtxos(testAddress);
      expect(cachedUtxos.data.utxos).toHaveLength(2);

      // Data should be synchronized
      expect(cachedUtxos.data.utxos).toEqual(utxos1);
    });
  });

  describe('Portfolio Data Cache Integration', () => {
    it('should cache asset prices and portfolio analytics', async () => {
      const mockPrices = {
        'ADA': { price: 1.25, lastUpdated: Date.now() },
        'BTC': { price: 45000, lastUpdated: Date.now() }
      };

      const mockPortfolioData = {
        totalValue: 15000,
        allocation: {
          'ADA': 0.6,
          'BTC': 0.4
        },
        performance: {
          '24h': 0.05,
          '7d': 0.12,
          '30d': 0.25
        }
      };

      // Mock price API
      const AssetPriceServiceMock = require('../../services/portfolio/AssetPriceService').AssetPriceService;
      const priceServiceInstance = AssetPriceServiceMock.getInstance();
      jest.spyOn(priceServiceInstance, 'getAssetPrices')
        .mockResolvedValue(mockPrices);

      // Cache asset prices
      const prices1 = await portfolioDataCache.getAssetPrice('ADA');
      expect(prices1.price).toBe(1.25);

      // Cache portfolio analytics
      await portfolioDataCache.cachePortfolioAnalytics('user_123', mockPortfolioData);
      const analytics1 = await portfolioDataCache.getPortfolioAnalytics('user_123');
      expect(analytics1.totalValue).toBe(15000);

      // Subsequent requests should be faster (from cache)
      const startTime = Date.now();
      const prices2 = await portfolioDataCache.getAssetPrice('ADA');
      const analytics2 = await portfolioDataCache.getPortfolioAnalytics('user_123');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(prices2).toEqual(prices1);
      expect(analytics2).toEqual(analytics1);
    });

    it('should integrate with PortfolioService for comprehensive caching', async () => {
      const mockWalletData = {
        accounts: [
          {
            address: 'addr1test_portfolio',
            balance: '10000000', // 10 ADA
            assets: [
              { unit: 'lovelace', quantity: '10000000' }
            ]
          }
        ]
      };

      // Mock dependencies
      const WalletServiceMock = require('../../services/wallet/WalletService').WalletService;
      const walletServiceInstance = WalletServiceMock.getInstance();
      jest.spyOn(walletServiceInstance, 'getCurrentWallet')
        .mockResolvedValue(mockWalletData);

      jest.spyOn(portfolioDataCache, 'getAssetPrice')
        .mockResolvedValue({ symbol: 'ADA', price: 1.30, lastUpdated: Date.now() });

      // Get portfolio analysis through service (should cache intermediate results)
      const portfolio1 = await portfolioService.getComprehensivePortfolioReport('user_123');

      expect(portfolio1).toMatchObject({
        summary: expect.objectContaining({
          totalValue: expect.any(Number),
          totalAda: expect.any(Number)
        }),
        holdings: expect.any(Array),
        performance: expect.any(Object)
      });

      // Second request should benefit from cached data
      const startTime = Date.now();
      const portfolio2 = await portfolioService.getComprehensivePortfolioReport('user_123');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(portfolio2.summary.totalValue).toBe(portfolio1.summary.totalValue);
    });
  });

  describe('Cache Performance and Optimization', () => {
    it('should optimize cache performance for frequent operations', async () => {
      const testAddresses = Array(50).fill(0).map((_, i) => `addr1test_perf_${i}`);

      // Mock API responses
      testAddresses.forEach((address, index) => {
        jest.spyOn(apiService, 'getAddressInfo').mockResolvedValueOnce({
          address,
          amount: [{ unit: 'lovelace', quantity: `${index * 1000000}` }]
        });
      });

      // Warm up cache with many addresses
      const warmupStartTime = Date.now();
      await Promise.all(testAddresses.map(address =>
        walletDataCache.getAccountBalance(address)
      ));
      const warmupEndTime = Date.now();

      // Subsequent access should be very fast
      const accessStartTime = Date.now();
      await Promise.all(testAddresses.map(address =>
        walletDataCache.getAccountBalance(address)
      ));
      const accessEndTime = Date.now();

      const warmupTime = warmupEndTime - warmupStartTime;
      const accessTime = accessEndTime - accessStartTime;

      // Cached access should be significantly faster
      expect(accessTime).toBeLessThan(warmupTime / 10);
      expect(accessTime).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle cache eviction and memory management', async () => {
      const manyAddresses = Array(1000).fill(0).map((_, i) => `addr1test_eviction_${i}`);

      // Fill cache beyond typical capacity
      const promises = manyAddresses.map((address, index) => {
        jest.spyOn(apiService, 'getAddressInfo').mockResolvedValueOnce({
          address,
          amount: [{ unit: 'lovelace', quantity: `${index * 1000}` }]
        });
        return walletDataCache.getAccountBalance(address);
      });

      await Promise.all(promises);

      // Check cache statistics
      const stats = await walletDataCache.getStats();
      expect(stats.activeSyncs).toBe(0); // All syncs should be complete
      expect(stats.syncQueueSize).toBe(0); // Queue should be empty

      // Verify some data is still accessible (not all evicted)
      const recentData = await walletDataCache.getAccountBalance('addr1test_eviction_999');
      expect(recentData.data.confirmed).toBeDefined();
    });

    it('should coordinate cache invalidation across services', async () => {
      const testAddress = 'addr1test_coordination';
      const initialBalance = '5000000';
      const updatedBalance = '7000000';

      // Initial state
      jest.spyOn(apiService, 'getAddressInfo')
        .mockResolvedValueOnce({
          address: testAddress,
          amount: [{ unit: 'lovelace', quantity: initialBalance }]
        })
        .mockResolvedValueOnce({
          address: testAddress,
          amount: [{ unit: 'lovelace', quantity: updatedBalance }]
        });

      // Cache initial data across multiple services
      const balance1 = await walletDataCache.getAccountBalance(testAddress);
      const apiResponse1 = await apiService.getAddressInfo(testAddress);

      expect(balance1.data.confirmed).toBe(initialBalance);
      expect(apiResponse1.amount[0].quantity).toBe(initialBalance);

      // Simulate new transaction affecting this address
      await walletDataCache.addTransaction(testAddress, {
        hash: 'new_tx_hash',
        amount: [{ unit: 'lovelace', quantity: '2000000' }],
        fees: '200000',
        block_time: Date.now()
      });

      // Cache should be invalidated and fresh data fetched
      const balance2 = await walletDataCache.getAccountBalance(testAddress);
      expect(balance2.data.confirmed).toBe(updatedBalance);
    });
  });

  describe('Cache Error Handling and Recovery', () => {
    it('should fallback to network when cache fails', async () => {
      const testAddress = 'addr1test_fallback';
      const networkData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '3000000' }]
      };

      // Mock cache to fail
      jest.spyOn(intelligentCache, 'get').mockRejectedValueOnce(new Error('Cache storage error'));

      // Mock network to succeed
      jest.spyOn(apiService, 'getAddressInfo').mockResolvedValue(networkData);

      // Should fallback to network and return data
      const result = await apiService.getAddressInfo(testAddress);
      expect(result).toEqual(networkData);
    });

    it('should handle cache warming failures gracefully', async () => {
      const problematicAddresses = [
        'addr1test_problem_1',
        'addr1test_problem_2',
        'addr1test_problem_3'
      ];

      // Mock some API calls to fail
      jest.spyOn(apiService, 'getAddressInfo')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          address: 'addr1test_problem_2',
          amount: [{ unit: 'lovelace', quantity: '2000000' }]
        })
        .mockRejectedValueOnce(new Error('Rate limited'));

      // Attempt to warm up cache for all addresses
      const results = await Promise.allSettled(
        problematicAddresses.map(address =>
          walletDataCache.getAccountBalance(address)
        )
      );

      // Should handle failures gracefully
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');

      // Successful result should be cached
      if (results[1].status === 'fulfilled') {
        expect(results[1].value.data.confirmed).toBe('2000000');
      }
    });

    it('should recover from cache corruption', async () => {
      const testAddress = 'addr1test_corruption';
      const validData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '4000000' }]
      };

      // Mock corrupted cache data
      jest.spyOn(intelligentCache, 'get')
        .mockResolvedValueOnce('invalid_json_data') // First call returns corrupted data
        .mockImplementation((key, fetchFn) => fetchFn ? fetchFn() : null); // Subsequent calls work normally

      jest.spyOn(apiService, 'getAddressInfo').mockResolvedValue(validData);

      // Should handle corruption and fetch fresh data
      const result = await apiService.getAddressInfo(testAddress);
      expect(result).toEqual(validData);
    });
  });
});
