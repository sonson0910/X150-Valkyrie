import logger from '../../utils/Logger';

export enum ServiceLifetime {
    SINGLETON = 'singleton',
    TRANSIENT = 'transient',
    SCOPED = 'scoped'
}

export interface ServiceDefinition<T = any> {
    token: string;
    factory: (container: ServiceContainer) => T;
    lifetime: ServiceLifetime;
    dependencies?: string[];
    instance?: T;
    isRegistered?: boolean;
}

export interface ServiceMetadata {
    token: string;
    dependencies: string[];
    lifetime: ServiceLifetime;
    isRegistered: boolean;
    hasInstance: boolean;
}

/**
 * ServiceContainer - Comprehensive Dependency Injection Container
 * 
 * Features:
 * - Type-safe service registration and resolution
 * - Multiple service lifetimes (Singleton, Transient, Scoped)
 * - Circular dependency detection
 * - Lazy initialization
 * - Service metadata and introspection
 * - Performance monitoring
 * - Thread-safe operations
 */
export class ServiceContainer {
    private static globalInstance: ServiceContainer;
    private services: Map<string, ServiceDefinition> = new Map();
    private resolutionStack: Set<string> = new Set();
    private scopedInstances: Map<string, any> = new Map();
    private resolutionMetrics: Map<string, { count: number; totalTime: number; averageTime: number }> = new Map();

    /**
     * Get global container instance
     */
    static getGlobal(): ServiceContainer {
        if (!ServiceContainer.globalInstance) {
            ServiceContainer.globalInstance = new ServiceContainer();
        }
        return ServiceContainer.globalInstance;
    }

    /**
     * Create new container instance
     */
    static create(): ServiceContainer {
        return new ServiceContainer();
    }

    /**
     * Register a service with the container
     */
    register<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
        dependencies: string[] = []
    ): ServiceContainer {
        try {
            if (this.services.has(token)) {
                logger.warn(`Service '${token}' is already registered, overwriting`, 'ServiceContainer.register');
            }

            const definition: ServiceDefinition<T> = {
                token,
                factory,
                lifetime,
                dependencies,
                isRegistered: true
            };

            this.services.set(token, definition);

            logger.debug(`Service registered: ${token}`, 'ServiceContainer.register', {
                token,
                lifetime,
                dependencies
            });

            return this;

        } catch (error) {
            logger.error(`Failed to register service '${token}'`, 'ServiceContainer.register', error);
            throw new Error(`Service registration failed: ${error}`);
        }
    }

    /**
     * Register singleton service
     */
    registerSingleton<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        dependencies: string[] = []
    ): ServiceContainer {
        return this.register(token, factory, ServiceLifetime.SINGLETON, dependencies);
    }

    /**
     * Register transient service
     */
    registerTransient<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        dependencies: string[] = []
    ): ServiceContainer {
        return this.register(token, factory, ServiceLifetime.TRANSIENT, dependencies);
    }

    /**
     * Register scoped service
     */
    registerScoped<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        dependencies: string[] = []
    ): ServiceContainer {
        return this.register(token, factory, ServiceLifetime.SCOPED, dependencies);
    }

    /**
     * Register instance (pre-created object)
     */
    registerInstance<T>(token: string, instance: T): ServiceContainer {
        try {
            const definition: ServiceDefinition<T> = {
                token,
                factory: () => instance,
                lifetime: ServiceLifetime.SINGLETON,
                dependencies: [],
                instance,
                isRegistered: true
            };

            this.services.set(token, definition);

            logger.debug(`Instance registered: ${token}`, 'ServiceContainer.registerInstance');

            return this;

        } catch (error) {
            logger.error(`Failed to register instance '${token}'`, 'ServiceContainer.registerInstance', error);
            throw new Error(`Instance registration failed: ${error}`);
        }
    }

    /**
     * Resolve service by token
     */
    resolve<T>(token: string): T {
        const startTime = performance.now();

        try {
            const instance = this.resolveInternal<T>(token);
            
            // Update resolution metrics
            this.updateResolutionMetrics(token, performance.now() - startTime);

            return instance;

        } catch (error) {
            logger.error(`Failed to resolve service '${token}'`, 'ServiceContainer.resolve', error);
            throw new Error(`Service resolution failed for '${token}': ${error}`);
        } finally {
            // Clear resolution stack
            this.resolutionStack.clear();
        }
    }

    /**
     * Try to resolve service, return null if not found
     */
    tryResolve<T>(token: string): T | null {
        try {
            return this.resolve<T>(token);
        } catch (error) {
            logger.debug(`Service '${token}' could not be resolved`, 'ServiceContainer.tryResolve', error);
            return null;
        }
    }

    /**
     * Check if service is registered
     */
    isRegistered(token: string): boolean {
        return this.services.has(token) && this.services.get(token)!.isRegistered === true;
    }

    /**
     * Get all registered service tokens
     */
    getRegisteredTokens(): string[] {
        return Array.from(this.services.keys()).filter(token => 
            this.services.get(token)!.isRegistered === true
        );
    }

    /**
     * Get service metadata
     */
    getServiceMetadata(token: string): ServiceMetadata | null {
        const definition = this.services.get(token);
        if (!definition) {
            return null;
        }

        return {
            token: definition.token,
            dependencies: definition.dependencies || [],
            lifetime: definition.lifetime,
            isRegistered: definition.isRegistered || false,
            hasInstance: !!definition.instance
        };
    }

    /**
     * Get all services metadata
     */
    getAllServicesMetadata(): ServiceMetadata[] {
        return Array.from(this.services.values())
            .filter(def => def.isRegistered)
            .map(def => ({
                token: def.token,
                dependencies: def.dependencies || [],
                lifetime: def.lifetime,
                isRegistered: def.isRegistered || false,
                hasInstance: !!def.instance
            }));
    }

    /**
     * Get resolution metrics
     */
    getResolutionMetrics(): Map<string, { count: number; totalTime: number; averageTime: number }> {
        return new Map(this.resolutionMetrics);
    }

    /**
     * Clear scoped instances
     */
    clearScope(): void {
        try {
            this.scopedInstances.clear();
            logger.debug('Scoped instances cleared', 'ServiceContainer.clearScope');
        } catch (error) {
            logger.error('Failed to clear scoped instances', 'ServiceContainer.clearScope', error);
        }
    }

    /**
     * Dispose container and all singleton instances
     */
    dispose(): void {
        try {
            // Dispose services that implement IDisposable
            for (const [token, definition] of this.services.entries()) {
                if (definition.instance && typeof definition.instance.dispose === 'function') {
                    try {
                        definition.instance.dispose();
                        logger.debug(`Service '${token}' disposed`, 'ServiceContainer.dispose');
                    } catch (error) {
                        logger.warn(`Failed to dispose service '${token}'`, 'ServiceContainer.dispose', error);
                    }
                }
            }

            // Clear all collections
            this.services.clear();
            this.scopedInstances.clear();
            this.resolutionStack.clear();
            this.resolutionMetrics.clear();

            logger.info('ServiceContainer disposed', 'ServiceContainer.dispose');

        } catch (error) {
            logger.error('Failed to dispose ServiceContainer', 'ServiceContainer.dispose', error);
        }
    }

    /**
     * Create child container
     */
    createChild(): ServiceContainer {
        const child = new ServiceContainer();
        
        // Copy parent registrations
        for (const [token, definition] of this.services.entries()) {
            child.services.set(token, { ...definition, instance: undefined });
        }

        logger.debug('Child container created', 'ServiceContainer.createChild', {
            parentServices: this.services.size,
            childServices: child.services.size
        });

        return child;
    }

    /**
     * Validate container configuration
     */
    validate(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        try {
            // Check for circular dependencies
            for (const [token, definition] of this.services.entries()) {
                if (definition.isRegistered) {
                    const circularPath = this.detectCircularDependencies(token, new Set());
                    if (circularPath) {
                        errors.push(`Circular dependency detected: ${circularPath.join(' -> ')}`);
                    }
                }
            }

            // Check for missing dependencies
            for (const [token, definition] of this.services.entries()) {
                if (definition.isRegistered && definition.dependencies) {
                    for (const dependency of definition.dependencies) {
                        if (!this.isRegistered(dependency)) {
                            errors.push(`Service '${token}' depends on unregistered service '${dependency}'`);
                        }
                    }
                }
            }

            const isValid = errors.length === 0;

            logger.debug('Container validation completed', 'ServiceContainer.validate', {
                isValid,
                errorCount: errors.length,
                serviceCount: this.services.size
            });

            return { isValid, errors };

        } catch (error) {
            logger.error('Container validation failed', 'ServiceContainer.validate', error);
            return { isValid: false, errors: [`Validation error: ${error}`] };
        }
    }

    // Private helper methods

    /**
     * Internal service resolution with dependency injection
     */
    private resolveInternal<T>(token: string): T {
        // Check for circular dependencies
        if (this.resolutionStack.has(token)) {
            const stackArray = Array.from(this.resolutionStack);
            stackArray.push(token);
            throw new Error(`Circular dependency detected: ${stackArray.join(' -> ')}`);
        }

        const definition = this.services.get(token);
        if (!definition || !definition.isRegistered) {
            throw new Error(`Service '${token}' is not registered`);
        }

        // Handle different lifetimes
        switch (definition.lifetime) {
            case ServiceLifetime.SINGLETON:
                if (definition.instance) {
                    return definition.instance as T;
                }
                break;

            case ServiceLifetime.SCOPED:
                if (this.scopedInstances.has(token)) {
                    return this.scopedInstances.get(token) as T;
                }
                break;

            case ServiceLifetime.TRANSIENT:
                // Always create new instance
                break;
        }

        // Add to resolution stack
        this.resolutionStack.add(token);

        try {
            // Resolve dependencies first
            const dependencies: any[] = [];
            if (definition.dependencies) {
                for (const depToken of definition.dependencies) {
                    const dependency = this.resolveInternal(depToken);
                    dependencies.push(dependency);
                }
            }

            // Create instance
            const instance = definition.factory(this);

            // Store instance based on lifetime
            switch (definition.lifetime) {
                case ServiceLifetime.SINGLETON:
                    definition.instance = instance;
                    break;

                case ServiceLifetime.SCOPED:
                    this.scopedInstances.set(token, instance);
                    break;

                case ServiceLifetime.TRANSIENT:
                    // Don't store transient instances
                    break;
            }

            logger.debug(`Service resolved: ${token}`, 'ServiceContainer.resolveInternal', {
                token,
                lifetime: definition.lifetime,
                dependencyCount: definition.dependencies?.length || 0
            });

            return instance as T;

        } finally {
            // Remove from resolution stack
            this.resolutionStack.delete(token);
        }
    }

    /**
     * Detect circular dependencies
     */
    private detectCircularDependencies(
        token: string, 
        visited: Set<string>, 
        path: string[] = []
    ): string[] | null {
        if (visited.has(token)) {
            return [...path, token];
        }

        const definition = this.services.get(token);
        if (!definition || !definition.dependencies) {
            return null;
        }

        visited.add(token);
        const newPath = [...path, token];

        for (const dependency of definition.dependencies) {
            const circular = this.detectCircularDependencies(dependency, visited, newPath);
            if (circular) {
                return circular;
            }
        }

        visited.delete(token);
        return null;
    }

    /**
     * Update resolution performance metrics
     */
    private updateResolutionMetrics(token: string, elapsedTime: number): void {
        try {
            const current = this.resolutionMetrics.get(token) || { count: 0, totalTime: 0, averageTime: 0 };
            current.count++;
            current.totalTime += elapsedTime;
            current.averageTime = current.totalTime / current.count;

            this.resolutionMetrics.set(token, current);

        } catch (error) {
            logger.warn('Failed to update resolution metrics', 'ServiceContainer.updateResolutionMetrics', {
                token,
                error
            });
        }
    }
}

export default ServiceContainer;

