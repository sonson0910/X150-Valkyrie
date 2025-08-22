/**
 * WalletKeyManager Test Suite
 * 
 * Tests the wallet key management functionality including:
 * - Mnemonic validation and key derivation
 * - Address generation
 * - Account creation
 * - Memory cleanup
 */

import WalletKeyManager from '../../../services/wallet/WalletKeyManager';
import { CARDANO_NETWORKS } from '../../../constants';

// Mock CSL Provider
jest.mock('../../../utils/CSLProvider');

describe('WalletKeyManager', () => {
  let walletKeyManager: WalletKeyManager;

  beforeEach(() => {
    walletKeyManager = WalletKeyManager.getInstance('testnet');
  });

  afterEach(() => {
    walletKeyManager.clearSensitiveData();
  });

  describe('Mnemonic Operations', () => {
    it('should generate valid mnemonic phrases', () => {
      const mnemonic12 = WalletKeyManager.generateMnemonic(128);
      const mnemonic24 = WalletKeyManager.generateMnemonic(256);

      expect(mnemonic12).toBeDefined();
      expect(mnemonic24).toBeDefined();
      expect(mnemonic12.split(' ')).toHaveLength(12);
      expect(mnemonic24.split(' ')).toHaveLength(24);
    });

    it('should initialize wallet from valid mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      const result = await walletKeyManager.initializeFromMnemonic(mnemonic);

      expect(result).toBe(true);
      expect(walletKeyManager.isInitialized()).toBe(true);
    });

    it('should reject invalid mnemonic phrases', async () => {
      const invalidMnemonic = 'invalid mnemonic phrase that is not valid';
      
      const result = await walletKeyManager.initializeFromMnemonic(invalidMnemonic);

      expect(result).toBe(false);
      expect(walletKeyManager.isInitialized()).toBe(false);
    });
  });

  describe('Account Creation', () => {
    beforeEach(async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await walletKeyManager.initializeFromMnemonic(mnemonic);
    });

    it('should create wallet accounts successfully', async () => {
      const account = await walletKeyManager.createAccount(0, 'Test Account');

      expect(account).toBeDefined();
      expect(account.id).toBe('account-0');
      expect(account.name).toBe('Test Account');
      expect(account.address).toMatch(/^addr1/); // Cardano testnet address prefix
      expect(account.stakeAddress).toMatch(/^stake1u/); // Cardano stake address prefix
      expect(account.isActive).toBe(true);
      expect(account.balance).toBe('0');
    });

    it('should create multiple accounts with different indices', async () => {
      const account1 = await walletKeyManager.createAccount(0, 'Account 1');
      const account2 = await walletKeyManager.createAccount(1, 'Account 2');

      expect(account1.id).toBe('account-0');
      expect(account2.id).toBe('account-1');
      expect(account1.address).not.toBe(account2.address);
      expect(account1.derivationPath).toBe("m/1852'/1815'/0'");
      expect(account2.derivationPath).toBe("m/1852'/1815'/1'");
    });

    it('should generate unique addresses for each account', async () => {
      const addresses = [];
      for (let i = 0; i < 5; i++) {
        const account = await walletKeyManager.createAccount(i);
        addresses.push(account.address);
      }

      // All addresses should be unique
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });
  });

  describe('Address Generation', () => {
    beforeEach(async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await walletKeyManager.initializeFromMnemonic(mnemonic);
    });

    it('should generate new addresses for accounts', async () => {
      const address1 = await walletKeyManager.generateNewAddress(0, 0, false); // External
      const address2 = await walletKeyManager.generateNewAddress(0, 1, false); // External
      const changeAddress = await walletKeyManager.generateNewAddress(0, 0, true); // Internal (change)

      expect(address1).toMatch(/^addr1/);
      expect(address2).toMatch(/^addr1/);
      expect(changeAddress).toMatch(/^addr1/);
      expect(address1).not.toBe(address2);
      expect(address1).not.toBe(changeAddress);
    });

    it('should generate different addresses for external and change chains', async () => {
      const externalAddress = await walletKeyManager.generateNewAddress(0, 0, false);
      const changeAddress = await walletKeyManager.generateNewAddress(0, 0, true);

      expect(externalAddress).not.toBe(changeAddress);
    });
  });

  describe('Key Derivation', () => {
    beforeEach(async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await walletKeyManager.initializeFromMnemonic(mnemonic);
    });

    it('should derive payment signing keys', async () => {
      const paymentKey = await walletKeyManager.getPaymentSigningKey(0, 0, false);

      expect(paymentKey).toBeDefined();
      expect(paymentKey.to_raw_key).toBeDefined();
      expect(paymentKey.to_public).toBeDefined();
    });

    it('should derive stake signing keys', async () => {
      const stakeKey = await walletKeyManager.getStakeSigningKey(0);

      expect(stakeKey).toBeDefined();
      expect(stakeKey.to_raw_key).toBeDefined();
      expect(stakeKey.to_public).toBeDefined();
    });

    it('should derive different keys for different accounts', async () => {
      const paymentKey1 = await walletKeyManager.getPaymentSigningKey(0);
      const paymentKey2 = await walletKeyManager.getPaymentSigningKey(1);

      expect(paymentKey1).not.toBe(paymentKey2);
    });
  });

  describe('Network Management', () => {
    it('should switch networks correctly', () => {
      expect(walletKeyManager.getNetwork()).toBe(CARDANO_NETWORKS.TESTNET);

      walletKeyManager.setNetwork('mainnet');
      expect(walletKeyManager.getNetwork()).toBe(CARDANO_NETWORKS.MAINNET);

      walletKeyManager.setNetwork('testnet');
      expect(walletKeyManager.getNetwork()).toBe(CARDANO_NETWORKS.TESTNET);
    });

    it('should clear sensitive data when switching networks', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await walletKeyManager.initializeFromMnemonic(mnemonic);
      
      expect(walletKeyManager.isInitialized()).toBe(true);

      walletKeyManager.setNetwork('mainnet');

      expect(walletKeyManager.isInitialized()).toBe(false);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await walletKeyManager.initializeFromMnemonic(mnemonic);
    });

    it('should clear sensitive data from memory', () => {
      expect(walletKeyManager.isInitialized()).toBe(true);

      walletKeyManager.clearSensitiveData();

      expect(walletKeyManager.isInitialized()).toBe(false);
    });

    it('should handle multiple clearSensitiveData calls safely', () => {
      walletKeyManager.clearSensitiveData();
      walletKeyManager.clearSensitiveData(); // Should not throw

      expect(walletKeyManager.isInitialized()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized wallet gracefully', async () => {
      expect(walletKeyManager.isInitialized()).toBe(false);

      await expect(walletKeyManager.createAccount(0)).rejects.toThrow('Wallet not initialized');
      await expect(walletKeyManager.generateNewAddress(0, 0)).rejects.toThrow('Wallet not initialized');
      await expect(walletKeyManager.getPaymentSigningKey(0)).rejects.toThrow('Wallet not initialized');
      await expect(walletKeyManager.getStakeSigningKey(0)).rejects.toThrow('Wallet not initialized');
    });

    it('should handle CSL library errors gracefully', async () => {
      // Mock CSL to throw an error
      const { getCSL } = require('../../../utils/CSLProvider');
      getCSL.mockRejectedValueOnce(new Error('CSL loading failed'));

      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      const result = await walletKeyManager.initializeFromMnemonic(mnemonic);

      expect(result).toBe(false);
      expect(walletKeyManager.isInitialized()).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WalletKeyManager.getInstance('testnet');
      const instance2 = WalletKeyManager.getInstance('testnet');

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = WalletKeyManager.getInstance('testnet');
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      
      await instance1.initializeFromMnemonic(mnemonic);
      expect(instance1.isInitialized()).toBe(true);

      const instance2 = WalletKeyManager.getInstance('testnet');
      expect(instance2.isInitialized()).toBe(true);
      expect(instance1).toBe(instance2);
    });
  });
});

