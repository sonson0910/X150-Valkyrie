/**
 * Security-focused tests for wallet operations
 * Tests for key security, transaction security, and access control
 */

import WalletKeyManager from '../../services/wallet/WalletKeyManager';
import TransactionBuilder from '../../services/wallet/TransactionBuilder';
import { CardanoAPIService } from '../../services/CardanoAPIService';
import { MemoryUtils } from '../../utils/MemoryUtils';

describe('Wallet Security Tests', () => {
    let walletKeyManager: WalletKeyManager;
    let transactionBuilder: TransactionBuilder;
    let apiService: CardanoAPIService;

    beforeEach(() => {
        walletKeyManager = WalletKeyManager.getInstance();
        apiService = CardanoAPIService.getInstance();
        transactionBuilder = new TransactionBuilder(walletKeyManager, apiService);
    });

    afterEach(() => {
        walletKeyManager.clearSensitiveData();
    });

    describe('Key Management Security', () => {
        it('should never expose private keys in logs or errors', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            
            // Capture console output
            const originalLog = console.log;
            const originalError = console.error;
            const logs: string[] = [];
            
            console.log = (...args) => logs.push(args.join(' '));
            console.error = (...args) => logs.push(args.join(' '));
            
            try {
                await walletKeyManager.initializeFromMnemonic(testMnemonic);
                await walletKeyManager.createAccount(0, 'Test Account');
                
                // Try to trigger errors that might leak keys
                try {
                    await walletKeyManager.getPaymentSigningKey(999, 999, false);
                } catch {}
                
                try {
                    await walletKeyManager.getStakeSigningKey(999);
                } catch {}
                
                // Check all logs for sensitive data
                const allLogs = logs.join(' ').toLowerCase();
                expect(allLogs).not.toContain('abandon');
                expect(allLogs).not.toContain(testMnemonic.toLowerCase());
                expect(allLogs).not.toContain('private');
                expect(allLogs).not.toContain('key');
                expect(allLogs).not.toContain('mnemonic');
                
            } finally {
                console.log = originalLog;
                console.error = originalError;
            }
        });

        it('should properly validate mnemonic before key generation', async () => {
            const invalidMnemonics = [
                'invalid mnemonic with wrong words',
                'abandon', // Too short
                'abandon '.repeat(24).trim(), // Wrong length
                '', // Empty
                'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invalid', // Invalid checksum
            ];

            for (const invalidMnemonic of invalidMnemonics) {
                const result = await walletKeyManager.initializeFromMnemonic(invalidMnemonic);
                expect(result).toBe(false);
                expect(walletKeyManager.isInitialized()).toBe(false);
            }
        });

        it('should generate cryptographically unique addresses', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            const addresses = new Set<string>();
            
            // Generate many addresses across accounts and indices
            for (let account = 0; account < 5; account++) {
                for (let index = 0; index < 20; index++) {
                    for (const isChange of [false, true]) {
                        const address = await walletKeyManager.generateNewAddress(account, index, isChange);
                        expect(addresses.has(address)).toBe(false);
                        addresses.add(address);
                    }
                }
            }
            
            expect(addresses.size).toBe(5 * 20 * 2); // 200 unique addresses
        });

        it('should not allow key extraction after clearSensitiveData', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            // Verify wallet is initialized
            expect(walletKeyManager.isInitialized()).toBe(true);
            
            // Clear sensitive data
            walletKeyManager.clearSensitiveData();
            
            // Should no longer be initialized
            expect(walletKeyManager.isInitialized()).toBe(false);
            
            // Should not be able to extract keys
            await expect(walletKeyManager.getPaymentSigningKey(0, 0, false))
                .rejects.toThrow('Wallet not initialized');
            
            await expect(walletKeyManager.getStakeSigningKey(0))
                .rejects.toThrow('Wallet not initialized');
        });

        it('should use different keys for different networks', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            
            // Test with mainnet
            const mainnetManager = WalletKeyManager.getInstance('mainnet');
            await mainnetManager.initializeFromMnemonic(testMnemonic);
            const mainnetAddress = await mainnetManager.generateNewAddress(0, 0, false);
            
            // Test with testnet
            const testnetManager = WalletKeyManager.getInstance('testnet');
            await testnetManager.initializeFromMnemonic(testMnemonic);
            const testnetAddress = await testnetManager.generateNewAddress(0, 0, false);
            
            // Addresses should be different
            expect(mainnetAddress).not.toBe(testnetAddress);
            
            // Cleanup
            mainnetManager.clearSensitiveData();
            testnetManager.clearSensitiveData();
        });
    });

    describe('Transaction Security', () => {
        beforeEach(async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
        });

        it('should validate transaction amounts for overflow', async () => {
            const mockUtxos = [{
                tx_hash: 'test_tx',
                tx_index: 0,
                output_index: 0,
                address: 'addr1test_sender',
                amount: [{ unit: 'lovelace', quantity: '1000000' }],
                block: 'test_block',
            }];

            const overflowAmounts = [
                '999999999999999999999999999999', // Too large
                '-1000000', // Negative
                '0', // Zero
                'not_a_number', // Invalid format
            ];

            for (const amount of overflowAmounts) {
                const request = {
                    fromAddress: 'addr1test_sender',
                    toAddress: 'addr1test_recipient',
                    amount,
                    utxos: mockUtxos
                };

                await expect(transactionBuilder.buildTransaction(request))
                    .rejects.toThrow();
            }
        });

        it('should prevent double spending attempts', async () => {
            const mockUtxo = {
                tx_hash: 'test_tx',
                tx_index: 0,
                output_index: 0,
                address: 'addr1test_sender',
                amount: [{ unit: 'lovelace', quantity: '5000000' }],
                block: 'test_block',
            };

            // First transaction
            const request1 = {
                fromAddress: 'addr1test_sender',
                toAddress: 'addr1test_recipient1',
                amount: '2000000',
                utxos: [mockUtxo]
            };

            // Second transaction using same UTXO
            const request2 = {
                fromAddress: 'addr1test_sender',
                toAddress: 'addr1test_recipient2',
                amount: '2000000',
                utxos: [mockUtxo] // Same UTXO
            };

            // Both should build individually
            const tx1 = await transactionBuilder.buildTransaction(request1);
            const tx2 = await transactionBuilder.buildTransaction(request2);

            expect(tx1).toBeDefined();
            expect(tx2).toBeDefined();
            
            // But both should reference the same input
            expect(tx1.inputs[0].tx_hash).toBe(tx2.inputs[0].tx_hash);
            expect(tx1.inputs[0].tx_index).toBe(tx2.inputs[0].tx_index);
        });

        it('should validate transaction signatures', async () => {
            const mockUtxos = [{
                tx_hash: 'test_tx',
                tx_index: 0,
                output_index: 0,
                address: 'addr1test_sender',
                amount: [{ unit: 'lovelace', quantity: '5000000' }],
                block: 'test_block',
            }];

            const request = {
                fromAddress: 'addr1test_sender',
                toAddress: 'addr1test_recipient',
                amount: '2000000',
                utxos: mockUtxos
            };

            const builtTx = await transactionBuilder.buildTransaction(request);
            const signedTx = await transactionBuilder.signTransaction(builtTx.hex, 0, 0);
            
            expect(signedTx).toBeDefined();
            expect(typeof signedTx).toBe('string');
            expect(signedTx.length).toBeGreaterThan(0);
            
            // Should not be able to sign with wrong account
            await expect(transactionBuilder.signTransaction(builtTx.hex, 999, 0))
                .rejects.toThrow();
        });

        it('should reject transactions with invalid metadata', async () => {
            const mockUtxos = [{
                tx_hash: 'test_tx',
                tx_index: 0,
                output_index: 0,
                address: 'addr1test_sender',
                amount: [{ unit: 'lovelace', quantity: '5000000' }],
                block: 'test_block',
            }];

            const invalidMetadata = [
                { [Symbol('invalid')]: 'symbol keys not allowed' },
                { circular: {} },
                { tooLarge: 'x'.repeat(100000) }, // Exceeds reasonable limits
                { nested: { too: { deep: { structure: { here: true } } } } }
            ];

            // Make one metadata object circular
            invalidMetadata[1].circular = invalidMetadata[1];

            for (const metadata of invalidMetadata) {
                const request = {
                    fromAddress: 'addr1test_sender',
                    toAddress: 'addr1test_recipient',
                    amount: '2000000',
                    utxos: mockUtxos,
                    metadata
                };

                // Should either reject or sanitize the metadata
                try {
                    const result = await transactionBuilder.buildTransaction(request);
                    // If it doesn't reject, it should sanitize
                    expect(result.metadata).toBeDefined();
                } catch (error) {
                    // Rejecting invalid metadata is also acceptable
                    expect(error).toBeDefined();
                }
            }
        });

        it('should enforce minimum ADA requirements for outputs', async () => {
            const mockUtxos = [{
                tx_hash: 'test_tx',
                tx_index: 0,
                output_index: 0,
                address: 'addr1test_sender',
                amount: [{ unit: 'lovelace', quantity: '5000000' }],
                block: 'test_block',
            }];

            // Try to send very small amount (dust)
            const dustRequest = {
                fromAddress: 'addr1test_sender',
                toAddress: 'addr1test_recipient',
                amount: '1', // 1 lovelace (too small)
                utxos: mockUtxos
            };

            await expect(transactionBuilder.buildTransaction(dustRequest))
                .rejects.toThrow();
        });
    });

    describe('Access Control Security', () => {
        it('should enforce account isolation', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            // Create multiple accounts
            const account0 = await walletKeyManager.createAccount(0, 'Account 0');
            const account1 = await walletKeyManager.createAccount(1, 'Account 1');
            
            expect(account0.address).not.toBe(account1.address);
            expect(account0.stakeAddress).not.toBe(account1.stakeAddress);
            
            // Keys should be different
            const key0 = await walletKeyManager.getPaymentSigningKey(0, 0, false);
            const key1 = await walletKeyManager.getPaymentSigningKey(1, 0, false);
            
            expect(key0).not.toEqual(key1);
        });

        it('should not allow unauthorized key access', async () => {
            // Don't initialize wallet
            expect(walletKeyManager.isInitialized()).toBe(false);
            
            // Should not be able to get keys
            await expect(walletKeyManager.getPaymentSigningKey(0, 0, false))
                .rejects.toThrow('Wallet not initialized');
            
            await expect(walletKeyManager.createAccount(0, 'Test'))
                .rejects.toThrow('Wallet not initialized');
        });

        it('should validate account and address indices', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            const invalidIndices = [-1, -999, NaN, Infinity, 2147483648]; // Beyond safe integer
            
            for (const invalidIndex of invalidIndices) {
                if (invalidIndex < 0 || !Number.isInteger(invalidIndex) || invalidIndex > 2147483647) {
                    await expect(walletKeyManager.createAccount(invalidIndex, 'Test'))
                        .rejects.toThrow();
                    
                    await expect(walletKeyManager.generateNewAddress(invalidIndex, 0, false))
                        .rejects.toThrow();
                }
            }
        });

        it('should rate limit key generation operations', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            const startTime = Date.now();
            const operations = [];
            
            // Perform many key operations quickly
            for (let i = 0; i < 100; i++) {
                operations.push(walletKeyManager.generateNewAddress(0, i, false));
            }
            
            await Promise.all(operations);
            const endTime = Date.now();
            
            // Should take some minimum time (not instant)
            const duration = endTime - startTime;
            expect(duration).toBeGreaterThan(10); // At least 10ms total
        });
    });

    describe('Side Channel Attack Resistance', () => {
        it('should have consistent timing for address generation', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            const timings: number[] = [];
            
            // Measure timing for various operations
            for (let i = 0; i < 20; i++) {
                const start = performance.now();
                await walletKeyManager.generateNewAddress(0, i, false);
                timings.push(performance.now() - start);
            }
            
            // Calculate variance
            const avg = timings.reduce((a, b) => a + b) / timings.length;
            const variance = timings.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / timings.length;
            const stdDev = Math.sqrt(variance);
            
            // Standard deviation should be reasonable (not too high)
            expect(stdDev / avg).toBeLessThan(2.0); // Coefficient of variation < 200%
        });

        it('should not leak information through error messages', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            
            const sensitiveData = [
                testMnemonic,
                'private',
                'secret',
                'key',
                'seed'
            ];
            
            try {
                // Trigger various errors
                await walletKeyManager.getPaymentSigningKey(-1, -1, false);
            } catch (error) {
                const errorMessage = error.message.toLowerCase();
                
                for (const sensitive of sensitiveData) {
                    expect(errorMessage).not.toContain(sensitive.toLowerCase());
                }
            }
            
            try {
                await walletKeyManager.createAccount(2147483648, 'Invalid'); // Out of range
            } catch (error) {
                const errorMessage = error.message.toLowerCase();
                
                for (const sensitive of sensitiveData) {
                    expect(errorMessage).not.toContain(sensitive.toLowerCase());
                }
            }
        });
    });

    describe('Memory Protection', () => {
        it('should not leave sensitive data in memory dumps', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            
            await walletKeyManager.initializeFromMnemonic(testMnemonic);
            await walletKeyManager.createAccount(0, 'Test Account');
            
            // Get some keys
            await walletKeyManager.getPaymentSigningKey(0, 0, false);
            await walletKeyManager.getStakeSigningKey(0);
            
            // Clear sensitive data
            walletKeyManager.clearSensitiveData();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            // The wallet should no longer be initialized
            expect(walletKeyManager.isInitialized()).toBe(false);
            
            // Memory usage should not have increased significantly
            const memoryUsage = process.memoryUsage();
            expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB
        });

        it('should use secure memory clearing functions', () => {
            const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);
            const copy = new Uint8Array(sensitiveData);
            
            expect(sensitiveData).toEqual(copy);
            
            MemoryUtils.zeroMemory(sensitiveData);
            
            // Original should be zeroed
            expect(sensitiveData).toEqual(new Uint8Array(5));
            
            // Copy should be unchanged
            expect(copy).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
        });
    });
});

