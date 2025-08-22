/**
 * Transaction Flow Integration Test Suite
 * 
 * Tests the complete transaction workflow including:
 * - Transaction building with UTXOs
 * - Fee calculation and optimization
 * - Transaction signing with multiple keys
 * - Transaction submission to network
 * - Error handling and recovery
 * - Multi-asset and metadata transactions
 */

import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import TransactionBuilder from '../../services/wallet/TransactionBuilder';
import { AccountManager } from '../../services/wallet/AccountManager';
import { CardanoAPIService } from '../../services/CardanoAPIService';
import { WalletService } from '../../services/wallet/WalletService';

describe('Transaction Flow Integration', () => {
  let walletKeyManager: WalletKeyManager;
  let transactionBuilder: TransactionBuilder;
  let accountManager: AccountManager;
  let apiService: CardanoAPIService;
  let walletService: WalletService;

  beforeEach(async () => {
    walletKeyManager = WalletKeyManager.getInstance('testnet');
    transactionBuilder = TransactionBuilder.getInstance('testnet');
    accountManager = AccountManager.getInstance('testnet');
    apiService = CardanoAPIService.getInstance();
    walletService = WalletService.getInstance();

    // Initialize wallet for testing
    const mnemonic = WalletKeyManager.generateMnemonic(128);
    await walletKeyManager.initializeFromMnemonic(mnemonic);
    await walletKeyManager.createAccount(0, 'Test Account');
  });

  afterEach(() => {
    walletKeyManager.clearSensitiveData();
    transactionBuilder.clearSensitiveData();
  });

  describe('Basic Transaction Flow', () => {
    it('should build, sign, and submit a simple ADA transaction', async () => {
      // Mock UTXOs for the account
      const mockUtxos = [
        {
          tx_hash: 'mock_tx_hash_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }], // 5 ADA
          address: 'addr1test_sender',
          block: 'mock_block_1',
        },
        {
          tx_hash: 'mock_tx_hash_2',
          tx_index: 1,
          amount: [{ unit: 'lovelace', quantity: '3000000' }], // 3 ADA
          address: 'addr1test_sender',
          block: 'mock_block_2',
        }
      ];

      // Mock API service responses
      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(mockUtxos);
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'submitted_tx_hash_123' },
        status: 200
      });

      // Step 1: Build transaction
      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000', // 2 ADA
        utxos: mockUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      expect(builtTransaction).toMatchObject({
        id: expect.any(String),
        inputs: expect.arrayContaining([
          expect.objectContaining({
            tx_hash: expect.any(String),
            tx_index: expect.any(Number)
          })
        ]),
        outputs: expect.arrayContaining([
          expect.objectContaining({
            address: 'addr1test_recipient',
            amount: expect.objectContaining({
              lovelace: '2000000'
            })
          })
        ]),
        fee: expect.any(String)
      });

      // Verify fee is reasonable
      const fee = parseInt(builtTransaction.fee);
      expect(fee).toBeGreaterThan(100000); // Min fee ~0.1 ADA
      expect(fee).toBeLessThan(1000000); // Max reasonable fee ~1 ADA

      // Verify change output exists
      const changeOutput = builtTransaction.outputs.find(
        output => output.address === 'addr1test_sender'
      );
      expect(changeOutput).toBeDefined();

      // Step 2: Get signing keys
      const paymentKey = await walletKeyManager.getPaymentSigningKey(0, 0, false);
      expect(paymentKey).toBeDefined();

      // Step 3: Sign transaction
      const signedTransaction = await transactionBuilder.signTransaction(
        builtTransaction.hex,
        0, // accountIndex 
        0  // addressIndex
      );

      expect(signedTransaction).toBeDefined();
      expect(typeof signedTransaction).toBe('string');
      expect(signedTransaction.length).toBeGreaterThan(0);

      // Step 4: Submit transaction
      const submissionResult = await transactionBuilder.submitTransaction(signedTransaction);

      expect(submissionResult.txHash).toBeDefined();
      expect(submissionResult.fee).toBeDefined();
      expect(submissionResult.totalOutput).toBeDefined();
    });

    it('should handle multi-asset transactions', async () => {
      const mockUtxos = [
        {
          tx_hash: 'multiasset_tx_hash',
          tx_index: 0,
          amount: [
            { unit: 'lovelace', quantity: '10000000' }, // 10 ADA
            { unit: 'test_policy_id.test_token', quantity: '1000' }
          ],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        assets: [
          {
            policyId: 'test_policy_id',
            assetName: 'test_token',
            amount: '500'
          }
        ],
        utxos: mockUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      // Verify multi-asset output
      const recipientOutput = builtTransaction.outputs.find(
        output => output.address === 'addr1test_recipient'
      );

      expect(recipientOutput.amount['test_policy_id.test_token']).toBe('500');

      // Verify change includes remaining assets
      const changeOutput = builtTransaction.outputs.find(
        output => output.address === 'addr1test_sender'
      );

      expect(changeOutput.amount['test_policy_id.test_token']).toBe('500'); // Remaining tokens
    });

    it('should handle transactions with metadata', async () => {
      const mockUtxos = [
        {
          tx_hash: 'metadata_tx_hash',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        metadata: {
          label: 'Payment for services',
          description: 'Integration test transaction',
          reference: 'REF-12345'
        },
        utxos: mockUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      expect(builtTransaction.metadata).toBeDefined();
      expect(builtTransaction.auxiliaryData).toBeDefined();
    });
  });

  describe('Transaction Building Edge Cases', () => {
    it('should handle insufficient funds gracefully', async () => {
      const insufficientUtxos = [
        {
          tx_hash: 'insufficient_tx_hash',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '1000000' }], // Only 1 ADA
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '5000000', // Requesting 5 ADA but only have 1 ADA
        utxos: insufficientUtxos
      };

      await expect(transactionBuilder.buildTransaction(transactionRequest))
        .rejects.toThrow(/insufficient funds/i);
    });

    it('should optimize UTXO selection', async () => {
      const multipleUtxos = [
        {
          tx_hash: 'small_utxo_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '1000000' }], // 1 ADA
          address: 'addr1test_sender',
          block: 'mock_block_1',
        },
        {
          tx_hash: 'small_utxo_2',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '1000000' }], // 1 ADA
          address: 'addr1test_sender',
          block: 'mock_block_2',
        },
        {
          tx_hash: 'large_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }], // 10 ADA
          address: 'addr1test_sender',
          block: 'mock_block_3',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '3000000', // 3 ADA
        utxos: multipleUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      // Should prefer using the single large UTXO over multiple small ones
      expect(builtTransaction.inputs).toHaveLength(1);
      expect(builtTransaction.inputs[0].tx_hash).toBe('large_utxo');
    });

    it('should calculate minimum ADA for outputs with assets', async () => {
      const assetUtxos = [
        {
          tx_hash: 'asset_utxo',
          tx_index: 0,
          amount: [
            { unit: 'lovelace', quantity: '10000000' },
            { unit: 'test_policy.large_token_name_that_requires_more_ada', quantity: '1' }
          ],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000', // 1 ADA - might be too low for asset output
        assets: [
          {
            unit: 'test_policy.large_token_name_that_requires_more_ada',
            quantity: '1'
          }
        ],
        utxos: assetUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      const recipientOutput = builtTransaction.outputs.find(
        output => output.address === 'addr1test_recipient'
      );

      // ADA amount should be adjusted to meet minimum requirements
      const outputAda = parseInt(recipientOutput.amount.lovelace);
      expect(outputAda).toBeGreaterThanOrEqual(1000000); // At least 1 ADA for assets
    });
  });

  describe('Transaction Signing Integration', () => {
    it('should sign multi-input transactions', async () => {
      const multiInputUtxos = [
        {
          tx_hash: 'input_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '2000000' }],
          address: 'addr1test_sender_1',
          block: 'mock_block_1',
        },
        {
          tx_hash: 'input_2',
          tx_index: 1,
          amount: [{ unit: 'lovelace', quantity: '3000000' }],
          address: 'addr1test_sender_2',
          block: 'mock_block_2',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender_1',
        toAddress: 'addr1test_recipient',
        amount: '4000000',
        utxos: multiInputUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      // Get multiple signing keys
      const signingKeys = [
        await walletKeyManager.getPaymentSigningKey(0, 0, false),
        await walletKeyManager.getPaymentSigningKey(0, 1, false)
      ];

      const mockTransaction = { to_bytes: () => new Uint8Array([1, 2, 3, 4]) };
      const signedTransaction = await transactionBuilder.signTransaction(
        mockTransaction as any,
        signingKeys
      );

      expect(signedTransaction).toBeDefined();
    });

    it('should handle signing failures gracefully', async () => {
      const mockTransaction = { to_bytes: () => new Uint8Array([1, 2, 3, 4]) };

      // Try to sign with empty key array
      await expect(transactionBuilder.signTransaction(mockTransaction as any, []))
        .rejects.toThrow();
    });
  });

  describe('End-to-End Transaction Scenarios', () => {
    it('should complete a full wallet-to-wallet transfer', async () => {
      // Setup: Create two accounts
      await walletKeyManager.createAccount(1, 'Recipient Account');
      
      const senderAddress = await walletKeyManager.generateNewAddress(0, 0, false);
      const recipientAddress = await walletKeyManager.generateNewAddress(1, 0, false);

      // Mock sender has UTXOs
      const senderUtxos = [
        {
          tx_hash: 'sender_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }], // 10 ADA
          address: senderAddress,
          block: 'mock_block',
        }
      ];

      jest.spyOn(apiService, 'getAddressUTXOs').mockResolvedValue(senderUtxos);
      jest.spyOn(apiService, 'submitTransaction').mockResolvedValue({
        data: { hash: 'wallet_transfer_tx_hash' },
        status: 200
      });

      // Execute transfer through WalletService
      const transferResult = await walletService.sendTransaction({
        fromAccountIndex: 0,
        toAddress: recipientAddress,
        amount: '5000000', // 5 ADA
        memo: 'Internal wallet transfer'
      });

      expect(transferResult.success).toBe(true);
      expect(transferResult.txHash).toBe('wallet_transfer_tx_hash');
      expect(transferResult.transaction).toMatchObject({
        inputs: expect.any(Array),
        outputs: expect.arrayContaining([
          expect.objectContaining({
            address: recipientAddress,
            amount: expect.objectContaining({
              lovelace: '5000000'
            })
          })
        ])
      });
    });

    it('should handle transaction with custom fee', async () => {
      const mockUtxos = [
        {
          tx_hash: 'custom_fee_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '5000000',
        customFee: '500000', // 0.5 ADA custom fee
        utxos: mockUtxos
      };

      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);

      expect(builtTransaction.fee).toBe('500000');

      // Verify change calculation accounts for custom fee
      const changeOutput = builtTransaction.outputs.find(
        output => output.address === 'addr1test_sender'
      );
      const expectedChange = 10000000 - 5000000 - 500000; // Total - Amount - Fee
      expect(parseInt(changeOutput.amount.lovelace)).toBe(expectedChange);
    });
  });

  describe('Transaction Error Recovery', () => {
    it('should retry failed transaction submissions', async () => {
      const mockUtxos = [
        {
          tx_hash: 'retry_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      // Mock API to fail first two times, succeed on third
      jest.spyOn(apiService, 'submitTransaction')
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({
          data: { hash: 'retry_success_tx_hash' },
          status: 200
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

      // Should succeed after retries
      const submissionResult = await transactionBuilder.submitTransaction(signedTransaction);

      expect(submissionResult.success).toBe(true);
      expect(submissionResult.txHash).toBe('retry_success_tx_hash');
      expect(apiService.submitTransaction).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent transaction building', async () => {
      const mockUtxos = [
        {
          tx_hash: 'concurrent_utxo_1',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }],
          address: 'addr1test_sender',
          block: 'mock_block_1',
        },
        {
          tx_hash: 'concurrent_utxo_2',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '10000000' }],
          address: 'addr1test_sender',
          block: 'mock_block_2',
        }
      ];

      // Build multiple transactions concurrently
      const transactionPromises = [
        transactionBuilder.buildTransaction({
          fromAddress: 'addr1test_sender',
          toAddress: 'addr1test_recipient_1',
          amount: '2000000',
          utxos: [mockUtxos[0]]
        }),
        transactionBuilder.buildTransaction({
          fromAddress: 'addr1test_sender',
          toAddress: 'addr1test_recipient_2',
          amount: '3000000',
          utxos: [mockUtxos[1]]
        })
      ];

      const builtTransactions = await Promise.all(transactionPromises);

      expect(builtTransactions).toHaveLength(2);
      builtTransactions.forEach((tx, index) => {
        expect(tx.outputs).toContainEqual(
          expect.objectContaining({
            address: `addr1test_recipient_${index + 1}`
          })
        );
      });
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large transaction building efficiently', async () => {
      // Create many small UTXOs
      const manyUtxos = Array(100).fill(0).map((_, index) => ({
        tx_hash: `utxo_${index}`,
        tx_index: 0,
        amount: [{ unit: 'lovelace', quantity: '1000000' }], // 1 ADA each
        address: 'addr1test_sender',
        block: `mock_block_${index}`,
      }));

      const transactionRequest = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '50000000', // 50 ADA - requires many UTXOs
        utxos: manyUtxos
      };

      const startTime = Date.now();
      const builtTransaction = await transactionBuilder.buildTransaction(transactionRequest);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(builtTransaction.inputs.length).toBeGreaterThan(50); // Should use many inputs
    });

    it('should clean up sensitive data after transaction operations', async () => {
      const mockUtxos = [
        {
          tx_hash: 'cleanup_utxo',
          tx_index: 0,
          amount: [{ unit: 'lovelace', quantity: '5000000' }],
          address: 'addr1test_sender',
          block: 'mock_block',
        }
      ];

      // Build and sign transaction
      const builtTransaction = await transactionBuilder.buildTransaction({
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        utxos: mockUtxos
      });

      const paymentKey = await walletKeyManager.getPaymentSigningKey(0, 0, false);
      const mockTransaction = { to_bytes: () => new Uint8Array([1, 2, 3, 4]) };
      
      await transactionBuilder.signTransaction(mockTransaction as any, [paymentKey]);

      // Clear sensitive data
      transactionBuilder.clearSensitiveData();
      walletKeyManager.clearSensitiveData();

      // Verify cleanup
      expect(walletKeyManager.isInitialized()).toBe(false);
    });
  });
});
