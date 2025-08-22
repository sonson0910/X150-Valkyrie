import ServiceContainer, { ServiceLifetime } from './ServiceContainer';
import { SERVICE_TOKENS } from './ServiceTokens';
import logger from '../../utils/Logger';

/**
 * Injectable decorator metadata
 */
export interface InjectableMetadata {
    token: string;
    lifetime: ServiceLifetime;
    dependencies: string[];
}

/**
 * Injection metadata storage
 */
const injectableMetadata = new Map<Function, InjectableMetadata>();
const injectableMetadataByToken = new Map<string, InjectableMetadata>();

/**
 * Injectable decorator - marks a class as injectable with DI container
 * 
 * @param token - Service token
 * @param lifetime - Service lifetime (default: SINGLETON)
 * @param dependencies - Array of dependency tokens
 */
export function Injectable(
    token: string,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: string[] = []
) {
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        const metadata: InjectableMetadata = {
            token,
            lifetime,
            dependencies
        };

        // Store metadata
        injectableMetadata.set(constructor, metadata);
        injectableMetadataByToken.set(token, metadata);

        logger.debug(`Injectable registered: ${token}`, 'Injectable', {
            token,
            lifetime,
            dependencies,
            className: constructor.name
        });

        return constructor;
    };
}

/**
 * Inject decorator - marks a parameter for dependency injection
 * 
 * @param token - Service token to inject
 */
export function Inject(token: string) {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
        const existingTokens = Reflect.getMetadata('inject:tokens', target) || [];
        existingTokens[parameterIndex] = token;
        Reflect.defineMetadata('inject:tokens', existingTokens, target);

        logger.debug(`Injection point registered: ${String(propertyKey)} parameter ${parameterIndex} -> ${token}`, 'Inject');
    };
}

/**
 * LazyInject decorator - marks a property for lazy dependency injection
 * 
 * @param token - Service token to inject
 */
export function LazyInject(token: string) {
    return function (target: any, propertyKey: string) {
        const getter = function (this: any) {
            if (!this._lazyInjectCache) {
                this._lazyInjectCache = {};
            }

            if (!this._lazyInjectCache[propertyKey]) {
                const container = ServiceContainer.getGlobal();
                this._lazyInjectCache[propertyKey] = container.resolve(token);
            }

            return this._lazyInjectCache[propertyKey];
        };

        const setter = function (this: any, value: any) {
            if (!this._lazyInjectCache) {
                this._lazyInjectCache = {};
            }
            this._lazyInjectCache[propertyKey] = value;
        };

        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter,
            enumerable: true,
            configurable: true
        });

        logger.debug(`Lazy injection property registered: ${propertyKey} -> ${token}`, 'LazyInject');
    };
}

/**
 * PostConstruct decorator - marks a method to be called after dependency injection
 */
export function PostConstruct(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existingMethods = Reflect.getMetadata('postconstruct:methods', target.constructor) || [];
    existingMethods.push(propertyKey);
    Reflect.defineMetadata('postconstruct:methods', existingMethods, target.constructor);

    logger.debug(`PostConstruct method registered: ${propertyKey}`, 'PostConstruct');
}

/**
 * PreDestroy decorator - marks a method to be called before service disposal
 */
export function PreDestroy(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existingMethods = Reflect.getMetadata('predestroy:methods', target.constructor) || [];
    existingMethods.push(propertyKey);
    Reflect.defineMetadata('predestroy:methods', existingMethods, target.constructor);

    logger.debug(`PreDestroy method registered: ${propertyKey}`, 'PreDestroy');
}

/**
 * Optional decorator - marks a dependency as optional
 */
export function Optional(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingOptional = Reflect.getMetadata('inject:optional', target) || [];
    existingOptional[parameterIndex] = true;
    Reflect.defineMetadata('inject:optional', existingOptional, target);

    logger.debug(`Optional injection registered: ${String(propertyKey)} parameter ${parameterIndex}`, 'Optional');
}

/**
 * ServiceFactory - Utilities for creating and managing injectable services
 */
export class ServiceFactory {
    /**
     * Create instance with dependency injection
     */
    static create<T>(
        constructor: { new(...args: any[]): T },
        container: ServiceContainer = ServiceContainer.getGlobal()
    ): T {
        try {
            // Get injection metadata
            const tokens = Reflect.getMetadata('inject:tokens', constructor) || [];
            const optional = Reflect.getMetadata('inject:optional', constructor) || [];

            // Resolve dependencies
            const dependencies: any[] = [];
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token) {
                    if (optional[i]) {
                        dependencies[i] = container.tryResolve(token);
                    } else {
                        dependencies[i] = container.resolve(token);
                    }
                }
            }

            // Create instance
            const instance = new constructor(...dependencies);

            // Call PostConstruct methods
            const postConstructMethods = Reflect.getMetadata('postconstruct:methods', constructor) || [];
            for (const methodName of postConstructMethods) {
                if (typeof instance[methodName as keyof T] === 'function') {
                    await (instance[methodName as keyof T] as any).call(instance);
                }
            }

            logger.debug(`Service instance created: ${constructor.name}`, 'ServiceFactory.create', {
                dependencies: tokens,
                postConstructMethods
            });

            return instance;

        } catch (error) {
            logger.error(`Failed to create service instance: ${constructor.name}`, 'ServiceFactory.create', error);
            throw new Error(`Service creation failed: ${error}`);
        }
    }

    /**
     * Dispose service instance
     */
    static async dispose<T>(instance: T): Promise<void> {
        try {
            if (!instance || typeof instance !== 'object') {
                return;
            }

            const constructor = (instance as any).constructor;
            const preDestroyMethods = Reflect.getMetadata('predestroy:methods', constructor) || [];

            // Call PreDestroy methods
            for (const methodName of preDestroyMethods) {
                if (typeof (instance as any)[methodName] === 'function') {
                    await (instance as any)[methodName].call(instance);
                }
            }

            // Call dispose if exists
            if (typeof (instance as any).dispose === 'function') {
                await (instance as any).dispose.call(instance);
            }

            logger.debug(`Service instance disposed: ${constructor.name}`, 'ServiceFactory.dispose', {
                preDestroyMethods
            });

        } catch (error) {
            logger.error('Failed to dispose service instance', 'ServiceFactory.dispose', error);
        }
    }

    /**
     * Register all injectable classes with container
     */
    static registerAll(container: ServiceContainer): void {
        try {
            let registeredCount = 0;

            for (const [constructor, metadata] of injectableMetadata.entries()) {
                const factory = (c: ServiceContainer) => ServiceFactory.create(constructor as any, c);

                container.register(
                    metadata.token,
                    factory,
                    metadata.lifetime,
                    metadata.dependencies
                );

                registeredCount++;
            }

            logger.info('Injectable services registered', 'ServiceFactory.registerAll', {
                registeredCount,
                totalInjectables: injectableMetadata.size
            });

        } catch (error) {
            logger.error('Failed to register injectable services', 'ServiceFactory.registerAll', error);
            throw new Error(`Injectable registration failed: ${error}`);
        }
    }

    /**
     * Get injectable metadata
     */
    static getMetadata(constructorOrToken: Function | string): InjectableMetadata | null {
        if (typeof constructorOrToken === 'string') {
            return injectableMetadataByToken.get(constructorOrToken) || null;
        } else {
            return injectableMetadata.get(constructorOrToken) || null;
        }
    }

    /**
     * Get all injectable metadata
     */
    static getAllMetadata(): Array<{ constructor: Function; metadata: InjectableMetadata }> {
        return Array.from(injectableMetadata.entries()).map(([constructor, metadata]) => ({
            constructor,
            metadata
        }));
    }

    /**
     * Clear all metadata (for testing)
     */
    static clearMetadata(): void {
        injectableMetadata.clear();
        injectableMetadataByToken.clear();
        logger.debug('Injectable metadata cleared', 'ServiceFactory.clearMetadata');
    }
}

/**
 * ServiceReference - Lazy service reference for avoiding circular dependencies
 */
export class ServiceReference<T> {
    private _instance: T | null = null;
    private _container: ServiceContainer;
    private _token: string;

    constructor(token: string, container: ServiceContainer = ServiceContainer.getGlobal()) {
        this._token = token;
        this._container = container;
    }

    /**
     * Get service instance (lazy)
     */
    get instance(): T {
        if (!this._instance) {
            this._instance = this._container.resolve<T>(this._token);
        }
        return this._instance;
    }

    /**
     * Check if service is available
     */
    get isAvailable(): boolean {
        return this._container.isRegistered(this._token);
    }

    /**
     * Try to get service instance
     */
    tryGet(): T | null {
        try {
            return this.instance;
        } catch {
            return null;
        }
    }

    /**
     * Clear cached instance
     */
    clearCache(): void {
        this._instance = null;
    }
}

/**
 * Helper function to create service reference
 */
export function createServiceRef<T>(token: string, container?: ServiceContainer): ServiceReference<T> {
    return new ServiceReference<T>(token, container);
}

/**
 * Migration helper - convert singleton getInstance to DI pattern
 */
export function createMigrationFactory<T>(
    legacyGetInstance: () => T,
    token: string
): (container: ServiceContainer) => T {
    return (container: ServiceContainer) => {
        try {
            // Try to get from container first
            const existing = container.tryResolve<T>(token);
            if (existing) {
                return existing;
            }

            // Fallback to legacy getInstance
            const instance = legacyGetInstance();
            
            logger.debug(`Migration factory used for ${token}`, 'createMigrationFactory');
            
            return instance;

        } catch (error) {
            logger.warn(`Migration factory fallback for ${token}`, 'createMigrationFactory', error);
            return legacyGetInstance();
        }
    };
}

export default {
    Injectable,
    Inject,
    LazyInject,
    PostConstruct,
    PreDestroy,
    Optional,
    ServiceFactory,
    ServiceReference,
    createServiceRef,
    createMigrationFactory
};

