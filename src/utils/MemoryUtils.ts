/**
 * Memory management utilities for sensitive data
 */

export class MemoryUtils {
  /**
   * Zero out a Uint8Array or Buffer to prevent memory leaks
   */
  static zeroMemory(data: Uint8Array | Buffer): void {
    if (!data) return;
    
    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }

  /**
   * Zero out a string by creating a new buffer and overwriting
   * Note: This doesn't guarantee the original string is cleared from memory
   * but it's a best-effort approach
   */
  static zeroString(str: string): void {
    if (!str) return;
    
    // Create buffer from string and zero it
    const buffer = Buffer.from(str, 'utf8');
    this.zeroMemory(buffer);
  }

  /**
   * Create a secure copy of sensitive data that can be properly cleared
   */
  static createSecureBuffer(data: string | Uint8Array): Uint8Array {
    if (typeof data === 'string') {
      return new Uint8Array(Buffer.from(data, 'utf8'));
    }
    return new Uint8Array(data);
  }

  /**
   * Compare two buffers in constant time to prevent timing attacks
   */
  static constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Generate cryptographically secure random bytes
   */
  static secureRandom(length: number): Uint8Array {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint8Array(length));
    }
    
    // Fallback for environments without crypto.getRandomValues
    const buffer = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }

  /**
   * Force garbage collection if available (mainly for development)
   */
  static forceGC(): void {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  /**
   * Secure cleanup for sensitive objects
   */
  static secureCleanup(obj: any): void {
    if (!obj) return;

    // Zero out string properties
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = '';
      } else if (obj[key] instanceof Uint8Array || Buffer.isBuffer(obj[key])) {
        this.zeroMemory(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.secureCleanup(obj[key]);
      }
    }

    // Clear all properties
    for (const key in obj) {
      delete obj[key];
    }
  }
}

/**
 * Decorator for auto-cleanup of sensitive data in class methods
 */
export function secureMethod(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = function (...args: any[]) {
    try {
      const result = method.apply(this, args);
      
      // If method returns a promise, handle cleanup after resolution
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          // Cleanup sensitive arguments
          args.forEach(arg => {
            if (typeof arg === 'string' && arg.length > 10) {
              MemoryUtils.zeroString(arg);
            }
          });
        });
      }
      
      // Immediate cleanup for sync methods
      args.forEach(arg => {
        if (typeof arg === 'string' && arg.length > 10) {
          MemoryUtils.zeroString(arg);
        }
      });
      
      return result;
    } catch (error) {
      // Cleanup even on error
      args.forEach(arg => {
        if (typeof arg === 'string' && arg.length > 10) {
          MemoryUtils.zeroString(arg);
        }
      });
      throw error;
    }
  };

  return descriptor;
}

export default MemoryUtils;

