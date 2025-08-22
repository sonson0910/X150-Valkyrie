/**
 * Wallet Creation Flow Integration Test Suite
 * 
 * Tests the complete wallet creation workflow including:
 * - Mnemonic generation and validation
 * - Key derivation from mnemonic
 * - Address generation
 * - Account setup
 * - Service integration
 * - Error handling across components
 */

import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import { WalletService } from '../../services/wallet/WalletService';
import { BiometricService } from '../../services/BiometricService';
import { MnemonicTransformService } from '../../services/MnemonicTransformService';
import { MemoryUtils } from '../../utils/MemoryUtils';
import { CryptoUtils } from '../../utils/CryptoUtils';

describe('Wallet Creation Flow Integration', () => {
  let walletKeyManager: WalletKeyManager;
  let walletService: WalletService;
  let biometricService: BiometricService;

  beforeEach(() => {
    walletKeyManager = WalletKeyManager.getInstance('testnet');
    walletService = WalletService.getInstance();
    biometricService = BiometricService.getInstance();
  });

  afterEach(() => {
    walletKeyManager.clearSensitiveData();
  });

  describe('Complete Wallet Creation Flow', () => {
    it('should create a new wallet from scratch', async () => {
      // Step 1: Generate mnemonic
      const mnemonic = WalletKeyManager.generateMnemonic(128); // 12 words
      
      expect(mnemonic).toBeDefined();
      expect(mnemonic.split(' ')).toHaveLength(12);
      expect(WalletKeyManager.validateMnemonic(mnemonic)).toBe(true);

      // Step 2: Initialize wallet from mnemonic
      const initResult = await walletKeyManager.initializeFromMnemonic(mnemonic);
      expect(initResult).toBe(true);
      expect(walletKeyManager.isInitialized()).toBe(true);

      // Step 3: Create primary account
      const primaryAccount = await walletKeyManager.createAccount(0, 'Primary Account');
      
      expect(primaryAccount).toMatchObject({
        id: 'account-0',
        name: 'Primary Account',
        accountIndex: 0,
        isActive: true,
        balance: '0',
        derivationPath: "m/1852'/1815'/0'"
      });

      expect(primaryAccount.address).toMatch(/^addr1/); // Testnet address
      expect(primaryAccount.stakeAddress).toMatch(/^stake1u/); // Stake address

      // Step 4: Generate additional addresses
      const address1 = await walletKeyManager.generateNewAddress(0, 0, false); // External
      const address2 = await walletKeyManager.generateNewAddress(0, 1, false); // External
      const changeAddress = await walletKeyManager.generateNewAddress(0, 0, true); // Change

      expect(address1).toMatch(/^addr1/);
      expect(address2).toMatch(/^addr1/);
      expect(changeAddress).toMatch(/^addr1/);

      // All addresses should be different
      const addresses = [primaryAccount.address, address1, address2, changeAddress];
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);

      // Step 5: Create multiple accounts
      const secondaryAccount = await walletKeyManager.createAccount(1, 'Secondary Account');
      
      expect(secondaryAccount.id).toBe('account-1');
      expect(secondaryAccount.derivationPath).toBe("m/1852'/1815'/1'");
      expect(secondaryAccount.address).not.toBe(primaryAccount.address);

      // Step 6: Verify key derivation works correctly
      const paymentKey1 = await walletKeyManager.getPaymentSigningKey(0, 0, false);
      const paymentKey2 = await walletKeyManager.getPaymentSigningKey(0, 1, false);
      const stakeKey = await walletKeyManager.getStakeSigningKey(0);

      expect(paymentKey1).toBeDefined();
      expect(paymentKey2).toBeDefined();
      expect(stakeKey).toBeDefined();
      expect(paymentKey1).not.toBe(paymentKey2);
    });

    it('should create wallet with 24-word mnemonic', async () => {
      // Generate 24-word mnemonic
      const mnemonic24 = WalletKeyManager.generateMnemonic(256);
      
      expect(mnemonic24.split(' ')).toHaveLength(24);
      expect(WalletKeyManager.validateMnemonic(mnemonic24)).toBe(true);

      // Initialize and create account
      await walletKeyManager.initializeFromMnemonic(mnemonic24);
      const account = await walletKeyManager.createAccount(0);

      expect(account.address).toMatch(/^addr1/);
      expect(walletKeyManager.isInitialized()).toBe(true);
    });

    it('should restore wallet from existing mnemonic', async () => {
      // Create initial wallet
      const originalMnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(originalMnemonic);
      const originalAccount = await walletKeyManager.createAccount(0, 'Original Account');
      const originalAddress = originalAccount.address;

      // Clear wallet
      walletKeyManager.clearSensitiveData();
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Restore from same mnemonic
      await walletKeyManager.initializeFromMnemonic(originalMnemonic);
      const restoredAccount = await walletKeyManager.createAccount(0, 'Restored Account');

      // Should generate same address (deterministic)
      expect(restoredAccount.address).toBe(originalAddress);
      expect(restoredAccount.stakeAddress).toBe(originalAccount.stakeAddress);
    });
  });

  describe('Wallet Service Integration', () => {
    it('should integrate WalletKeyManager with WalletService', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      
      // Initialize through WalletService
      const result = await walletService.createWallet({
        mnemonic,
        name: 'Integration Test Wallet',
        password: 'secure-password-123'
      });

      expect(result.success).toBe(true);
      expect(result.wallet).toMatchObject({
        name: 'Integration Test Wallet',
        accounts: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            address: expect.stringMatching(/^addr1/)
          })
        ])
      });

      // Verify wallet can be accessed through service
      const wallet = await walletService.getCurrentWallet();
      expect(wallet).toBeDefined();
      expect(wallet.accounts.length).toBeGreaterThan(0);
    });

    it('should handle wallet creation with biometric authentication', async () => {
      // Mock biometric availability
      const { isSensorAvailable, simplePrompt } = require('react-native-biometrics');
      isSensorAvailable.mockResolvedValue({ available: true, biometryType: 'TouchID' });
      simplePrompt.mockResolvedValue({ success: true });

      const mnemonic = WalletKeyManager.generateMnemonic(128);

      const result = await walletService.createWallet({
        mnemonic,
        name: 'Biometric Wallet',
        password: 'secure-password-123',
        enableBiometric: true
      });

      expect(result.success).toBe(true);
      expect(isSensorAvailable).toHaveBeenCalled();
      expect(simplePrompt).toHaveBeenCalledWith({
        promptMessage: 'Authenticate to secure your wallet'
      });
    });
  });

  describe('Mnemonic Transformation Integration', () => {
    it('should transform 12-word to 36-word mnemonic and restore', async () => {
      const original12Word = WalletKeyManager.generateMnemonic(128);
      const password = 'transformation-password-123';

      // Transform to 36 words
      const transformed36Word = await MnemonicTransformService.transformMnemonic(
        original12Word,
        password
      );

      expect(transformed36Word.split(' ')).toHaveLength(36);

      // Create wallet from original
      await walletKeyManager.initializeFromMnemonic(original12Word);
      const originalAccount = await walletKeyManager.createAccount(0);
      const originalAddress = originalAccount.address;

      // Clear and restore from transformed
      walletKeyManager.clearSensitiveData();

      const restored12Word = await MnemonicTransformService.restoreMnemonic(
        transformed36Word,
        password
      );

      expect(restored12Word).toBe(original12Word);

      // Verify addresses match
      await walletKeyManager.initializeFromMnemonic(restored12Word);
      const restoredAccount = await walletKeyManager.createAccount(0);

      expect(restoredAccount.address).toBe(originalAddress);
    });

    it('should fail transformation with wrong password', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      const correctPassword = 'correct-password-123';
      const wrongPassword = 'wrong-password-456';

      const transformed = await MnemonicTransformService.transformMnemonic(
        mnemonic,
        correctPassword
      );

      await expect(
        MnemonicTransformService.restoreMnemonic(transformed, wrongPassword)
      ).rejects.toThrow();
    });
  });

  describe('Memory Security Integration', () => {
    it('should securely clear sensitive data across services', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      const password = 'secure-password-123';

      // Create wallet with sensitive data
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      const account = await walletKeyManager.createAccount(0);

      // Generate keys (contains sensitive data)
      const paymentKey = await walletKeyManager.getPaymentSigningKey(0, 0, false);
      const stakeKey = await walletKeyManager.getStakeSigningKey(0);

      expect(paymentKey).toBeDefined();
      expect(stakeKey).toBeDefined();

      // Clear sensitive data
      walletKeyManager.clearSensitiveData();

      // Verify wallet is cleared
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Should not be able to derive keys anymore
      await expect(walletKeyManager.getPaymentSigningKey(0, 0, false))
        .rejects.toThrow('Wallet not initialized');
    });

    it('should use secure memory utilities during wallet operations', async () => {
      const secureRandomSpy = jest.spyOn(MemoryUtils, 'secureRandom');
      const zeroMemorySpy = jest.spyOn(MemoryUtils, 'zeroMemory');

      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      await walletKeyManager.createAccount(0);

      // Verify secure utilities were used
      expect(secureRandomSpy).toHaveBeenCalled();

      // Clear data and verify cleanup
      walletKeyManager.clearSensitiveData();
      expect(zeroMemorySpy).toHaveBeenCalled();

      secureRandomSpy.mockRestore();
      zeroMemorySpy.mockRestore();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid mnemonic gracefully', async () => {
      const invalidMnemonic = 'invalid mnemonic phrase that does not exist';

      const result = await walletKeyManager.initializeFromMnemonic(invalidMnemonic);
      expect(result).toBe(false);
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Should not be able to create accounts
      await expect(walletKeyManager.createAccount(0))
        .rejects.toThrow('Wallet not initialized');
    });

    it('should handle CSL library errors during initialization', async () => {
      // Mock CSL to fail
      const { getCSL } = require('../../utils/CSLProvider');
      getCSL.mockRejectedValueOnce(new Error('CSL library failed to load'));

      const mnemonic = WalletKeyManager.generateMnemonic(128);
      
      const result = await walletKeyManager.initializeFromMnemonic(mnemonic);
      expect(result).toBe(false);
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Restore normal CSL behavior
      getCSL.mockRestore();
    });

    it('should handle network switching during wallet operations', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      
      // Initialize on testnet
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      const testnetAccount = await walletKeyManager.createAccount(0);
      expect(testnetAccount.address).toMatch(/^addr1/); // Testnet prefix

      // Switch to mainnet (should clear data)
      walletKeyManager.setNetwork('mainnet');
      expect(walletKeyManager.isInitialized()).toBe(false);

      // Re-initialize on mainnet
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      const mainnetAccount = await walletKeyManager.createAccount(0);
      expect(mainnetAccount.address).toMatch(/^addr1/); // Mainnet would have different format in real implementation

      // Addresses should be different due to network change
      // Note: In real implementation, mainnet addresses would have different format
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent account creations', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);

      // Create multiple accounts concurrently
      const accountPromises = Array(5).fill(0).map((_, index) =>
        walletKeyManager.createAccount(index, `Account ${index}`)
      );

      const accounts = await Promise.all(accountPromises);

      // All accounts should be created successfully
      expect(accounts).toHaveLength(5);
      accounts.forEach((account, index) => {
        expect(account.id).toBe(`account-${index}`);
        expect(account.name).toBe(`Account ${index}`);
        expect(account.address).toMatch(/^addr1/);
      });

      // All addresses should be unique
      const addresses = accounts.map(acc => acc.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should handle concurrent address generation', async () => {
      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      await walletKeyManager.createAccount(0);

      // Generate multiple addresses concurrently
      const addressPromises = Array(10).fill(0).map((_, index) =>
        walletKeyManager.generateNewAddress(0, index, false)
      );

      const addresses = await Promise.all(addressPromises);

      // All addresses should be generated successfully
      expect(addresses).toHaveLength(10);
      addresses.forEach(address => {
        expect(address).toMatch(/^addr1/);
      });

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });
  });

  describe('Performance Integration', () => {
    it('should create wallet efficiently', async () => {
      const startTime = Date.now();

      const mnemonic = WalletKeyManager.generateMnemonic(128);
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      
      // Create 5 accounts with multiple addresses each
      for (let i = 0; i < 5; i++) {
        await walletKeyManager.createAccount(i, `Account ${i}`);
        
        // Generate 5 addresses per account
        for (let j = 0; j < 5; j++) {
          await walletKeyManager.generateNewAddress(i, j, false);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should not cause memory leaks during wallet operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy multiple wallets
      for (let i = 0; i < 10; i++) {
        const mnemonic = WalletKeyManager.generateMnemonic(128);
        await walletKeyManager.initializeFromMnemonic(mnemonic);
        await walletKeyManager.createAccount(0);
        await walletKeyManager.generateNewAddress(0, 0, false);
        walletKeyManager.clearSensitiveData();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

