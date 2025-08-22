/**
 * CryptoUtils Test Suite
 * 
 * Tests cryptographic functionality including:
 * - Secure random generation
 * - Key derivation (PBKDF2)
 * - AES encryption/decryption
 * - Memory security
 * - Error handling
 */

import { CryptoUtils } from '../../utils/CryptoUtils';
import { MemoryUtils } from '../../utils/MemoryUtils';

describe('CryptoUtils', () => {
  describe('Secure Random Generation', () => {
    it('should generate secure random bytes', () => {
      const randomBytes = CryptoUtils.generateSecureRandom(32);

      expect(randomBytes).toBeInstanceOf(Uint8Array);
      expect(randomBytes.length).toBe(32);
      expect(randomBytes.every(byte => byte >= 0 && byte <= 255)).toBe(true);
    });

    it('should generate different random values each time', () => {
      const random1 = CryptoUtils.generateSecureRandom(16);
      const random2 = CryptoUtils.generateSecureRandom(16);

      expect(random1).not.toEqual(random2);
    });

    it('should handle different byte lengths', () => {
      const lengths = [16, 32, 64, 128];

      lengths.forEach(length => {
        const randomBytes = CryptoUtils.generateSecureRandom(length);
        expect(randomBytes.length).toBe(length);
      });
    });

    it('should throw error for invalid lengths', () => {
      expect(() => CryptoUtils.generateSecureRandom(0)).toThrow();
      expect(() => CryptoUtils.generateSecureRandom(-1)).toThrow();
    });
  });

  describe('Salt Generation', () => {
    it('should generate random salt', () => {
      const salt = CryptoUtils.generateSalt();

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32); // Default salt length
    });

    it('should generate different salts each time', () => {
      const salt1 = CryptoUtils.generateSalt();
      const salt2 = CryptoUtils.generateSalt();

      expect(salt1).not.toEqual(salt2);
    });

    it('should generate custom length salts', () => {
      const customSalt = CryptoUtils.generateSalt(16);

      expect(customSalt.length).toBe(16);
    });
  });

  describe('Key Derivation (PBKDF2)', () => {
    it('should derive key from password and salt', async () => {
      const password = 'test-password-123';
      const salt = CryptoUtils.generateSalt();

      const derivedKey = await CryptoUtils.deriveKey(password, salt);

      expect(derivedKey).toBeInstanceOf(Uint8Array);
      expect(derivedKey.length).toBe(32); // Default key length
    });

    it('should produce consistent results with same inputs', async () => {
      const password = 'test-password-123';
      const salt = new Uint8Array(32).fill(1); // Fixed salt for consistency

      const key1 = await CryptoUtils.deriveKey(password, salt);
      const key2 = await CryptoUtils.deriveKey(password, salt);

      expect(key1).toEqual(key2);
    });

    it('should produce different keys for different passwords', async () => {
      const salt = new Uint8Array(32).fill(1);

      const key1 = await CryptoUtils.deriveKey('password1', salt);
      const key2 = await CryptoUtils.deriveKey('password2', salt);

      expect(key1).not.toEqual(key2);
    });

    it('should produce different keys for different salts', async () => {
      const password = 'test-password';
      const salt1 = new Uint8Array(32).fill(1);
      const salt2 = new Uint8Array(32).fill(2);

      const key1 = await CryptoUtils.deriveKey(password, salt1);
      const key2 = await CryptoUtils.deriveKey(password, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('should handle custom key lengths', async () => {
      const password = 'test-password';
      const salt = CryptoUtils.generateSalt();

      const key16 = await CryptoUtils.deriveKey(password, salt, 16);
      const key64 = await CryptoUtils.deriveKey(password, salt, 64);

      expect(key16.length).toBe(16);
      expect(key64.length).toBe(64);
    });

    it('should handle custom iteration counts', async () => {
      const password = 'test-password';
      const salt = new Uint8Array(32).fill(1);

      const key1 = await CryptoUtils.deriveKey(password, salt, 32, 1000);
      const key2 = await CryptoUtils.deriveKey(password, salt, 32, 2000);

      // Different iteration counts should produce different keys
      expect(key1).not.toEqual(key2);
    });

    it('should throw error for empty password', async () => {
      const salt = CryptoUtils.generateSalt();

      await expect(CryptoUtils.deriveKey('', salt)).rejects.toThrow();
    });

    it('should throw error for invalid salt', async () => {
      const password = 'test-password';

      await expect(CryptoUtils.deriveKey(password, new Uint8Array(0))).rejects.toThrow();
    });
  });

  describe('AES Encryption', () => {
    it('should encrypt data successfully', async () => {
      const plaintext = 'This is a secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeInstanceOf(Uint8Array);
      expect(encrypted.iv.length).toBe(16); // AES block size
      expect(encrypted.tag).toBeInstanceOf(Uint8Array);
      expect(encrypted.tag.length).toBe(16); // GCM tag size
    });

    it('should encrypt different data differently', async () => {
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted1 = await CryptoUtils.encryptAES('message1', key);
      const encrypted2 = await CryptoUtils.encryptAES('message2', key);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv); // IVs should be random
    });

    it('should encrypt same data differently each time (due to random IV)', async () => {
      const plaintext = 'secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted1 = await CryptoUtils.encryptAES(plaintext, key);
      const encrypted2 = await CryptoUtils.encryptAES(plaintext, key);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });

    it('should handle empty plaintext', async () => {
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES('', key);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeInstanceOf(Uint8Array);
      expect(encrypted.tag).toBeInstanceOf(Uint8Array);
    });

    it('should handle Unicode text', async () => {
      const unicodeText = '🔐 Encrypted 中文 emoji text! 🚀';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(unicodeText, key);

      expect(encrypted.ciphertext).toBeDefined();
    });

    it('should throw error for invalid key', async () => {
      const plaintext = 'secret message';
      const invalidKey = new Uint8Array(16); // Wrong key size for AES-256

      await expect(CryptoUtils.encryptAES(plaintext, invalidKey)).rejects.toThrow();
    });
  });

  describe('AES Decryption', () => {
    it('should decrypt data successfully', async () => {
      const plaintext = 'This is a secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      const decrypted = await CryptoUtils.decryptAES(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty plaintext decryption', async () => {
      const plaintext = '';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      const decrypted = await CryptoUtils.decryptAES(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode text decryption', async () => {
      const unicodeText = '🔐 Encrypted 中文 emoji text! 🚀';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(unicodeText, key);
      const decrypted = await CryptoUtils.decryptAES(encrypted, key);

      expect(decrypted).toBe(unicodeText);
    });

    it('should fail with wrong key', async () => {
      const plaintext = 'secret message';
      const key1 = await CryptoUtils.deriveKey('password1', CryptoUtils.generateSalt());
      const key2 = await CryptoUtils.deriveKey('password2', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key1);

      await expect(CryptoUtils.decryptAES(encrypted, key2)).rejects.toThrow();
    });

    it('should fail with tampered ciphertext', async () => {
      const plaintext = 'secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      
      // Tamper with ciphertext
      encrypted.ciphertext = encrypted.ciphertext.slice(0, -1) + 'X';

      await expect(CryptoUtils.decryptAES(encrypted, key)).rejects.toThrow();
    });

    it('should fail with tampered IV', async () => {
      const plaintext = 'secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      
      // Tamper with IV
      encrypted.iv[0] = encrypted.iv[0] ^ 1;

      await expect(CryptoUtils.decryptAES(encrypted, key)).rejects.toThrow();
    });

    it('should fail with tampered authentication tag', async () => {
      const plaintext = 'secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      
      // Tamper with tag
      encrypted.tag[0] = encrypted.tag[0] ^ 1;

      await expect(CryptoUtils.decryptAES(encrypted, key)).rejects.toThrow();
    });

    it('should throw error for invalid encrypted data format', async () => {
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());
      const invalidEncrypted = {
        ciphertext: 'invalid',
        iv: new Uint8Array(16),
        tag: new Uint8Array(16)
      };

      await expect(CryptoUtils.decryptAES(invalidEncrypted, key)).rejects.toThrow();
    });
  });

  describe('End-to-End Encryption/Decryption', () => {
    it('should encrypt and decrypt large text correctly', async () => {
      const largeText = 'Lorem ipsum dolor sit amet, '.repeat(100);
      const key = await CryptoUtils.deriveKey('strong-password-123', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(largeText, key);
      const decrypted = await CryptoUtils.decryptAES(encrypted, key);

      expect(decrypted).toBe(largeText);
    });

    it('should work with different password strengths', async () => {
      const plaintext = 'sensitive data';
      const passwords = ['weak', 'medium-strength-password', 'Very$trong!P@ssw0rd#123'];

      for (const password of passwords) {
        const salt = CryptoUtils.generateSalt();
        const key = await CryptoUtils.deriveKey(password, salt);
        
        const encrypted = await CryptoUtils.encryptAES(plaintext, key);
        const decrypted = await CryptoUtils.decryptAES(encrypted, key);

        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('Memory Security', () => {
    it('should clear sensitive data from memory', async () => {
      const password = 'sensitive-password';
      const salt = CryptoUtils.generateSalt();
      
      const key = await CryptoUtils.deriveKey(password, salt);
      
      // Verify key is created
      expect(key.length).toBe(32);
      
      // Clear the key
      MemoryUtils.zeroMemory(key);
      
      // Verify key is zeroed (all bytes should be 0)
      expect(key.every(byte => byte === 0)).toBe(true);
    });

    it('should handle secure cleanup after encryption', async () => {
      const plaintext = 'secret message';
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());

      const encrypted = await CryptoUtils.encryptAES(plaintext, key);
      
      // Should not throw when cleaning up
      expect(() => MemoryUtils.zeroMemory(key)).not.toThrow();
      expect(() => MemoryUtils.zeroMemory(encrypted.iv)).not.toThrow();
      expect(() => MemoryUtils.zeroMemory(encrypted.tag)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle crypto library errors gracefully', async () => {
      // Test with invalid parameters that should trigger crypto library errors
      const invalidSalt = new Uint8Array(1); // Too short salt
      
      await expect(CryptoUtils.deriveKey('password', invalidSalt)).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      // Test null/undefined inputs
      await expect(CryptoUtils.deriveKey(null as any, CryptoUtils.generateSalt())).rejects.toThrow();
      await expect(CryptoUtils.deriveKey('password', null as any)).rejects.toThrow();
      
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());
      await expect(CryptoUtils.encryptAES(null as any, key)).rejects.toThrow();
      await expect(CryptoUtils.encryptAES('test', null as any)).rejects.toThrow();
    });

    it('should handle concurrent operations safely', async () => {
      const password = 'test-password';
      const salt = CryptoUtils.generateSalt();
      
      // Run multiple key derivations concurrently
      const promises = Array(10).fill(0).map(() => 
        CryptoUtils.deriveKey(password, salt)
      );
      
      const results = await Promise.all(promises);
      
      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });

  describe('Performance', () => {
    it('should perform key derivation within reasonable time', async () => {
      const password = 'test-password';
      const salt = CryptoUtils.generateSalt();
      
      const startTime = Date.now();
      await CryptoUtils.deriveKey(password, salt);
      const endTime = Date.now();
      
      // Should complete within 5 seconds (adjust based on your requirements)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle multiple concurrent encryptions', async () => {
      const key = await CryptoUtils.deriveKey('password', CryptoUtils.generateSalt());
      const plaintexts = Array(10).fill(0).map((_, i) => `message ${i}`);
      
      const startTime = Date.now();
      const promises = plaintexts.map(text => CryptoUtils.encryptAES(text, key));
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});

