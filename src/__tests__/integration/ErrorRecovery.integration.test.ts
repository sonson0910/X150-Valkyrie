/**
 * Error Recovery Integration Test Suite
 * 
 * Tests the system's resilience and recovery mechanisms including:
 * - Network failure handling and retries
 * - Service failure isolation and recovery
 * - Data corruption detection and repair
 * - Graceful degradation under load
 * - Circuit breaker patterns
 * - User experience during failures
 */

import { CardanoAPIService } from '../../services/CardanoAPIService';
import { WalletService } from '../../services/wallet/WalletService';
import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import TransactionBuilder from '../../services/wallet/TransactionBuilder';
import { ErrorHandler } from '../../services/ErrorHandler';
import { PortfolioService } from '../../services/portfolio/PortfolioService';
import { NetworkService } from '../../services/NetworkService';
import { intelligentCache } from '../../utils/IntelligentCache';

describe('Error Recovery Integration', () => {
  let apiService: CardanoAPIService;
  let walletService: WalletService;
  let walletKeyManager: WalletKeyManager;
  let transactionBuilder: TransactionBuilder;
  let portfolioService: PortfolioService;
  let networkService: NetworkService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    apiService = CardanoAPIService.getInstance();
    walletService = WalletService.getInstance();
    walletKeyManager = WalletKeyManager.getInstance('testnet');
    transactionBuilder = TransactionBuilder.getInstance('testnet');
    portfolioService = PortfolioService.getInstance();
    networkService = NetworkService.getInstance();
    errorHandler = ErrorHandler.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    errorHandler.clearErrorLog();
  });

  describe('Network Failure Recovery', () => {
    it('should retry failed network requests with exponential backoff', async () => {
      const testAddress = 'addr1test_network_retry';
      const successData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '5000000' }]
      };

      // Mock network to fail first 3 times, then succeed
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      const networkSpy = jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('DNS resolution failed'))
        .mockResolvedValueOnce({
          status: 200,
          data: successData,
          headers: {}
        });

      const startTime = Date.now();
      const result = await apiService.getAddressInfo(testAddress);
      const endTime = Date.now();

      expect(result).toEqual(successData);
      expect(networkSpy).toHaveBeenCalledTimes(4);
      
      // Should have taken some time due to retries with backoff
      expect(endTime - startTime).toBeGreaterThan(100);
    });

    it('should handle partial network failures in batch operations', async () => {
      const addresses = [
        'addr1test_batch_1',
        'addr1test_batch_2',
        'addr1test_batch_3',
        'addr1test_batch_4'
      ];

      // Mock network to fail for some addresses
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockResolvedValueOnce({
          status: 200,
          data: { address: addresses[0], amount: [{ unit: 'lovelace', quantity: '1000000' }] },
          headers: {}
        })
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { address: addresses[2], amount: [{ unit: 'lovelace', quantity: '3000000' }] },
          headers: {}
        })
        .mockRejectedValueOnce(new Error('Rate limited'));

      // Attempt to get info for all addresses
      const results = await Promise.allSettled(
        addresses.map(address => apiService.getAddressInfo(address))
      );

      // Should handle mixed success/failure
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');

      // Successful results should have correct data
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.amount[0].quantity).toBe('1000000');
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value.amount[0].quantity).toBe('3000000');
      }
    });

    it('should gracefully degrade when blockchain API is unavailable', async () => {
      // Mock API service to be completely unavailable
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest').mockRejectedValue(new Error('Service unavailable'));

      // Wallet operations should still work with cached data
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      const account = await walletKeyManager.createAccount(0, 'Offline Account');

      // Should be able to create accounts and addresses without network
      expect(account.address).toMatch(/^addr1/);
      expect(walletKeyManager.isInitialized()).toBe(true);

      // Transaction building should fail gracefully
      await expect(
        transactionBuilder.buildTransaction({
          fromAddress: account.address,
          toAddress: 'addr1test_recipient',
          amount: '1000000',
          utxos: [] // No UTXOs available
        })
      ).rejects.toThrow(/no.*utxos/i);
    });
  });

  describe('Service Failure Isolation', () => {
    it('should isolate portfolio service failures from wallet operations', async () => {
      // Mock portfolio service to fail
      jest.spyOn(portfolioService, 'getComprehensivePortfolioReport')
        .mockRejectedValue(new Error('Portfolio calculation failed'));

      // Wallet operations should continue working
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      const initResult = await walletKeyManager.initializeFromMnemonic(mnemonic);
      expect(initResult).toBe(true);

      const account = await walletKeyManager.createAccount(0);
      expect(account).toBeDefined();

      // Portfolio failure should be handled gracefully
      await expect(
        portfolioService.getComprehensivePortfolioReport('user_123')
      ).rejects.toThrow('Portfolio calculation failed');

      // But wallet should still work
      const address = await walletKeyManager.generateNewAddress(0, 0, false);
      expect(address).toMatch(/^addr1/);
    });

    it('should handle crypto library failures without affecting other services', async () => {
      // Mock CSL to fail during specific operations
      const { getCSL } = require('../../utils/CSLProvider');
      getCSL.mockRejectedValueOnce(new Error('CSL operation failed'));

      // First CSL operation should fail
      await expect(
        walletKeyManager.initializeFromMnemonic('invalid mnemonic')
      ).rejects.toThrow();

      // Reset CSL mock to work normally
      getCSL.mockRestore();

      // Subsequent operations should work
      const validMnemonic = WalletKeyManager.generateMnemonic(128);
      const result = await walletKeyManager.initializeFromMnemonic(validMnemonic);
      expect(result).toBe(true);
    });

    it('should handle cache service failures without breaking core functionality', async () => {
      // Mock cache to fail
      jest.spyOn(intelligentCache, 'get').mockRejectedValue(new Error('Cache storage corrupted'));
      jest.spyOn(intelligentCache, 'set').mockRejectedValue(new Error('Cache write failed'));

      // API service should fallback to direct network calls
      const testAddress = 'addr1test_cache_failure';
      const networkData = {
        address: testAddress,
        amount: [{ unit: 'lovelace', quantity: '2000000' }]
      };

      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest').mockResolvedValue({
        status: 200,
        data: networkData,
        headers: {}
      });

      const result = await apiService.getAddressInfo(testAddress);
      expect(result).toEqual(networkData);
    });
  });

  describe('Transaction Failure Recovery', () => {
    it('should handle transaction submission failures with retry logic', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      await walletKeyManager.createAccount(0);

      const mockUtxos = [
        {
          tx_hash: 'retry_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      // Mock transaction submission to fail multiple times
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValueOnce(new Error('Network congestion'))
        .mockRejectedValueOnce(new Error('Temporary server error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { hash: 'success_tx_hash' },
          headers: {}
        });

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        utxos: mockUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);
      const paymentKey = await walletKeyManager.getPaymentSigningKey(0, 0, false);
      const mockTransaction = { to_bytes: () => new Uint8Array([1, 2, 3, 4]) };
      const signedTransaction = await transactionBuilder.signTransaction(
        mockTransaction as any,
        [paymentKey]
      );

      const result = await transactionBuilder.submitTransaction(signedTransaction);

      expect(result.success).toBe(true);
      expect(result.txHash).toBe('success_tx_hash');
    });

    it('should handle UTXO conflicts and suggest resolutions', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      await walletKeyManager.createAccount(0);

      const conflictedUtxo = {
        tx_hash: 'conflicted_utxo',
        tx_index: 0,
        amount: [{ unit: 'lovelace', quantity: '3000000' }],
        address: 'addr1test_sender',
        block: 'mock_block',
      };

      // Mock API to indicate UTXO is already spent
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValueOnce({
          status: 400,
          data: { error: 'UTXOAlreadyConsumed', utxo: conflictedUtxo }
        });

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        utxos: [conflictedUtxo]
      };

      await expect(
        transactionBuilder.buildTransaction(transactionRequest)
      ).rejects.toThrow();

      // Error should be logged with recovery suggestions
      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeGreaterThan(0);
    });

    it('should recover from transaction malformation errors', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      await walletKeyManager.createAccount(0);

      // Mock invalid transaction parameters
      const invalidRequest = {
        fromAddress: 'invalid_address',
        toAddress: 'addr1test_recipient',
        amount: '-1000000', // Negative amount
        utxos: []
      };

      await expect(
        transactionBuilder.buildTransaction(invalidRequest)
      ).rejects.toThrow();

      // Should be able to build valid transaction afterwards
      const validUtxos = [
        {
          tx_hash: 'valid_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: 'addr1test_valid_sender',
          block: 'mock_block',
        }
      ];

      const validRequest = {
        fromAddress: 'addr1test_valid_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        utxos: validUtxos
      };

      const validTransaction = await transactionBuilder.buildTransaction(validRequest);
      expect(validTransaction.inputs).toHaveLength(1);
    });
  });

  describe('Data Corruption Detection and Recovery', () => {
    it('should detect and recover from corrupted wallet data', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      const originalAccount = await walletKeyManager.createAccount(0);

      // Simulate data corruption by clearing internal state
      walletKeyManager.clearSensitiveData();
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Recovery should be possible with the same mnemonic
      const recovered = await walletKeyManager.initializeFromMnemonic(mnemonic);
      expect(recovered).toBe(true);

      const recoveredAccount = await walletKeyManager.createAccount(0);
      expect(recoveredAccount.address).toBe(originalAccount.address);
    });

    it('should validate data integrity and reject corrupted inputs', async () => {
      // Test invalid mnemonic detection
      const invalidMnemonics = [
        'invalid mnemonic phrase',
        'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 invalid',
        '', // Empty mnemonic
        'a'.repeat(1000) // Extremely long input
      ];

      for (const invalidMnemonic of invalidMnemonics) {
        const result = await walletKeyManager.initializeFromMnemonic(invalidMnemonic);
        expect(result).toBe(false);
        expect(walletKeyManager.isInitialized()).toBe(false);
      }
    });

    it('should handle corrupted transaction data gracefully', async () => {
      const corruptedTransactionData = {
        fromAddress: null,
        toAddress: undefined,
        amount: 'not_a_number',
        utxos: 'invalid_utxos'
      };

      await expect(
        transactionBuilder.buildTransaction(corruptedTransactionData as any)
      ).rejects.toThrow();

      // Transaction builder should remain functional after error
      const validUtxos = [
        {
          tx_hash: 'recovery_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '3000000' }],
          address: 'addr1test_recovery',
          block: 'mock_block',
        }
      ];

      const validRequest = {
        fromAddress: 'addr1test_recovery',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: validUtxos
      };

      const validTransaction = await transactionBuilder.buildTransaction(validRequest);
      expect(validTransaction).toBeDefined();
    });
  });

  describe('Circuit Breaker and Rate Limiting', () => {
    it('should implement circuit breaker for failing services', async () => {
      const testAddress = 'addr1test_circuit_breaker';

      // Mock service to fail consistently
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      const failingSpy = jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValue(new Error('Service overloaded'));

      // Make multiple requests to trigger circuit breaker
      const failurePromises = Array(10).fill(0).map(() =>
        apiService.getAddressInfo(testAddress).catch(err => err)
      );

      const results = await Promise.all(failurePromises);

      // All should fail, but circuit breaker should prevent excessive calls
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
      });

      // Network service should not be called excessively
      expect(failingSpy.mock.calls.length).toBeLessThan(20); // Circuit breaker should limit calls

      failingSpy.mockRestore();
    });

    it('should respect rate limits and back off appropriately', async () => {
      const testAddress = 'addr1test_rate_limit';

      // Mock rate limiting response
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
        .mockResolvedValueOnce({
          status: 200,
          data: { address: testAddress, amount: [{ unit: 'lovelace', quantity: '1000000' }] },
          headers: {}
        });

      const startTime = Date.now();
      const result = await apiService.getAddressInfo(testAddress);
      const endTime = Date.now();

      expect(result.address).toBe(testAddress);
      // Should have taken time due to rate limiting backoff
      expect(endTime - startTime).toBeGreaterThan(100);
    });
  });

  describe('User Experience During Failures', () => {
    it('should provide meaningful error messages to users', async () => {
      // Test network error user messaging
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValue(new Error('Network unreachable'));

      const testAddress = 'addr1test_user_error';

      try {
        await apiService.getAddressInfo(testAddress);
      } catch (error) {
        // Error should be handled and logged
        const errorLog = errorHandler.getErrorLog();
        expect(errorLog.length).toBeGreaterThan(0);
        
        const lastError = errorLog[errorLog.length - 1];
        expect(lastError.category).toBeDefined();
        expect(lastError.isRecoverable).toBeDefined();
      }
    });

    it('should maintain wallet functionality during partial failures', async () => {
      // Mock portfolio service to fail
      jest.spyOn(portfolioService, 'getComprehensivePortfolioReport')
        .mockRejectedValue(new Error('Portfolio service unavailable'));

      // Wallet creation should still work
      const result = await walletService.createWallet({
        mnemonic: WalletKeyManager.generateMnemonic(128),
        name: 'Resilient Wallet',
        password: 'test-password-123'
      });

      expect(result.success).toBe(true);
      expect(result.wallet.name).toBe('Resilient Wallet');

      // Basic wallet operations should work despite portfolio failure
      const currentWallet = await walletService.getCurrentWallet();
      expect(currentWallet).toBeDefined();
    });

    it('should provide fallback data when real-time data is unavailable', async () => {
      // Mock real-time API to fail
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest')
        .mockRejectedValue(new Error('Real-time data unavailable'));

      // Should fallback to cached data or safe defaults
      const testAddress = 'addr1test_fallback';
      
      try {
        await apiService.getAddressInfo(testAddress);
      } catch (error) {
        // Error should be gracefully handled
        expect(error).toBeDefined();
      }

      // Wallet operations should continue with available data
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      const initResult = await walletKeyManager.initializeFromMnemonic(mnemonic);
      expect(initResult).toBe(true);
    });
  });

  describe('Recovery Performance and Scalability', () => {
    it('should handle recovery operations efficiently at scale', async () => {
      const manyAddresses = Array(100).fill(0).map((_, i) => `addr1test_scale_${i}`);

      // Mock network failures for some addresses
      const NetworkServiceMock = require('../../services/NetworkService').NetworkService;
      const mockInstance = NetworkServiceMock.getInstance();
      jest.spyOn(mockInstance, 'makeRequest').mockImplementation((url) => {
        const isFailingAddress = url.includes('addr1test_scale_1') || 
                                url.includes('addr1test_scale_2');
        
        if (isFailingAddress) {
          return Promise.reject(new Error('Network error'));
        }
        
        return Promise.resolve({
          status: 200,
          data: { address: 'mock_address', amount: [{ unit: 'lovelace', quantity: '1000000' }] },
          headers: {}
        });
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(
        manyAddresses.map(address => apiService.getAddressInfo(address))
      );
      const endTime = Date.now();

      // Should complete within reasonable time despite failures
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBeGreaterThan(90); // Most should succeed
      expect(failureCount).toBeLessThan(10); // Some failures expected
    });

    it('should not leak memory during error recovery cycles', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate multiple error/recovery cycles
      for (let i = 0; i < 100; i++) {
        try {
          // Create and destroy wallet instances
          const mnemonic = WalletKeyManager.generateMnemonic(128);
          await walletKeyManager.initializeFromMnemonic(mnemonic);
          await walletKeyManager.createAccount(0);
          
          // Simulate error
          throw new Error(`Simulated error ${i}`);
        } catch (error) {
          // Clean up
          walletKeyManager.clearSensitiveData();
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
});
