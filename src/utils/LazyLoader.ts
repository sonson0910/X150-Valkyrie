/**
 * LazyLoader - Dynamic loading utility for heavy libraries and services
 * 
 * Provides lazy loading capabilities to improve app startup performance
 * by deferring the loading of heavy dependencies until they're actually needed.
 */

import logger from './Logger';

// =========================================================================
// LAZY LOADING CACHE
// =========================================================================

interface LazyModule<T> {
    instance?: T;
    loading?: Promise<T>;
    error?: Error;
}

// Cache for loaded modules to prevent duplicate loading
const moduleCache = new Map<string, LazyModule<any>>();

// =========================================================================
// CSL (CARDANO SERIALIZATION LIBRARY) LAZY LOADING
// =========================================================================

let cslInstance: any = null;
let cslLoading: Promise<any> | null = null;

/**
 * Lazy load Cardano Serialization Library
 * @returns CSL instance
 */
export const loadCSL = async (): Promise<any> => {
    if (cslInstance) {
        return cslInstance;
    }

    if (cslLoading) {
        return cslLoading;
    }

    cslLoading = loadCSLInternal();
    cslInstance = await cslLoading;
    cslLoading = null;

    return cslInstance;
};

/**
 * Internal CSL loader with performance monitoring
 */
const loadCSLInternal = async (): Promise<any> => {
    const startTime = performance.now();
    
    try {
        logger.debug('Starting CSL library load', 'LazyLoader.loadCSL');

        // Dynamic import of CSL
        const CSL = require('@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib');
        
        const loadTime = performance.now() - startTime;
        logger.info('CSL library loaded successfully', 'LazyLoader.loadCSL', {
            loadTimeMs: Math.round(loadTime),
            memoryUsage: getMemoryUsage()
        });

        return CSL;

    } catch (error) {
        const loadTime = performance.now() - startTime;
        logger.error('Failed to load CSL library', 'LazyLoader.loadCSL', {
            error,
            loadTimeMs: Math.round(loadTime)
        });
        throw error;
    }
};

/**
 * Check if CSL is already loaded
 */
export const isCSLLoaded = (): boolean => {
    return cslInstance !== null;
};

/**
 * Get CSL instance if already loaded (non-async)
 */
export const getCSLSync = (): any | null => {
    return cslInstance;
};

// =========================================================================
// GENERIC SERVICE LAZY LOADING
// =========================================================================

/**
 * Generic lazy loader for services and modules
 * @param key - Unique key for the module
 * @param loader - Function that returns the module
 * @returns Loaded module instance
 */
export const lazyLoad = async <T>(
    key: string,
    loader: () => Promise<T> | T
): Promise<T> => {
    let moduleData = moduleCache.get(key);

    if (!moduleData) {
        moduleData = {};
        moduleCache.set(key, moduleData);
    }

    // Return cached instance if available
    if (moduleData.instance) {
        return moduleData.instance;
    }

    // Return existing loading promise if in progress
    if (moduleData.loading) {
        return moduleData.loading;
    }

    // Start loading
    const startTime = performance.now();
    
    try {
        logger.debug('Starting lazy load', 'LazyLoader.lazyLoad', { key });

        moduleData.loading = Promise.resolve(loader());
        const instance = await moduleData.loading;
        
        const loadTime = performance.now() - startTime;
        logger.debug('Lazy load completed', 'LazyLoader.lazyLoad', {
            key,
            loadTimeMs: Math.round(loadTime)
        });

        moduleData.instance = instance;
        moduleData.loading = undefined;
        moduleData.error = undefined;

        return instance;

    } catch (error) {
        const loadTime = performance.now() - startTime;
        logger.error('Lazy load failed', 'LazyLoader.lazyLoad', {
            key,
            error,
            loadTimeMs: Math.round(loadTime)
        });

        moduleData.loading = undefined;
        moduleData.error = error as Error;
        
        throw error;
    }
};

// =========================================================================
// SPECIFIC SERVICE LOADERS
// =========================================================================

/**
 * Lazy load CardanoAPIService
 */
export const loadCardanoAPIService = async () => {
    return lazyLoad('CardanoAPIService', async () => {
        const { CardanoAPIService } = await import('../services/CardanoAPIService');
        return CardanoAPIService.getInstance();
    });
};

/**
 * Lazy load MnemonicEncryptionService
 */
export const loadMnemonicEncryptionService = async () => {
    return lazyLoad('MnemonicEncryptionService', async () => {
        const { MnemonicEncryptionService } = await import('../services/MnemonicEncryptionService');
        return MnemonicEncryptionService.getInstance();
    });
};

/**
 * Lazy load PortfolioAnalyticsService
 */
export const loadPortfolioAnalyticsService = async () => {
    return lazyLoad('PortfolioAnalyticsService', async () => {
        const { PortfolioAnalyticsService } = await import('../services/PortfolioAnalyticsService');
        return PortfolioAnalyticsService.getInstance();
    });
};

/**
 * Lazy load BluetoothTransactionService
 */
export const loadBluetoothTransactionService = async () => {
    return lazyLoad('BluetoothTransactionService', async () => {
        const BluetoothTransactionService = await import('../services/bluetooth/BluetoothTransactionService');
        return BluetoothTransactionService.default.getInstance();
    });
};

/**
 * Lazy load DeFiStakingService
 */
export const loadDeFiStakingService = async () => {
    return lazyLoad('DeFiStakingService', async () => {
        const { DeFiStakingService } = await import('../services/DeFiStakingService');
        return DeFiStakingService.getInstance();
    });
};

/**
 * Lazy load NFTManagementService
 */
export const loadNFTManagementService = async () => {
    return lazyLoad('NFTManagementService', async () => {
        const { NFTManagementService } = await import('../services/NFTManagementService');
        return NFTManagementService.getInstance();
    });
};

// =========================================================================
// PRELOADING UTILITIES
// =========================================================================

/**
 * Preload critical services in background
 * Call this after app initialization to warm up the cache
 */
export const preloadCriticalServices = async (): Promise<void> => {
    try {
        logger.info('Starting critical services preload', 'LazyLoader.preloadCriticalServices');

        // Preload in priority order
        const preloadPromises = [
            // High priority - crypto services
            loadCSL(),
            loadCardanoAPIService(),
            
            // Medium priority - wallet services  
            loadMnemonicEncryptionService(),
            
            // Lower priority - feature services
            loadPortfolioAnalyticsService(),
            loadDeFiStakingService(),
            loadNFTManagementService(),
        ];

        // Wait for critical services first
        await Promise.allSettled(preloadPromises.slice(0, 2));
        
        // Load others in background
        Promise.allSettled(preloadPromises.slice(2)).catch(() => {
            // Ignore errors for background preloading
        });

        logger.info('Critical services preload completed', 'LazyLoader.preloadCriticalServices');

    } catch (error) {
        logger.warn('Critical services preload failed', 'LazyLoader.preloadCriticalServices', error);
    }
};

/**
 * Preload services based on user navigation
 */
export const preloadForScreen = async (screenName: string): Promise<void> => {
    const screenServices: Record<string, (() => Promise<any>)[]> = {
        'WalletHome': [loadCardanoAPIService, loadCSL],
        'SendTransaction': [loadCSL, loadCardanoAPIService],
        'ReceiveScreen': [loadCSL],
        'TransactionHistory': [loadCardanoAPIService],
        'Portfolio': [loadPortfolioAnalyticsService, loadCardanoAPIService],
        'DeFiStaking': [loadDeFiStakingService, loadCSL],
        'NFTGallery': [loadNFTManagementService, loadCardanoAPIService],
        'OfflineTransaction': [loadBluetoothTransactionService, loadCSL],
        'BackupWallet': [loadMnemonicEncryptionService],
        'RestoreWallet': [loadMnemonicEncryptionService, loadCSL],
    };

    const services = screenServices[screenName];
    if (services) {
        logger.debug('Preloading services for screen', 'LazyLoader.preloadForScreen', { screenName });
        
        // Preload services for this screen
        Promise.allSettled(services.map(loader => loader())).catch(() => {
            // Ignore errors for preloading
        });
    }
};

// =========================================================================
// CACHE MANAGEMENT
// =========================================================================

/**
 * Clear the lazy loading cache
 */
export const clearCache = (): void => {
    moduleCache.clear();
    cslInstance = null;
    cslLoading = null;
    
    logger.debug('Lazy loading cache cleared', 'LazyLoader.clearCache');
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
    const modules = Array.from(moduleCache.keys());
    const loadedCount = Array.from(moduleCache.values()).filter(m => m.instance).length;
    const errorCount = Array.from(moduleCache.values()).filter(m => m.error).length;
    
    return {
        totalModules: modules.length,
        loadedModules: loadedCount,
        failedModules: errorCount,
        cslLoaded: isCSLLoaded(),
        modules,
        memoryUsage: getMemoryUsage()
    };
};

// =========================================================================
// UTILITIES
// =========================================================================

/**
 * Get current memory usage (if available)
 */
const getMemoryUsage = () => {
    try {
        if (typeof (performance as any).memory !== 'undefined') {
            const memory = (performance as any).memory;
            return {
                usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
                totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
            };
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Performance monitoring wrapper
 */
export const withPerformanceMonitoring = async <T>(
    operation: string,
    fn: () => Promise<T>
): Promise<T> => {
    const startTime = performance.now();
    const startMemory = getMemoryUsage();
    
    try {
        const result = await fn();
        
        const endTime = performance.now();
        const endMemory = getMemoryUsage();
        
        logger.info('Operation completed', `LazyLoader.${operation}`, {
            durationMs: Math.round(endTime - startTime),
            startMemory,
            endMemory
        });
        
        return result;
        
    } catch (error) {
        const endTime = performance.now();
        
        logger.error('Operation failed', `LazyLoader.${operation}`, {
            durationMs: Math.round(endTime - startTime),
            error
        });
        
        throw error;
    }
};

