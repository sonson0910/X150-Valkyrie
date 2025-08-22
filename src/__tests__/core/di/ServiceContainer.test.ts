/**
 * ServiceContainer Test Suite
 * 
 * Tests dependency injection functionality including:
 * - Service registration and resolution
 * - Singleton vs Transient lifetimes
 * - Dependency injection
 * - Circular dependency detection
 * - Scoped containers
 * - Error handling
 */

import { ServiceContainer, ServiceLifetime } from '../../../core/di/ServiceContainer';

// Mock services for testing
class MockServiceA {
  public value = 'ServiceA';
  constructor() {}
}

class MockServiceB {
  public value = 'ServiceB';
  constructor(public serviceA: MockServiceA) {}
}

class MockServiceC {
  public value = 'ServiceC';
  constructor(public serviceA: MockServiceA, public serviceB: MockServiceB) {}
}

// Circular dependency services
class MockCircularA {
  constructor(public serviceB: MockCircularB) {}
}

class MockCircularB {
  constructor(public serviceA: MockCircularA) {}
}

// Service with factory
class MockFactoryService {
  constructor(public config: any) {}
}

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(async () => {
    await container.dispose();
  });

  describe('Service Registration', () => {
    it('should register singleton services', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);

      expect(container.isRegistered('MockServiceA')).toBe(true);
    });

    it('should register transient services', () => {
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Transient);

      expect(container.isRegistered('MockServiceB')).toBe(true);
    });

    it('should register scoped services', () => {
      container.register('MockServiceC', MockServiceC, ServiceLifetime.Scoped);

      expect(container.isRegistered('MockServiceC')).toBe(true);
    });

    it('should register services with factory functions', () => {
      const factory = (container: ServiceContainer) => new MockFactoryService({ test: 'config' });
      
      container.register('MockFactoryService', factory, ServiceLifetime.Singleton);

      expect(container.isRegistered('MockFactoryService')).toBe(true);
    });

    it('should register services with dependencies', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Transient, ['MockServiceA']);

      expect(container.isRegistered('MockServiceB')).toBe(true);
    });

    it('should throw error when registering duplicate services', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);

      expect(() => {
        container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      }).toThrow(/already registered/i);
    });

    it('should allow overriding services when specified', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      
      expect(() => {
        container.register('MockServiceA', MockServiceA, ServiceLifetime.Transient, [], true);
      }).not.toThrow();
    });
  });

  describe('Service Resolution', () => {
    it('should resolve singleton services', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);

      const instance1 = container.resolve<MockServiceA>('MockServiceA');
      const instance2 = container.resolve<MockServiceA>('MockServiceA');

      expect(instance1).toBeInstanceOf(MockServiceA);
      expect(instance1).toBe(instance2); // Same instance for singleton
      expect(instance1.value).toBe('ServiceA');
    });

    it('should resolve transient services', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Transient);

      const instance1 = container.resolve<MockServiceA>('MockServiceA');
      const instance2 = container.resolve<MockServiceA>('MockServiceA');

      expect(instance1).toBeInstanceOf(MockServiceA);
      expect(instance2).toBeInstanceOf(MockServiceA);
      expect(instance1).not.toBe(instance2); // Different instances for transient
    });

    it('should resolve services with dependencies', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Transient, ['MockServiceA']);

      const serviceB = container.resolve<MockServiceB>('MockServiceB');

      expect(serviceB).toBeInstanceOf(MockServiceB);
      expect(serviceB.serviceA).toBeInstanceOf(MockServiceA);
      expect(serviceB.value).toBe('ServiceB');
      expect(serviceB.serviceA.value).toBe('ServiceA');
    });

    it('should resolve complex dependency chains', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Singleton, ['MockServiceA']);
      container.register('MockServiceC', MockServiceC, ServiceLifetime.Transient, ['MockServiceA', 'MockServiceB']);

      const serviceC = container.resolve<MockServiceC>('MockServiceC');

      expect(serviceC).toBeInstanceOf(MockServiceC);
      expect(serviceC.serviceA).toBeInstanceOf(MockServiceA);
      expect(serviceC.serviceB).toBeInstanceOf(MockServiceB);
      expect(serviceC.serviceB.serviceA).toBe(serviceC.serviceA); // Same singleton instance
    });

    it('should resolve services created by factory functions', () => {
      const factory = (container: ServiceContainer) => new MockFactoryService({ test: 'config' });
      container.register('MockFactoryService', factory, ServiceLifetime.Singleton);

      const instance = container.resolve<MockFactoryService>('MockFactoryService');

      expect(instance).toBeInstanceOf(MockFactoryService);
      expect(instance.config).toEqual({ test: 'config' });
    });

    it('should throw error when resolving unregistered service', () => {
      expect(() => {
        container.resolve('UnregisteredService');
      }).toThrow(/not registered/i);
    });

    it('should throw error for missing dependencies', () => {
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Singleton, ['MockServiceA']);

      expect(() => {
        container.resolve('MockServiceB');
      }).toThrow(/MockServiceA.*not registered/i);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect circular dependencies', () => {
      container.register('MockCircularA', MockCircularA, ServiceLifetime.Singleton, ['MockCircularB']);
      container.register('MockCircularB', MockCircularB, ServiceLifetime.Singleton, ['MockCircularA']);

      expect(() => {
        container.resolve('MockCircularA');
      }).toThrow(/circular dependency/i);
    });

    it('should detect self-referencing dependencies', () => {
      container.register('SelfReference', MockServiceA, ServiceLifetime.Singleton, ['SelfReference']);

      expect(() => {
        container.resolve('SelfReference');
      }).toThrow(/circular dependency/i);
    });

    it('should detect complex circular dependencies', () => {
      // A -> B -> C -> A
      container.register('ServiceA', MockServiceA, ServiceLifetime.Singleton, ['ServiceB']);
      container.register('ServiceB', MockServiceA, ServiceLifetime.Singleton, ['ServiceC']);
      container.register('ServiceC', MockServiceA, ServiceLifetime.Singleton, ['ServiceA']);

      expect(() => {
        container.resolve('ServiceA');
      }).toThrow(/circular dependency/i);
    });
  });

  describe('Scoped Containers', () => {
    it('should create scoped containers', () => {
      const scope = container.createScope();

      expect(scope).toBeInstanceOf(ServiceContainer);
      expect(scope).not.toBe(container);
    });

    it('should inherit registrations from parent', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      
      const scope = container.createScope();

      expect(scope.isRegistered('MockServiceA')).toBe(true);
      
      const instance = scope.resolve<MockServiceA>('MockServiceA');
      expect(instance).toBeInstanceOf(MockServiceA);
    });

    it('should maintain separate scoped instances', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Scoped);
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve<MockServiceA>('MockServiceA');
      const instance2 = scope2.resolve<MockServiceA>('MockServiceA');
      const instance3 = scope1.resolve<MockServiceA>('MockServiceA');

      expect(instance1).toBeInstanceOf(MockServiceA);
      expect(instance2).toBeInstanceOf(MockServiceA);
      expect(instance1).not.toBe(instance2); // Different scopes = different instances
      expect(instance1).toBe(instance3); // Same scope = same instance
    });

    it('should share singleton instances between scopes', () => {
      container.register('MockServiceA', MockServiceA, ServiceLifetime.Singleton);
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve<MockServiceA>('MockServiceA');
      const instance2 = scope2.resolve<MockServiceA>('MockServiceA');

      expect(instance1).toBe(instance2); // Singletons shared across scopes
    });

    it('should allow scoped registrations', () => {
      const scope = container.createScope();
      scope.register('ScopedService', MockServiceA, ServiceLifetime.Singleton);

      expect(scope.isRegistered('ScopedService')).toBe(true);
      expect(container.isRegistered('ScopedService')).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    it('should call dispose on disposable services', async () => {
      class DisposableService {
        public disposed = false;
        
        dispose() {
          this.disposed = true;
        }
      }

      container.register('DisposableService', DisposableService, ServiceLifetime.Singleton);
      
      const instance = container.resolve<DisposableService>('DisposableService');
      expect(instance.disposed).toBe(false);

      await container.dispose();
      expect(instance.disposed).toBe(true);
    });

    it('should dispose services in reverse order of creation', async () => {
      const disposeOrder: string[] = [];

      class ServiceA {
        dispose() { disposeOrder.push('A'); }
      }

      class ServiceB {
        constructor(public serviceA: ServiceA) {}
        dispose() { disposeOrder.push('B'); }
      }

      container.register('ServiceA', ServiceA, ServiceLifetime.Singleton);
      container.register('ServiceB', ServiceB, ServiceLifetime.Singleton, ['ServiceA']);

      container.resolve('ServiceB'); // Creates both A and B

      await container.dispose();

      expect(disposeOrder).toEqual(['B', 'A']); // B created after A, so disposed first
    });

    it('should handle dispose errors gracefully', async () => {
      class FaultyService {
        dispose() {
          throw new Error('Dispose error');
        }
      }

      container.register('FaultyService', FaultyService, ServiceLifetime.Singleton);
      container.resolve('FaultyService');

      // Should not throw
      await expect(container.dispose()).resolves.not.toThrow();
    });

    it('should dispose async services', async () => {
      class AsyncDisposableService {
        public disposed = false;
        
        async dispose() {
          await new Promise(resolve => setTimeout(resolve, 10));
          this.disposed = true;
        }
      }

      container.register('AsyncDisposableService', AsyncDisposableService, ServiceLifetime.Singleton);
      
      const instance = container.resolve<AsyncDisposableService>('AsyncDisposableService');
      
      await container.dispose();
      expect(instance.disposed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle constructor errors', () => {
      class FaultyService {
        constructor() {
          throw new Error('Constructor error');
        }
      }

      container.register('FaultyService', FaultyService, ServiceLifetime.Singleton);

      expect(() => {
        container.resolve('FaultyService');
      }).toThrow('Constructor error');
    });

    it('should handle factory function errors', () => {
      const faultyFactory = () => {
        throw new Error('Factory error');
      };

      container.register('FaultyFactory', faultyFactory, ServiceLifetime.Singleton);

      expect(() => {
        container.resolve('FaultyFactory');
      }).toThrow('Factory error');
    });

    it('should handle dependency resolution errors', () => {
      class ServiceWithBadDependency {
        constructor(public badDep: any) {}
      }

      container.register('ServiceWithBadDependency', ServiceWithBadDependency, ServiceLifetime.Singleton, ['NonExistentDep']);

      expect(() => {
        container.resolve('ServiceWithBadDependency');
      }).toThrow(/NonExistentDep.*not registered/i);
    });

    it('should provide meaningful error messages', () => {
      container.register('MockServiceB', MockServiceB, ServiceLifetime.Singleton, ['MockServiceA']);

      try {
        container.resolve('MockServiceB');
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('MockServiceA');
        expect(error.message).toContain('not registered');
        expect(error.message).toContain('MockServiceB');
      }
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track registration statistics', () => {
      container.register('ServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('ServiceB', MockServiceB, ServiceLifetime.Transient, ['ServiceA']);

      const stats = container.getStats();

      expect(stats.registrations).toBe(2);
      expect(stats.resolutions).toBe(0);
    });

    it('should track resolution statistics', () => {
      container.register('ServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('ServiceB', MockServiceB, ServiceLifetime.Transient, ['ServiceA']);

      container.resolve('ServiceA');
      container.resolve('ServiceB');
      container.resolve('ServiceB'); // Second resolution

      const stats = container.getStats();

      expect(stats.resolutions).toBe(3);
    });

    it('should track singleton instances', () => {
      container.register('ServiceA', MockServiceA, ServiceLifetime.Singleton);
      container.register('ServiceB', MockServiceB, ServiceLifetime.Transient, ['ServiceA']);

      container.resolve('ServiceA');
      container.resolve('ServiceB');

      const stats = container.getStats();

      expect(stats.singletonInstances).toBe(1); // Only ServiceA is singleton
    });
  });

  describe('Advanced Features', () => {
    it('should support lazy initialization', () => {
      let constructorCalled = false;

      class LazyService {
        constructor() {
          constructorCalled = true;
        }
      }

      container.register('LazyService', LazyService, ServiceLifetime.Singleton);

      expect(constructorCalled).toBe(false); // Not constructed yet

      container.resolve('LazyService');

      expect(constructorCalled).toBe(true); // Now constructed
    });

    it('should support conditional registration', () => {
      const condition = false;

      if (condition) {
        container.register('ConditionalService', MockServiceA, ServiceLifetime.Singleton);
      }

      expect(container.isRegistered('ConditionalService')).toBe(false);
    });

    it('should support service decoration', () => {
      container.register('BaseService', MockServiceA, ServiceLifetime.Singleton);

      class DecoratedService extends MockServiceA {
        public value = 'Decorated ServiceA';
      }

      container.register('BaseService', DecoratedService, ServiceLifetime.Singleton, [], true);

      const instance = container.resolve<MockServiceA>('BaseService');
      expect(instance.value).toBe('Decorated ServiceA');
    });

    it('should support interface-based registration', () => {
      interface IService {
        getValue(): string;
      }

      class ConcreteService implements IService {
        getValue() {
          return 'concrete value';
        }
      }

      container.register('IService', ConcreteService, ServiceLifetime.Singleton);

      const instance = container.resolve<IService>('IService');
      expect(instance.getValue()).toBe('concrete value');
    });
  });
});

