/**
 * Dynamic Import Utilities for Code Splitting and Bundle Optimization
 * 
 * Features:
 * - Lazy loading with error boundaries
 * - Preloading hints for better UX
 * - Retry mechanism for failed imports
 * - Loading states management
 */

import React from 'react';
import logger from './Logger';

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface LazyLoadOptions {
    // Retry failed imports
    maxRetries?: number;
    retryDelay?: number;
    
    // Preloading
    preload?: boolean;
    preloadDelay?: number;
    
    // Error handling
    fallbackComponent?: React.ComponentType;
    onError?: (error: Error) => void;
    
    // Loading states
    loadingComponent?: React.ComponentType;
    timeout?: number;
}

export interface DynamicImportState<T> {
    component: T | null;
    loading: boolean;
    error: Error | null;
    retryCount: number;
}

// =========================================================================
// LAZY LOADING UTILITIES
// =========================================================================

/**
 * Enhanced lazy loading with retry mechanism and error handling
 */
export class DynamicImportManager {
    private static cache = new Map<string, Promise<any>>();
    private static preloadQueue = new Set<string>();
    
    /**
     * Create a lazy-loaded component with enhanced features
     */
    static createLazyComponent<T = React.ComponentType<any>>(
        importFunction: () => Promise<{ default: T }>,
        options: LazyLoadOptions = {}
    ): React.ComponentType<any> {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            preload = false,
            preloadDelay = 2000,
            fallbackComponent: FallbackComponent,
            onError,
            loadingComponent: LoadingComponent,
            timeout = 10000,
        } = options;
        
        // Generate cache key based on import function
        const cacheKey = importFunction.toString();
        
        const LazyComponent = React.lazy(() => {
            // Use cached promise if available
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey)!;
            }
            
            // Create import promise with retry logic
            const importPromise = this.createRetryableImport(
                importFunction,
                maxRetries,
                retryDelay,
                onError
            );
            
            // Add timeout handling
            const timeoutPromise = this.addTimeout(importPromise, timeout);
            
            // Cache the promise
            this.cache.set(cacheKey, timeoutPromise);
            
            return timeoutPromise;
        });
        
        // Setup preloading
        if (preload) {
            setTimeout(() => {
                this.preloadComponent(cacheKey, importFunction, options);
            }, preloadDelay);
        }
        
        // Return wrapper component with error boundary
        return this.wrapWithErrorBoundary(
            LazyComponent,
            FallbackComponent,
            LoadingComponent,
            onError
        );
    }
    
    /**
     * Preload a component without rendering it
     */
    static preloadComponent(
        key: string,
        importFunction: () => Promise<{ default: any }>,
        options: LazyLoadOptions = {}
    ): void {
        if (this.preloadQueue.has(key)) return;
        
        this.preloadQueue.add(key);
        
        logger.debug('Preloading component', 'DynamicImportManager.preloadComponent', { key });
        
        this.createRetryableImport(
            importFunction,
            options.maxRetries || 3,
            options.retryDelay || 1000,
            options.onError
        ).catch((error) => {
            logger.warn('Failed to preload component', 'DynamicImportManager.preloadComponent', {
                key,
                error: error.message
            });
        });
    }
    
    /**
     * Clear import cache
     */
    static clearCache(): void {
        this.cache.clear();
        this.preloadQueue.clear();
        logger.debug('Dynamic import cache cleared', 'DynamicImportManager.clearCache');
    }
    
    /**
     * Get cache statistics
     */
    static getCacheStats(): { cached: number; preloaded: number } {
        return {
            cached: this.cache.size,
            preloaded: this.preloadQueue.size
        };
    }
    
    // Private helper methods
    
    private static async createRetryableImport<T>(
        importFunction: () => Promise<{ default: T }>,
        maxRetries: number,
        retryDelay: number,
        onError?: (error: Error) => void
    ): Promise<{ default: T }> {
        let lastError: Error = new Error('Import failed');
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await importFunction();
                
                if (attempt > 0) {
                    logger.info('Dynamic import succeeded after retry', 'DynamicImportManager.createRetryableImport', {
                        attempt,
                        maxRetries
                    });
                }
                
                return result;
            } catch (error) {
                lastError = error as Error;
                
                logger.warn('Dynamic import failed', 'DynamicImportManager.createRetryableImport', {
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1,
                    error: lastError.message
                });
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
                }
            }
        }
        
        // All retries failed
        const finalError = new Error(`Dynamic import failed after ${maxRetries + 1} attempts: ${lastError.message}`);
        
        if (onError) {
            onError(finalError);
        }
        
        throw finalError;
    }
    
    private static addTimeout<T>(
        promise: Promise<T>,
        timeout: number
    ): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Dynamic import timeout after ${timeout}ms`));
                }, timeout);
            })
        ]);
    }
    
    private static wrapWithErrorBoundary(
        LazyComponent: React.ComponentType<any>,
        FallbackComponent?: React.ComponentType,
        LoadingComponent?: React.ComponentType,
        onError?: (error: Error) => void
    ): React.ComponentType<any> {
        return (props: any) => {
            const [error, setError] = React.useState<Error | null>(null);
            
            React.useEffect(() => {
                const handleError = (event: any) => {
                    const importError = event.reason || event.error;
                    if (importError && importError.message?.includes('Loading chunk')) {
                        setError(importError);
                        if (onError) onError(importError);
                    }
                };
                
                window.addEventListener('unhandledrejection', handleError);
                return () => window.removeEventListener('unhandledrejection', handleError);
            }, []);
            
            if (error) {
                if (FallbackComponent) {
                    return React.createElement(FallbackComponent, { error, ...props });
                }
                
                return React.createElement('div', {
                    style: { padding: 20, textAlign: 'center' }
                }, 'Failed to load component. Please refresh.');
            }
            
            return React.createElement(
                React.Suspense,
                {
                    fallback: LoadingComponent 
                        ? React.createElement(LoadingComponent)
                        : React.createElement('div', { style: { padding: 20 } }, 'Loading...')
                },
                React.createElement(LazyComponent, props)
            );
        };
    }
}

// =========================================================================
// CONVENIENT FACTORY FUNCTIONS
// =========================================================================

/**
 * Create a lazy screen component optimized for navigation
 */
export const createLazyScreen = <T = React.ComponentType<any>>(
    importFunction: () => Promise<{ default: T }>,
    screenName: string,
    options: LazyLoadOptions & { preload?: boolean } = {}
): React.ComponentType<any> => {
    const { preload = true, preloadDelay = 1000, ...restOptions } = options;
    
    return DynamicImportManager.createLazyComponent(importFunction, {
        ...restOptions,
        preload, // Use provided preload option or default to true
        preloadDelay, // Use provided delay or default to 1 second
        onError: (error) => {
            logger.error('Failed to load screen', `LazyScreen.${screenName}`, error);
            restOptions.onError?.(error);
        }
    });
};

/**
 * Create a lazy service with background loading
 */
export const createLazyService = <T = any>(
    importFunction: () => Promise<{ default: T }>,
    serviceName: string
): Promise<T> => {
    const cacheKey = `service_${serviceName}`;
    
    if (DynamicImportManager['cache'].has(cacheKey)) {
        return DynamicImportManager['cache'].get(cacheKey)!.then((module: any) => module.default);
    }
    
    const servicePromise = DynamicImportManager['createRetryableImport'](
        importFunction,
        3, // maxRetries
        2000, // retryDelay
        (error) => logger.error('Failed to load service', `LazyService.${serviceName}`, error)
    );
    
    DynamicImportManager['cache'].set(cacheKey, servicePromise);
    
    return servicePromise.then(module => module.default);
};

/**
 * Preload critical components for better UX
 */
export const preloadCriticalComponents = (): void => {
    // Preload main screens
    const criticalScreens = [
        () => import('../screens/WalletHomeScreen'),
        () => import('../screens/SendTransactionScreen'),
        () => import('../screens/ReceiveScreen'),
        () => import('../screens/TransactionHistoryScreen'),
    ];
    
    criticalScreens.forEach((importFn, index) => {
        setTimeout(() => {
            DynamicImportManager.preloadComponent(
                `critical_screen_${index}`,
                importFn,
                { maxRetries: 2 }
            );
        }, index * 500); // Stagger preloading
    });
    
    logger.info('Started preloading critical components', 'preloadCriticalComponents');
};

export default DynamicImportManager;
