/**
 * Dependency Injection Module
 * 
 * This module provides a comprehensive dependency injection system for the application.
 * It includes:
 * - ServiceContainer: Main DI container
 * - ServiceTokens: Type-safe service identifiers
 * - ServiceConfiguration: Automated service setup
 * - Injectable decorators: Decorator-based DI
 * - Migration utilities: Legacy service integration
 */

// Core DI exports
export { default as ServiceContainer, ServiceLifetime } from './ServiceContainer';
export type { ServiceDefinition, ServiceMetadata } from './ServiceContainer';

// Service tokens and configuration
export { SERVICE_TOKENS, TOKEN_GROUPS, ALL_TOKENS } from './ServiceTokens';
export type { ServiceToken, CoreServiceToken, WalletServiceToken, BluetoothServiceToken, PortfolioServiceToken, SecurityServiceToken, AdvancedServiceToken, UtilityServiceToken } from './ServiceTokens';
export { isValidServiceToken, getTokenGroup, getTokensInGroup, getAllTokenMetadata } from './ServiceTokens';
export type { ServiceTokenMetadata } from './ServiceTokens';

// Service configuration
export { default as ServiceConfiguration } from './ServiceConfiguration';

// Injectable decorators and utilities
export { Injectable, Inject, LazyInject, PostConstruct, PreDestroy, Optional } from './Injectable';
export { ServiceFactory, ServiceReference, createServiceRef, createMigrationFactory } from './Injectable';
export type { InjectableMetadata } from './Injectable';

// DI Container Facade
import ServiceContainer, { ServiceLifetime } from './ServiceContainer';
import ServiceConfiguration from './ServiceConfiguration';
import { SERVICE_TOKENS } from './ServiceTokens';
import logger from '../../utils/Logger';

/**
 * DI - Main Dependency Injection facade
 * 
 * Provides a simplified API for working with the DI container
 */
export class DI {
    private static _container: ServiceContainer | null = null;
    private static _isInitialized = false;

    /**
     * Initialize the DI system
     */
    static async initialize(useMinimalConfig: boolean = false): Promise<void> {
        try {
            if (DI._isInitialized) {
                logger.warn('DI system already initialized', 'DI.initialize');
                return;
            }

            logger.info('Initializing Dependency Injection system', 'DI.initialize', { useMinimalConfig });

            // Create container
            DI._container = ServiceContainer.create();

            // Configure services
            if (useMinimalConfig) {
                ServiceConfiguration.configureMinimal(DI._container);
            } else {
                ServiceConfiguration.configure(DI._container);
            }

            // Validate configuration
            const validation = DI._container.validate();
            if (!validation.isValid) {
                throw new Error(`DI validation failed: ${validation.errors.join(', ')}`);
            }

            DI._isInitialized = true;

            logger.info('Dependency Injection system initialized successfully', 'DI.initialize', {
                serviceCount: DI._container.getRegisteredTokens().length,
                useMinimalConfig
            });

        } catch (error) {
            logger.error('Failed to initialize DI system', 'DI.initialize', error);
            throw new Error(`DI initialization failed: ${error}`);
        }
    }

    /**
     * Get the DI container
     */
    static container(): ServiceContainer {
        if (!DI._container) {
            throw new Error('DI system not initialized. Call DI.initialize() first.');
        }
        return DI._container;
    }

    /**
     * Resolve service by token
     */
    static resolve<T>(token: string): T {
        return DI.container().resolve<T>(token);
    }

    /**
     * Try to resolve service, return null if not found
     */
    static tryResolve<T>(token: string): T | null {
        return DI.container().tryResolve<T>(token);
    }

    /**
     * Check if service is registered
     */
    static isRegistered(token: string): boolean {
        return DI.container().isRegistered(token);
    }

    /**
     * Register a service
     */
    static register<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
        dependencies: string[] = []
    ): void {
        DI.container().register(token, factory, lifetime, dependencies);
    }

    /**
     * Register singleton service
     */
    static registerSingleton<T>(
        token: string,
        factory: (container: ServiceContainer) => T,
        dependencies: string[] = []
    ): void {
        DI.container().registerSingleton(token, factory, dependencies);
    }

    /**
     * Register instance
     */
    static registerInstance<T>(token: string, instance: T): void {
        DI.container().registerInstance(token, instance);
    }

    /**
     * Get service metadata
     */
    static getMetadata(token: string) {
        return DI.container().getServiceMetadata(token);
    }

    /**
     * Get all services metadata
     */
    static getAllMetadata() {
        return DI.container().getAllServicesMetadata();
    }

    /**
     * Get resolution metrics
     */
    static getMetrics() {
        return DI.container().getResolutionMetrics();
    }

    /**
     * Clear scoped instances
     */
    static clearScope(): void {
        DI.container().clearScope();
    }

    /**
     * Create child container
     */
    static createChild(): ServiceContainer {
        return DI.container().createChild();
    }

    /**
     * Dispose DI system
     */
    static dispose(): void {
        try {
            if (DI._container) {
                DI._container.dispose();
                DI._container = null;
            }
            DI._isInitialized = false;

            logger.info('DI system disposed', 'DI.dispose');

        } catch (error) {
            logger.error('Failed to dispose DI system', 'DI.dispose', error);
        }
    }

    /**
     * Reset DI system (for testing)
     */
    static reset(): void {
        DI.dispose();
        ServiceConfiguration.reset();
        logger.debug('DI system reset', 'DI.reset');
    }

    /**
     * Get initialization status
     */
    static get isInitialized(): boolean {
        return DI._isInitialized;
    }

    /**
     * Get registered service count
     */
    static get serviceCount(): number {
        return DI._container ? DI._container.getRegisteredTokens().length : 0;
    }
}

// Convenience exports for common services
export const Services = {
    // Core
    get errorHandler() { return DI.resolve(SERVICE_TOKENS.ERROR_HANDLER); },
    get enhancedErrorHandler() { return DI.resolve(SERVICE_TOKENS.ENHANCED_ERROR_HANDLER); },
    get network() { return DI.resolve(SERVICE_TOKENS.NETWORK_SERVICE); },
    get cardanoAPI() { return DI.resolve(SERVICE_TOKENS.CARDANO_API_SERVICE); },
    get config() { return DI.resolve(SERVICE_TOKENS.CONFIGURATION_SERVICE); },
    get eventBus() { return DI.resolve(SERVICE_TOKENS.EVENT_BUS); },
    get performance() { return DI.resolve(SERVICE_TOKENS.PERFORMANCE_MONITOR); },

    // Wallet
    get wallet() { return DI.resolve(SERVICE_TOKENS.WALLET_SERVICE); },
    get walletLegacy() { return DI.resolve(SERVICE_TOKENS.CARDANO_WALLET_SERVICE); },
    get walletKeys() { return DI.resolve(SERVICE_TOKENS.WALLET_KEY_MANAGER); },
    get transactions() { return DI.resolve(SERVICE_TOKENS.TRANSACTION_BUILDER); },
    get accounts() { return DI.resolve(SERVICE_TOKENS.ACCOUNT_MANAGER); },

    // Bluetooth
    get bluetooth() { return DI.resolve(SERVICE_TOKENS.BLUETOOTH_TRANSACTION_SERVICE); },
    get bluetoothLegacy() { return DI.resolve(SERVICE_TOKENS.BLUETOOTH_TRANSFER_SERVICE); },

    // Portfolio
    get portfolio() { return DI.resolve(SERVICE_TOKENS.PORTFOLIO_SERVICE); },
    get portfolioLegacy() { return DI.resolve(SERVICE_TOKENS.PORTFOLIO_ANALYTICS_SERVICE); },
    get prices() { return DI.resolve(SERVICE_TOKENS.ASSET_PRICE_SERVICE); },

    // Security
    get biometric() { return DI.resolve(SERVICE_TOKENS.BIOMETRIC_SERVICE); },
    get encryption() { return DI.resolve(SERVICE_TOKENS.MNEMONIC_ENCRYPTION_SERVICE); },
    get transform() { return DI.resolve(SERVICE_TOKENS.MNEMONIC_TRANSFORM_SERVICE); },

    // Advanced
    get nft() { return DI.resolve(SERVICE_TOKENS.NFT_MANAGEMENT_SERVICE); },
    get defi() { return DI.resolve(SERVICE_TOKENS.DEFI_STAKING_SERVICE); },
    get multiSig() { return DI.resolve(SERVICE_TOKENS.MULTI_SIGNATURE_SERVICE); },

    // Utilities
    get logger() { return DI.resolve(SERVICE_TOKENS.LOGGER); },
    get crypto() { return DI.resolve(SERVICE_TOKENS.CRYPTO_UTILS); },
    get memory() { return DI.resolve(SERVICE_TOKENS.MEMORY_UTILS); }
};

// Type-safe service accessors
export const TypedServices = {
    get<T>(token: string): T {
        return DI.resolve<T>(token);
    },

    tryGet<T>(token: string): T | null {
        return DI.tryResolve<T>(token);
    }
};

// Migration helpers
export const Migration = {
    /**
     * Gradually migrate from singleton to DI
     */
    migrateService<T>(
        token: string,
        legacyGetter: () => T,
        useDI: boolean = true
    ): T {
        if (useDI && DI.isInitialized && DI.isRegistered(token)) {
            try {
                return DI.resolve<T>(token);
            } catch (error) {
                logger.warn(`DI migration fallback for ${token}`, 'Migration.migrateService', error);
            }
        }
        return legacyGetter();
    },

    /**
     * Create migration wrapper
     */
    createWrapper<T>(
        token: string,
        legacyGetter: () => T
    ): () => T {
        return () => Migration.migrateService(token, legacyGetter);
    }
};

// Development helpers
export const DevTools = {
    /**
     * Get DI system diagnostics
     */
    getDiagnostics() {
        if (!DI.isInitialized) {
            return { status: 'not_initialized' };
        }

        const container = DI.container();
        const metadata = container.getAllServicesMetadata();
        const metrics = container.getResolutionMetrics();

        return {
            status: 'initialized',
            serviceCount: metadata.length,
            services: metadata,
            metrics: Object.fromEntries(metrics),
            tokenGroups: TOKEN_GROUPS
        };
    },

    /**
     * Validate DI configuration
     */
    validate() {
        return DI.container().validate();
    },

    /**
     * Test service resolution
     */
    testResolution(token: string) {
        try {
            const service = DI.resolve(token);
            return { success: true, service };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get service dependency graph
     */
    getDependencyGraph() {
        const metadata = DI.getAllMetadata();
        const graph: { [key: string]: string[] } = {};

        metadata.forEach(service => {
            graph[service.token] = service.dependencies;
        });

        return graph;
    }
};

export default DI;
