/**
 * Cache Services Index
 * 
 * Central export point for all caching services and utilities
 */

// Core intelligent cache
export { 
    intelligentCache,
    IntelligentCacheManager,
    CacheStrategy,
    CachePriority,
    type CacheEntry,
    type CacheOptions,
    type CacheStats
} from '../../utils/IntelligentCache';

// Specialized cache services
export {
    ApiResponseCacheService,
    type ApiCacheConfig,
    type ApiRequestOptions,
    type CachedApiResponse
} from './ApiResponseCache';

export {
    walletDataCache,
    WalletDataCacheService,
    type WalletCacheEntry,
    type TransactionCacheData,
    type BalanceCacheData,
    type UtxoCacheData,
    type StakingCacheData
} from './WalletDataCache';

export {
    portfolioDataCache,
    PortfolioDataCacheService,
    type AssetPriceData,
    type PortfolioAnalyticsData,
    type HistoricalPriceData,
    type MarketDataCache,
    type PerformanceMetrics
} from './PortfolioDataCache';

// =========================================================================
// UNIFIED CACHE MANAGER
// =========================================================================

/**
 * Unified Cache Manager - Single point of control for all caching operations
 */
export class UnifiedCacheManager {
    private static instance: UnifiedCacheManager;
    
    // Service instances
    private apiCache: ApiResponseCacheService;
    private walletCache: WalletDataCacheService;
    private portfolioCache: PortfolioDataCacheService;
    
    private constructor() {
        this.apiCache = ApiResponseCacheService.getInstance();
        this.walletCache = WalletDataCacheService.getInstance();
        this.portfolioCache = PortfolioDataCacheService.getInstance();
    }
    
    public static getInstance(): UnifiedCacheManager {
        if (!UnifiedCacheManager.instance) {
            UnifiedCacheManager.instance = new UnifiedCacheManager();
        }
        return UnifiedCacheManager.instance;
    }
    
    /**
     * Get API cache service
     */
    get api(): ApiResponseCacheService {
        return this.apiCache;
    }
    
    /**
     * Get wallet cache service
     */
    get wallet(): WalletDataCacheService {
        return this.walletCache;
    }
    
    /**
     * Get portfolio cache service
     */
    get portfolio(): PortfolioDataCacheService {
        return this.portfolioCache;
    }
    
    /**
     * Get core cache engine
     */
    get core(): IntelligentCacheManager {
        return intelligentCache;
    }
    
    /**
     * Get comprehensive cache statistics
     */
    getGlobalStats() {
        return {
            core: intelligentCache.getStats(),
            api: this.apiCache.getStats(),
            wallet: this.walletCache.getStats(),
            portfolio: this.portfolioCache.getStats(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Clear all caches
     */
    async clearAllCaches(): Promise<void> {
        await Promise.all([
            intelligentCache.clearAll(),
            this.apiCache.clearCache(),
            this.walletCache.clearCache(),
            this.portfolioCache.clearCache()
        ]);
    }
    
    /**
     * Shutdown all cache services
     */
    async shutdown(): Promise<void> {
        await Promise.all([
            intelligentCache.shutdown(),
            this.walletCache.shutdown(),
            this.portfolioCache.shutdown()
        ]);
    }
    
    /**
     * Initialize cache warmup for critical data
     */
    async warmupCaches(): Promise<void> {
        // Critical API endpoints
        await this.apiCache.preload([
            { endpoint: '/epochs/latest', options: { cache: { priority: CachePriority.HIGH } } },
            { endpoint: '/network', options: { cache: { priority: CachePriority.HIGH } } }
        ]);
        
        // This would be called after wallet initialization with actual addresses
        // await this.walletCache.warmup(...);
    }
}

// =========================================================================
// CACHE DECORATORS
// =========================================================================

/**
 * Method decorator for automatic caching
 */
export function Cached(options: CacheOptions & { keyGenerator?: (...args: any[]) => string } = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            // Generate cache key
            const cacheKey = options.keyGenerator 
                ? options.keyGenerator(...args)
                : `${target.constructor.name}_${propertyKey}_${JSON.stringify(args)}`;
            
            try {
                // Use intelligent cache
                const result = await intelligentCache.get(
                    cacheKey,
                    () => originalMethod.apply(this, args),
                    options
                );
                
                return result;
                
            } catch (error) {
                // Fallback to original method
                return await originalMethod.apply(this, args);
            }
        };
        
        return descriptor;
    };
}

/**
 * Class decorator for automatic cache invalidation on property changes
 */
export function CacheInvalidateOnChange(properties: string[]) {
    return function <T extends { new(...args: any[]): {} }>(constructor: T) {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                
                // Setup property watchers
                properties.forEach(prop => {
                    let value = (this as any)[prop];
                    
                    Object.defineProperty(this, prop, {
                        get: () => value,
                        set: (newValue) => {
                            if (value !== newValue) {
                                value = newValue;
                                // Invalidate caches related to this instance
                                const pattern = new RegExp(`${constructor.name}_.*`);
                                intelligentCache.invalidate(pattern);
                            }
                        },
                        enumerable: true,
                        configurable: true
                    });
                });
            }
        };
    };
}

// =========================================================================
// CACHE UTILITIES
// =========================================================================

/**
 * Cache key generation utilities
 */
export const CacheKeyUtils = {
    /**
     * Generate cache key for API requests
     */
    apiKey(endpoint: string, method: string = 'GET', params?: any): string {
        const paramStr = params ? `_${JSON.stringify(params)}` : '';
        return `api_${method}_${endpoint}${paramStr}`;
    },
    
    /**
     * Generate cache key for wallet data
     */
    walletKey(address: string, dataType: string, params?: any): string {
        const paramStr = params ? `_${JSON.stringify(params)}` : '';
        return `wallet_${dataType}_${address}${paramStr}`;
    },
    
    /**
     * Generate cache key for portfolio data
     */
    portfolioKey(address: string, dataType: string, params?: any): string {
        const paramStr = params ? `_${JSON.stringify(params)}` : '';
        return `portfolio_${dataType}_${address}${paramStr}`;
    },
    
    /**
     * Generate cache key from object hash
     */
    objectKey(prefix: string, obj: any): string {
        const hash = this.hashObject(obj);
        return `${prefix}_${hash}`;
    },
    
    /**
     * Simple object hash function
     */
    hashObject(obj: any): string {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
};

/**
 * Cache performance monitoring utilities
 */
export const CacheMonitor = {
    /**
     * Monitor cache hit/miss rates
     */
    startMonitoring(): () => void {
        const interval = setInterval(() => {
            const stats = UnifiedCacheManager.getInstance().getGlobalStats();
            
            // Log performance metrics
            console.log('Cache Performance:', {
                memoryHitRate: (stats.core.memoryCache.hitRate / (stats.core.memoryCache.hitRate + stats.core.memoryCache.missRate) * 100).toFixed(2) + '%',
                storageHitRate: (stats.core.storageCache.hitRate / (stats.core.storageCache.hitRate + stats.core.storageCache.missRate) * 100).toFixed(2) + '%',
                memorySize: `${(stats.core.memoryCache.size / 1024 / 1024).toFixed(2)}MB`,
                storageSize: `${(stats.core.storageCache.size / 1024 / 1024).toFixed(2)}MB`
            });
        }, 60000); // Every minute
        
        return () => clearInterval(interval);
    },
    
    /**
     * Get detailed performance report
     */
    getPerformanceReport() {
        const stats = UnifiedCacheManager.getInstance().getGlobalStats();
        
        return {
            summary: {
                totalCacheSize: stats.core.memoryCache.size + stats.core.storageCache.size,
                totalEntries: stats.core.memoryCache.count + stats.core.storageCache.count,
                overallHitRate: ((stats.core.memoryCache.hitRate + stats.core.storageCache.hitRate) / 
                    (stats.core.memoryCache.hitRate + stats.core.memoryCache.missRate + 
                     stats.core.storageCache.hitRate + stats.core.storageCache.missRate) * 100)
            },
            breakdown: stats,
            recommendations: this.generateRecommendations(stats)
        };
    },
    
    /**
     * Generate cache optimization recommendations
     */
    generateRecommendations(stats: any): string[] {
        const recommendations: string[] = [];
        
        const memoryHitRate = stats.core.memoryCache.hitRate / 
            (stats.core.memoryCache.hitRate + stats.core.memoryCache.missRate);
        
        if (memoryHitRate < 0.7) {
            recommendations.push('Consider increasing memory cache TTL for frequently accessed data');
        }
        
        if (stats.core.memoryCache.size > 40 * 1024 * 1024) { // > 40MB
            recommendations.push('Memory cache size is high - consider implementing more aggressive eviction');
        }
        
        if (stats.core.evictions.memory > 100) {
            recommendations.push('High memory eviction rate - consider increasing cache size or adjusting priorities');
        }
        
        return recommendations;
    }
};

// =========================================================================
// EXPORTS
// =========================================================================

export const cacheManager = UnifiedCacheManager.getInstance();
export default cacheManager;

