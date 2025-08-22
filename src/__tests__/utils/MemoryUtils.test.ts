/**
 * MemoryUtils Test Suite
 * 
 * Tests memory security functionality including:
 * - Secure memory zeroing
 * - Buffer management
 * - String security
 * - Memory cleanup
 * - Security decorators
 */

import { MemoryUtils } from '../../utils/MemoryUtils';

describe('MemoryUtils', () => {
  describe('Memory Zeroing', () => {
    it('should zero Uint8Array buffers', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      
      MemoryUtils.zeroMemory(buffer);
      
      expect(Array.from(buffer)).toEqual([0, 0, 0, 0, 0]);
    });

    it('should zero ArrayBuffer', () => {
      const arrayBuffer = new ArrayBuffer(8);
      const view = new Uint8Array(arrayBuffer);
      view.set([1, 2, 3, 4, 5, 6, 7, 8]);
      
      MemoryUtils.zeroMemory(arrayBuffer);
      
      expect(Array.from(view)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('should zero regular arrays', () => {
      const array = [1, 2, 3, 4, 5];
      
      MemoryUtils.zeroMemory(array);
      
      expect(array).toEqual([0, 0, 0, 0, 0]);
    });

    it('should handle empty buffers', () => {
      const emptyBuffer = new Uint8Array(0);
      
      expect(() => {
        MemoryUtils.zeroMemory(emptyBuffer);
      }).not.toThrow();
      
      expect(emptyBuffer.length).toBe(0);
    });

    it('should handle null and undefined', () => {
      expect(() => {
        MemoryUtils.zeroMemory(null);
        MemoryUtils.zeroMemory(undefined);
      }).not.toThrow();
    });

    it('should handle large buffers efficiently', () => {
      const largeBuffer = new Uint8Array(1000000); // 1MB
      largeBuffer.fill(255); // Fill with non-zero values
      
      const startTime = Date.now();
      MemoryUtils.zeroMemory(largeBuffer);
      const endTime = Date.now();
      
      // Should complete quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verify it's actually zeroed
      expect(largeBuffer.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('String Security', () => {
    it('should attempt to zero string content', () => {
      const sensitiveString = 'password123';
      
      // Note: In JavaScript, strings are immutable, so this is a best-effort operation
      expect(() => {
        MemoryUtils.zeroString(sensitiveString);
      }).not.toThrow();
    });

    it('should handle empty strings', () => {
      expect(() => {
        MemoryUtils.zeroString('');
      }).not.toThrow();
    });

    it('should handle null and undefined strings', () => {
      expect(() => {
        MemoryUtils.zeroString(null);
        MemoryUtils.zeroString(undefined);
      }).not.toThrow();
    });

    it('should handle unicode strings', () => {
      const unicodeString = '🔐 password with émojis 中文';
      
      expect(() => {
        MemoryUtils.zeroString(unicodeString);
      }).not.toThrow();
    });
  });

  describe('Secure Random Generation', () => {
    it('should generate secure random bytes', () => {
      const randomBytes = MemoryUtils.secureRandom(32);
      
      expect(randomBytes).toBeInstanceOf(Uint8Array);
      expect(randomBytes.length).toBe(32);
      
      // Should not be all zeros (extremely unlikely with secure random)
      expect(randomBytes.some(byte => byte !== 0)).toBe(true);
    });

    it('should generate different random values each time', () => {
      const random1 = MemoryUtils.secureRandom(16);
      const random2 = MemoryUtils.secureRandom(16);
      
      expect(random1).not.toEqual(random2);
    });

    it('should handle different lengths', () => {
      const lengths = [0, 1, 16, 32, 64, 128, 256];
      
      lengths.forEach(length => {
        const randomBytes = MemoryUtils.secureRandom(length);
        expect(randomBytes.length).toBe(length);
      });
    });

    it('should handle large random generation', () => {
      const largeRandom = MemoryUtils.secureRandom(100000); // 100KB
      
      expect(largeRandom.length).toBe(100000);
      
      // Should have good entropy (not all same values)
      const uniqueValues = new Set(largeRandom);
      expect(uniqueValues.size).toBeGreaterThan(200); // Should have many unique bytes
    });

    it('should throw error for negative lengths', () => {
      expect(() => {
        MemoryUtils.secureRandom(-1);
      }).toThrow();
    });
  });

  describe('Secure Buffer Creation', () => {
    it('should create secure buffers', () => {
      const buffer = MemoryUtils.createSecureBuffer(64);
      
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(64);
      
      // Should be initially zeroed for security
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });

    it('should create buffers of different sizes', () => {
      const sizes = [0, 1, 16, 32, 64, 128, 256, 1024];
      
      sizes.forEach(size => {
        const buffer = MemoryUtils.createSecureBuffer(size);
        expect(buffer.length).toBe(size);
      });
    });

    it('should throw error for negative sizes', () => {
      expect(() => {
        MemoryUtils.createSecureBuffer(-1);
      }).toThrow();
    });

    it('should create large secure buffers', () => {
      const largeBuffer = MemoryUtils.createSecureBuffer(1000000); // 1MB
      
      expect(largeBuffer.length).toBe(1000000);
      expect(largeBuffer.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Secure Cleanup', () => {
    it('should perform secure cleanup on objects', () => {
      const sensitiveObject = {
        password: 'secret123',
        key: new Uint8Array([1, 2, 3, 4]),
        data: [5, 6, 7, 8]
      };
      
      expect(() => {
        MemoryUtils.secureCleanup(sensitiveObject);
      }).not.toThrow();
      
      // Properties should be zeroed or cleared
      expect(sensitiveObject.key.every(byte => byte === 0)).toBe(true);
      expect(sensitiveObject.data.every(val => val === 0)).toBe(true);
    });

    it('should handle nested objects', () => {
      const nestedObject = {
        outer: {
          inner: {
            secret: new Uint8Array([1, 2, 3]),
            data: [4, 5, 6]
          }
        }
      };
      
      expect(() => {
        MemoryUtils.secureCleanup(nestedObject);
      }).not.toThrow();
    });

    it('should handle circular references', () => {
      const circularObject: any = {
        data: new Uint8Array([1, 2, 3])
      };
      circularObject.self = circularObject;
      
      expect(() => {
        MemoryUtils.secureCleanup(circularObject);
      }).not.toThrow();
    });

    it('should handle arrays of objects', () => {
      const arrayOfObjects = [
        { key: new Uint8Array([1, 2]) },
        { key: new Uint8Array([3, 4]) },
        { key: new Uint8Array([5, 6]) }
      ];
      
      expect(() => {
        MemoryUtils.secureCleanup(arrayOfObjects);
      }).not.toThrow();
      
      arrayOfObjects.forEach(obj => {
        expect(obj.key.every(byte => byte === 0)).toBe(true);
      });
    });

    it('should handle null and undefined', () => {
      expect(() => {
        MemoryUtils.secureCleanup(null);
        MemoryUtils.secureCleanup(undefined);
      }).not.toThrow();
    });
  });

  describe('Constant Time Comparison', () => {
    it('should compare equal arrays correctly', () => {
      const array1 = new Uint8Array([1, 2, 3, 4, 5]);
      const array2 = new Uint8Array([1, 2, 3, 4, 5]);
      
      const result = MemoryUtils.constantTimeEquals(array1, array2);
      
      expect(result).toBe(true);
    });

    it('should compare different arrays correctly', () => {
      const array1 = new Uint8Array([1, 2, 3, 4, 5]);
      const array2 = new Uint8Array([1, 2, 3, 4, 6]);
      
      const result = MemoryUtils.constantTimeEquals(array1, array2);
      
      expect(result).toBe(false);
    });

    it('should compare arrays of different lengths', () => {
      const array1 = new Uint8Array([1, 2, 3]);
      const array2 = new Uint8Array([1, 2, 3, 4]);
      
      const result = MemoryUtils.constantTimeEquals(array1, array2);
      
      expect(result).toBe(false);
    });

    it('should handle empty arrays', () => {
      const empty1 = new Uint8Array(0);
      const empty2 = new Uint8Array(0);
      
      const result = MemoryUtils.constantTimeEquals(empty1, empty2);
      
      expect(result).toBe(true);
    });

    it('should take constant time regardless of data', () => {
      const size = 1000;
      const array1 = new Uint8Array(size).fill(0);
      const array2Equal = new Uint8Array(size).fill(0);
      const array2DiffFirst = new Uint8Array(size).fill(0);
      array2DiffFirst[0] = 1;
      const array2DiffLast = new Uint8Array(size).fill(0);
      array2DiffLast[size - 1] = 1;
      
      // Time the operations
      const times = [];
      
      const testCases = [
        [array1, array2Equal],
        [array1, array2DiffFirst],
        [array1, array2DiffLast]
      ];
      
      testCases.forEach(([a1, a2]) => {
        const start = process.hrtime.bigint();
        MemoryUtils.constantTimeEquals(a1, a2);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      });
      
      // Times should be similar (within 50% of each other for constant time)
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const ratio = maxTime / minTime;
      
      expect(ratio).toBeLessThan(1.5); // Should be relatively constant time
    });

    it('should handle null and undefined inputs', () => {
      const array = new Uint8Array([1, 2, 3]);
      
      expect(MemoryUtils.constantTimeEquals(null, null)).toBe(true);
      expect(MemoryUtils.constantTimeEquals(array, null)).toBe(false);
      expect(MemoryUtils.constantTimeEquals(null, array)).toBe(false);
      expect(MemoryUtils.constantTimeEquals(undefined, undefined)).toBe(true);
    });
  });

  describe('Security Decorator', () => {
    it('should work with @secureMethod decorator', () => {
      class TestClass {
        private sensitiveData = new Uint8Array([1, 2, 3, 4]);
        
        @MemoryUtils.secureMethod
        processData() {
          // Simulate some processing
          return this.sensitiveData.length;
        }
        
        getSensitiveData() {
          return this.sensitiveData;
        }
      }
      
      const instance = new TestClass();
      const result = instance.processData();
      
      expect(result).toBe(4);
      
      // After the method, sensitive data should be cleared
      const sensitiveData = instance.getSensitiveData();
      expect(sensitiveData.every(byte => byte === 0)).toBe(true);
    });

    it('should handle decorator errors gracefully', () => {
      class TestClass {
        @MemoryUtils.secureMethod
        throwingMethod() {
          throw new Error('Test error');
        }
      }
      
      const instance = new TestClass();
      
      expect(() => {
        instance.throwingMethod();
      }).toThrow('Test error');
      
      // Should still attempt cleanup even after error
    });

    it('should work with async methods', async () => {
      class TestClass {
        private sensitiveData = new Uint8Array([1, 2, 3, 4]);
        
        @MemoryUtils.secureMethod
        async asyncProcessData() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return this.sensitiveData.length;
        }
        
        getSensitiveData() {
          return this.sensitiveData;
        }
      }
      
      const instance = new TestClass();
      const result = await instance.asyncProcessData();
      
      expect(result).toBe(4);
      
      // After the async method, sensitive data should be cleared
      const sensitiveData = instance.getSensitiveData();
      expect(sensitiveData.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle memory operations efficiently', () => {
      const bufferSizes = [1000, 10000, 100000];
      
      bufferSizes.forEach(size => {
        const buffer = new Uint8Array(size);
        buffer.fill(255);
        
        const startTime = Date.now();
        MemoryUtils.zeroMemory(buffer);
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(50); // Should be fast
        expect(buffer.every(byte => byte === 0)).toBe(true);
      });
    });

    it('should not cause memory leaks', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and clean up many buffers
      for (let i = 0; i < 1000; i++) {
        const buffer = MemoryUtils.createSecureBuffer(1024);
        buffer.fill(i % 256);
        MemoryUtils.zeroMemory(buffer);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-standard buffer types', () => {
      const int32Array = new Int32Array([1, 2, 3, 4]);
      const float64Array = new Float64Array([1.1, 2.2, 3.3]);
      
      expect(() => {
        MemoryUtils.zeroMemory(int32Array);
        MemoryUtils.zeroMemory(float64Array);
      }).not.toThrow();
      
      expect(int32Array.every(val => val === 0)).toBe(true);
      expect(float64Array.every(val => val === 0)).toBe(true);
    });

    it('should handle objects without enumerable properties', () => {
      const obj = Object.create(null);
      Object.defineProperty(obj, 'secret', {
        value: new Uint8Array([1, 2, 3]),
        enumerable: false
      });
      
      expect(() => {
        MemoryUtils.secureCleanup(obj);
      }).not.toThrow();
    });

    it('should handle frozen and sealed objects', () => {
      const frozenObj = Object.freeze({
        data: new Uint8Array([1, 2, 3])
      });
      
      const sealedObj = Object.seal({
        data: new Uint8Array([4, 5, 6])
      });
      
      expect(() => {
        MemoryUtils.secureCleanup(frozenObj);
        MemoryUtils.secureCleanup(sealedObj);
      }).not.toThrow();
    });

    it('should handle very large data structures', () => {
      const largeObject = {
        arrays: Array(1000).fill(0).map(() => new Uint8Array(1000).fill(255))
      };
      
      const startTime = Date.now();
      MemoryUtils.secureCleanup(largeObject);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
      
      // Verify cleanup
      largeObject.arrays.forEach(arr => {
        expect(arr.every(byte => byte === 0)).toBe(true);
      });
    });
  });
});

