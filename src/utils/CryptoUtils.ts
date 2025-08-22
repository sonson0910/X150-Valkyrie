import { MemoryUtils } from './MemoryUtils';
import { environment } from '../config/Environment';

/**
 * Cryptographic utilities with secure memory management
 */
export class CryptoUtils {
  /**
   * Generate secure random bytes using the best available method
   */
  static generateSecureRandom(length: number): Uint8Array {
    return MemoryUtils.secureRandom(length);
  }

  /**
   * Generate a secure salt for cryptographic operations
   */
  static generateSalt(sizeInBytes: number = 16): Uint8Array {
    return this.generateSecureRandom(sizeInBytes);
  }

  /**
   * Derive key using PBKDF2 with secure parameters
   */
  static async deriveKey(
    password: string, 
    salt: Uint8Array, 
    iterations?: number,
    keyLength: number = 32
  ): Promise<Uint8Array> {
    const actualIterations = iterations || environment.get('PBKDF2_ITERATIONS');
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Use WebCrypto API when available
      const passwordBuffer = new TextEncoder().encode(password);
      const importedKey = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: actualIterations,
          hash: 'SHA-256',
        },
        importedKey,
        keyLength * 8
      );

      // Clear password from memory
      MemoryUtils.zeroMemory(passwordBuffer);
      
      return new Uint8Array(derivedBits);
    }
    
    // Fallback implementation (less secure, for compatibility)
    throw new Error('WebCrypto API not available - PBKDF2 fallback not implemented');
  }

  /**
   * Encrypt data using AES-GCM (more secure than CBC)
   */
  static async encryptAES(
    data: string | Uint8Array,
    key: Uint8Array,
    additionalData?: Uint8Array
  ): Promise<{
    encrypted: Uint8Array;
    iv: Uint8Array;
    tag: Uint8Array;
  }> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('WebCrypto API not available');
    }

    const dataBuffer = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;
    
    const iv = this.generateSecureRandom(12); // 96-bit IV for GCM
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: additionalData,
        tagLength: 128, // 128-bit authentication tag
      },
      cryptoKey,
      dataBuffer
    );

    const encryptedArray = new Uint8Array(encrypted);
    
    // Split encrypted data and tag (last 16 bytes)
    const actualEncrypted = encryptedArray.slice(0, -16);
    const tag = encryptedArray.slice(-16);

    // Clear sensitive data
    if (typeof data === 'string') {
      MemoryUtils.zeroMemory(dataBuffer);
    }

    return {
      encrypted: actualEncrypted,
      iv: iv,
      tag: tag
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  static async decryptAES(
    encrypted: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    additionalData?: Uint8Array
  ): Promise<Uint8Array> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('WebCrypto API not available');
    }

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Combine encrypted data and tag
    const combinedData = new Uint8Array(encrypted.length + tag.length);
    combinedData.set(encrypted);
    combinedData.set(tag, encrypted.length);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: additionalData,
        tagLength: 128,
      },
      cryptoKey,
      combinedData
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Hash data using SHA-256
   */
  static async hash(data: string | Uint8Array): Promise<Uint8Array> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('WebCrypto API not available');
    }

    const dataBuffer = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    
    // Clear input data if it was a string
    if (typeof data === 'string') {
      MemoryUtils.zeroMemory(dataBuffer);
    }

    return new Uint8Array(hashBuffer);
  }

  /**
   * Secure comparison of two arrays (constant-time)
   */
  static secureCompare(a: Uint8Array, b: Uint8Array): boolean {
    return MemoryUtils.constantTimeEquals(a, b);
  }

  /**
   * Convert between different encodings securely
   */
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace(/^0x/, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    
    return bytes;
  }

  static bytesToBase64(bytes: Uint8Array): string {
    if (typeof btoa !== 'undefined') {
      return btoa(String.fromCharCode(...bytes));
    }
    
    // Fallback for environments without btoa
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    while (i < bytes.length) {
      const a = bytes[i++];
      const b = i < bytes.length ? bytes[i++] : 0;
      const c = i < bytes.length ? bytes[i++] : 0;
      
      const bits = (a << 16) | (b << 8) | c;
      
      result += chars[(bits >> 18) & 63];
      result += chars[(bits >> 12) & 63];
      result += i - 2 < bytes.length ? chars[(bits >> 6) & 63] : '=';
      result += i - 1 < bytes.length ? chars[bits & 63] : '=';
    }
    
    return result;
  }

  static base64ToBytes(base64: string): Uint8Array {
    if (typeof atob !== 'undefined') {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    
    throw new Error('Base64 decoding not available in this environment');
  }

  /**
   * Generate a cryptographically secure UUID v4
   */
  static generateUUID(): string {
    const bytes = this.generateSecureRandom(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    const hex = this.bytesToHex(bytes);
    
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }

  /**
   * Timing-safe string comparison
   */
  static timingSafeStringCompare(a: string, b: string): boolean {
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    
    const result = this.secureCompare(aBytes, bBytes);
    
    // Clear the byte arrays
    MemoryUtils.zeroMemory(aBytes);
    MemoryUtils.zeroMemory(bBytes);
    
    return result;
  }
}

export default CryptoUtils;

