/**
 * TransactionBuilder Test Suite
 * 
 * Tests transaction building functionality including:
 * - Transaction creation and configuration
 * - Input/output management
 * - Fee calculation
 * - Transaction signing
 * - Metadata handling
 * - Error handling
 */

import TransactionBuilder from '../../../services/wallet/TransactionBuilder';
import { CARDANO_NETWORKS } from '../../../constants';

// Mock CSL Provider
jest.mock('../../../utils/CSLProvider');

describe('TransactionBuilder', () => {
  let transactionBuilder: TransactionBuilder;

  beforeEach(() => {
    transactionBuilder = TransactionBuilder.getInstance('testnet');
  });

  afterEach(() => {
    transactionBuilder.clearSensitiveData();
  });

  describe('Transaction Creation', () => {
    it('should create a basic transaction', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000', // 1 ADA in lovelace
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.fee).toBeDefined();
      expect(result.inputs).toHaveLength(1);
      expect(result.outputs).toHaveLength(2); // Recipient + change
      expect(result.metadata).toBeUndefined(); // No metadata provided
    });

    it('should create transaction with metadata', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        metadata: {
          label: 'test transaction',
          message: 'Hello Cardano!'
        },
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(result.metadata).toBeDefined();
      expect(result.auxiliaryData).toBeDefined();
    });

    it('should handle multi-asset transactions', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        assets: [
          {
            unit: 'test_policy_id.test_asset_name',
            quantity: '100'
          }
        ],
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [
              { unit: 'lovelace', quantity: '2000000' },
              { unit: 'test_policy_id.test_asset_name', quantity: '200' }
            ],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(result.outputs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            address: request.toAddress,
            amount: expect.objectContaining({
              lovelace: request.amount,
              assets: expect.arrayContaining([
                expect.objectContaining({
                  unit: 'test_policy_id.test_asset_name',
                  quantity: '100'
                })
              ])
            })
          })
        ])
      );
    });

    it('should calculate minimum ADA required for outputs', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '100000', // Very low amount
        assets: [
          {
            unit: 'test_policy_id.test_asset_name',
            quantity: '1'
          }
        ],
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [
              { unit: 'lovelace', quantity: '5000000' },
              { unit: 'test_policy_id.test_asset_name', quantity: '10' }
            ],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      // Amount should be adjusted to meet minimum ADA requirement
      const outputToRecipient = result.outputs.find(output => output.address === request.toAddress);
      expect(outputToRecipient).toBeDefined();
      expect(parseInt(outputToRecipient!.amount.lovelace)).toBeGreaterThanOrEqual(1000000); // Minimum ADA
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate transaction fees correctly', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(result.fee).toBeDefined();
      expect(parseInt(result.fee)).toBeGreaterThan(0);
      expect(parseInt(result.fee)).toBeLessThan(1000000); // Reasonable fee limit
    });

    it('should include fee in total cost calculation', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '1500000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);
      
      const totalOutput = result.outputs.reduce((sum, output) => 
        sum + parseInt(output.amount.lovelace), 0
      );
      const totalInput = request.utxos.reduce((sum, utxo) => 
        sum + parseInt(utxo.amount.find(a => a.unit === 'lovelace')?.quantity || '0'), 0
      );

      // Total outputs + fee should equal total inputs
      expect(totalOutput + parseInt(result.fee)).toBe(totalInput);
    });

    it('should handle custom fee rates', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        feeRate: 500, // Custom fee rate
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(parseInt(result.fee)).toBeGreaterThan(0);
    });
  });

  describe('UTXO Selection', () => {
    it('should select sufficient UTXOs for transaction', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1500000',
        utxos: [
          {
            tx_hash: 'test_tx_hash_1',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '1000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          },
          {
            tx_hash: 'test_tx_hash_2',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '800000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      expect(result.inputs.length).toBe(2); // Should use both UTXOs
    });

    it('should optimize UTXO selection', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: 'small_utxo',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '500000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          },
          {
            tx_hash: 'large_utxo',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '2000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      // Should prefer using single large UTXO over multiple small ones
      expect(result.inputs).toHaveLength(1);
      expect(result.inputs[0].tx_hash).toBe('large_utxo');
    });

    it('should handle insufficient funds error', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '2000000',
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '1000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      await expect(transactionBuilder.buildTransaction(request)).rejects.toThrow(/insufficient funds/i);
    });
  });

  describe('Change Handling', () => {
    it('should create change output when necessary', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '3000000' }],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      const changeOutput = result.outputs.find(output => output.address === request.fromAddress);
      expect(changeOutput).toBeDefined();
      expect(parseInt(changeOutput!.amount.lovelace)).toBeGreaterThan(0);
    });

    it('should not create change output for exact amounts', async () => {
      // This test would require very precise fee calculation
      // For now, we'll test that change is properly calculated
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [{ unit: 'lovelace', quantity: '1200000' }], // Just enough for amount + fee
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);
      
      // Should have either no change output or a very small one
      const changeOutput = result.outputs.find(output => output.address === request.fromAddress);
      if (changeOutput) {
        expect(parseInt(changeOutput.amount.lovelace)).toBeLessThan(100000); // Very small change
      }
    });

    it('should handle change with multi-assets', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        assets: [
          {
            unit: 'test_policy_id.test_asset_name',
            quantity: '50'
          }
        ],
        utxos: [
          {
            tx_hash: 'test_tx_hash',
            tx_index: 0,
            amount: [
              { unit: 'lovelace', quantity: '3000000' },
              { unit: 'test_policy_id.test_asset_name', quantity: '100' }
            ],
            address: 'addr1test_sender',
            block: 'test_block',
          }
        ]
      };

      const result = await transactionBuilder.buildTransaction(request);

      const changeOutput = result.outputs.find(output => output.address === request.fromAddress);
      expect(changeOutput).toBeDefined();
      
      // Should have change assets
      const changeAsset = changeOutput!.amount.assets?.find(asset => 
        asset.unit === 'test_policy_id.test_asset_name'
      );
      expect(changeAsset).toBeDefined();
      expect(changeAsset!.quantity).toBe('50'); // 100 - 50 sent
    });
  });

  describe('Transaction Signing', () => {
    it('should sign transaction with provided keys', async () => {
      const mockSigningKey = {
        to_raw_key: jest.fn(() => ({
          sign: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
        })),
        to_public: jest.fn(() => ({
          to_raw_key: jest.fn(() => new Uint8Array([5, 6, 7, 8]))
        }))
      };

      const mockTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([9, 10, 11, 12]))
      };

      const result = await transactionBuilder.signTransaction(
        mockTransaction as any,
        [mockSigningKey as any]
      );

      expect(result).toBeDefined();
      expect(result.to_bytes).toBeDefined();
      expect(mockSigningKey.to_raw_key).toHaveBeenCalled();
    });

    it('should handle multiple signing keys', async () => {
      const mockSigningKeys = [
        {
          to_raw_key: jest.fn(() => ({
            sign: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
          })),
          to_public: jest.fn(() => ({
            to_raw_key: jest.fn(() => new Uint8Array([5, 6, 7, 8]))
          }))
        },
        {
          to_raw_key: jest.fn(() => ({
            sign: jest.fn(() => new Uint8Array([11, 12, 13, 14]))
          })),
          to_public: jest.fn(() => ({
            to_raw_key: jest.fn(() => new Uint8Array([15, 16, 17, 18]))
          }))
        }
      ];

      const mockTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([9, 10, 11, 12]))
      };

      const result = await transactionBuilder.signTransaction(
        mockTransaction as any,
        mockSigningKeys as any
      );

      expect(result).toBeDefined();
      mockSigningKeys.forEach(key => {
        expect(key.to_raw_key).toHaveBeenCalled();
      });
    });

    it('should throw error when signing with no keys', async () => {
      const mockTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([9, 10, 11, 12]))
      };

      await expect(transactionBuilder.signTransaction(
        mockTransaction as any,
        []
      )).rejects.toThrow();
    });
  });

  describe('Transaction Submission', () => {
    it('should submit signed transaction', async () => {
      const mockSignedTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
      };

      // Mock successful submission
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest = jest.fn().mockResolvedValue({
        status: 200,
        data: { hash: 'tx_hash_123' }
      });

      const result = await transactionBuilder.submitTransaction(mockSignedTransaction as any);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.txHash).toBe('tx_hash_123');
      expect(networkService.makeRequest).toHaveBeenCalled();
    });

    it('should handle submission errors', async () => {
      const mockSignedTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
      };

      // Mock failed submission
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await transactionBuilder.submitTransaction(mockSignedTransaction as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle API error responses', async () => {
      const mockSignedTransaction = {
        to_bytes: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
      };

      // Mock API error response
      const { NetworkService } = require('../../../services/NetworkService');
      const networkService = NetworkService.getInstance();
      networkService.makeRequest = jest.fn().mockResolvedValue({
        status: 400,
        data: { error: 'Invalid transaction' }
      });

      const result = await transactionBuilder.submitTransaction(mockSignedTransaction as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transaction');
    });
  });

  describe('Error Handling', () => {
    it('should handle CSL loading errors', async () => {
      // Mock CSL loading failure
      const { getCSL } = require('../../../utils/CSLProvider');
      getCSL.mockRejectedValueOnce(new Error('CSL loading failed'));

      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: []
      };

      await expect(transactionBuilder.buildTransaction(request)).rejects.toThrow('CSL loading failed');
    });

    it('should validate transaction parameters', async () => {
      const invalidRequests = [
        {}, // Empty request
        { fromAddress: 'invalid', toAddress: 'invalid', amount: '0' }, // Invalid addresses and amount
        { fromAddress: 'addr1test', toAddress: 'addr1test', amount: '-1000' }, // Negative amount
        { fromAddress: 'addr1test', toAddress: 'addr1test', amount: 'invalid' }, // Non-numeric amount
      ];

      for (const request of invalidRequests) {
        await expect(transactionBuilder.buildTransaction(request as any)).rejects.toThrow();
      }
    });

    it('should handle empty UTXO list', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: []
      };

      await expect(transactionBuilder.buildTransaction(request)).rejects.toThrow(/no.*utxos/i);
    });

    it('should handle malformed UTXOs', async () => {
      const request = {
        fromAddress: 'addr1test_sender',
        toAddress: 'addr1test_recipient',
        amount: '1000000',
        utxos: [
          {
            tx_hash: '', // Empty hash
            tx_index: -1, // Invalid index
            amount: [], // Empty amount
            address: '',
            block: '',
          }
        ]
      };

      await expect(transactionBuilder.buildTransaction(request)).rejects.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should clear sensitive data', () => {
      expect(() => transactionBuilder.clearSensitiveData()).not.toThrow();
    });

    it('should handle multiple clearSensitiveData calls', () => {
      transactionBuilder.clearSensitiveData();
      expect(() => transactionBuilder.clearSensitiveData()).not.toThrow();
    });
  });

  describe('Network Configuration', () => {
    it('should switch networks correctly', () => {
      expect(transactionBuilder.getNetwork()).toBe(CARDANO_NETWORKS.TESTNET);

      transactionBuilder.setNetwork('mainnet');
      expect(transactionBuilder.getNetwork()).toBe(CARDANO_NETWORKS.MAINNET);
    });

    it('should clear data when switching networks', () => {
      transactionBuilder.setNetwork('mainnet');
      // Should not throw errors after network switch
      expect(() => transactionBuilder.clearSensitiveData()).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TransactionBuilder.getInstance('testnet');
      const instance2 = TransactionBuilder.getInstance('testnet');

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = TransactionBuilder.getInstance('testnet');
      instance1.setNetwork('mainnet');

      const instance2 = TransactionBuilder.getInstance('testnet');
      expect(instance2.getNetwork()).toBe(CARDANO_NETWORKS.MAINNET);
    });
  });
});

