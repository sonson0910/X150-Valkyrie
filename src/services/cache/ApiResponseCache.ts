/**
 * Intelligent API Response Cache Service
 * 
 * Features:
 * - Smart caching for Cardano API responses
 * - Dynamic TTL based on data type
 * - Request deduplication 
 * - Background refresh for stale data
 * - Network error handling and retries
 * - Rate limiting and throttling
 */

import { intelligentCache, CacheStrategy, CachePriority, CacheOptions } from '../../utils/IntelligentCache';
import logger from '../../utils/Logger';
import { NetworkService } from '../NetworkService';

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ApiCacheConfig {
    baseUrl: string;
    defaultTtl: number;
    maxRetries: number;
    retryDelay: number;
    requestTimeout: number;
    enableCompression: boolean;
    enableDeduplication: boolean;
}

export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
    cache?: CacheOptions;
    bypassCache?: boolean;
}

export interface CachedApiResponse<T = any> {
    data: T;
    status: number;
    headers: Record<string, string>;
    timestamp: number;
    fromCache: boolean;
    requestDuration?: number;
}

// =========================================================================
// API CACHE CONFIGURATIONS
// =========================================================================

const API_CACHE_CONFIGS = {
    // Blockchain data (changes infrequently)
    BLOCK_INFO: {
        ttl: 10 * 60 * 1000, // 10 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['blockchain', 'block']
    },
    
    // Account data (changes moderately)
    ACCOUNT_INFO: {
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['account', 'balance']
    },
    
    // Transaction data (immutable once confirmed)
    TRANSACTION_INFO: {
        ttl: 30 * 60 * 1000, // 30 minutes
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['transaction']
    },
    
    // UTXO data (changes frequently)
    UTXO_SET: {
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['utxo', 'account']
    },
    
    // Pool data (changes infrequently)
    POOL_INFO: {
        ttl: 60 * 60 * 1000, // 1 hour
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['pool', 'staking']
    },
    
    // Asset metadata (rarely changes)
    ASSET_METADATA: {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        priority: CachePriority.LOW,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['asset', 'metadata']
    },
    
    // Price data (changes frequently)
    ASSET_PRICES: {
        ttl: 60 * 1000, // 1 minute
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['price', 'market']
    }
} as const;

// =========================================================================
// API RESPONSE CACHE SERVICE
// =========================================================================

export class ApiResponseCacheService {
    private static instance: ApiResponseCacheService;
    
    private config: ApiCacheConfig = {
        baseUrl: '',
        defaultTtl: 5 * 60 * 1000, // 5 minutes
        maxRetries: 3,
        retryDelay: 1000,
        requestTimeout: 10000,
        enableCompression: true,
        enableDeduplication: true
    };
    
    // Request deduplication
    private pendingRequests = new Map<string, Promise<CachedApiResponse>>();
    
    // Rate limiting
    private requestHistory = new Map<string, number[]>();
    private maxRequestsPerMinute = 60;
    
    private constructor(config?: Partial<ApiCacheConfig>) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
    }
    
    public static getInstance(config?: Partial<ApiCacheConfig>): ApiResponseCacheService {
        if (!ApiResponseCacheService.instance) {
            ApiResponseCacheService.instance = new ApiResponseCacheService(config);
        }
        return ApiResponseCacheService.instance;
    }
    
    // =========================================================================
    // MAIN API METHODS
    // =========================================================================
    
    /**
     * Make cached API request
     */
    async request<T = any>(
        endpoint: string,
        options: ApiRequestOptions = {}
    ): Promise<CachedApiResponse<T>> {
        const {
            method = 'GET',
            headers = {},
            body,
            timeout = this.config.requestTimeout,
            retries = this.config.maxRetries,
            cache,
            bypassCache = false
        } = options;
        
        const cacheKey = this.generateCacheKey(endpoint, method, body);
        
        try {
            // Check rate limiting
            if (!this.checkRateLimit(endpoint)) {
                throw new Error('Rate limit exceeded for endpoint');
            }
            
            // Bypass cache if requested
            if (bypassCache) {
                return await this.makeNetworkRequest<T>(endpoint, options);
            }
            
            // Get cache configuration for this endpoint
            const cacheConfig = this.getCacheConfig(endpoint, cache);
            
            // Request deduplication
            if (this.config.enableDeduplication && this.pendingRequests.has(cacheKey)) {
                logger.debug('Request deduplication hit', 'ApiResponseCacheService.request', { endpoint });
                return await this.pendingRequests.get(cacheKey)!;
            }
            
            // Use intelligent cache with fetch function
            const fetchFunction = async (): Promise<CachedApiResponse<T>> => {
                return await this.makeNetworkRequest<T>(endpoint, options);
            };
            
            // Create request promise for deduplication
            const requestPromise = intelligentCache.get<CachedApiResponse<T>>(
                cacheKey,
                fetchFunction,
                cacheConfig
            ).then(result => {
                // Clean up pending request
                this.pendingRequests.delete(cacheKey);
                
                if (result) {
                    return { ...result, fromCache: true };
                } else {
                    // Fallback to network request
                    return this.makeNetworkRequest<T>(endpoint, options);
                }
            });
            
            // Store pending request for deduplication
            if (this.config.enableDeduplication) {
                this.pendingRequests.set(cacheKey, requestPromise);
            }
            
            return await requestPromise;
            
        } catch (error) {
            // Clean up pending request on error
            this.pendingRequests.delete(cacheKey);
            
            logger.error('API request failed', 'ApiResponseCacheService.request', {
                endpoint,
                method,
                error: error.message
            });
            
            // Try to return cached data on error
            const cachedResponse = await intelligentCache.get<CachedApiResponse<T>>(cacheKey);
            if (cachedResponse) {
                logger.info('Returning stale cached data due to network error', 'ApiResponseCacheService.request', {
                    endpoint
                });
                return { ...cachedResponse, fromCache: true };
            }
            
            throw error;
        }
    }
    
    /**
     * Get cached response without network fallback
     */
    async getCached<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<CachedApiResponse<T> | null> {
        const cacheKey = this.generateCacheKey(endpoint, options.method || 'GET', options.body);
        const cached = await intelligentCache.get<CachedApiResponse<T>>(cacheKey);
        return cached ? { ...cached, fromCache: true } : null;
    }
    
    /**
     * Invalidate cached responses
     */
    async invalidate(endpointPattern: string | RegExp, tags?: string[]): Promise<void> {
        try {
            if (typeof endpointPattern === 'string') {
                // Convert endpoint to cache key pattern
                const pattern = new RegExp(this.escapeRegex(endpointPattern));
                await intelligentCache.invalidate(pattern, tags);
            } else {
                await intelligentCache.invalidate(endpointPattern, tags);
            }
            
            logger.debug('API cache invalidated', 'ApiResponseCacheService.invalidate', {
                pattern: endpointPattern.toString(),
                tags
            });
            
        } catch (error) {
            logger.error('API cache invalidation failed', 'ApiResponseCacheService.invalidate', error);
        }
    }
    
    /**
     * Preload critical API endpoints
     */
    async preload(endpoints: Array<{ endpoint: string; options?: ApiRequestOptions }>): Promise<void> {
        logger.info('Preloading API endpoints', 'ApiResponseCacheService.preload', {
            count: endpoints.length
        });
        
        const promises = endpoints.map(async ({ endpoint, options = {} }) => {
            try {
                await this.request(endpoint, {
                    ...options,
                    cache: {
                        priority: CachePriority.HIGH,
                        ...options.cache
                    }
                });
            } catch (error) {
                logger.warn('API preload failed', 'ApiResponseCacheService.preload', {
                    endpoint,
                    error: error.message
                });
            }
        });
        
        await Promise.allSettled(promises);
        
        logger.info('API preload completed', 'ApiResponseCacheService.preload');
    }
    
    // =========================================================================
    // SPECIALIZED API METHODS
    // =========================================================================
    
    /**
     * Get account information with smart caching
     */
    async getAccountInfo(address: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/accounts/${address}`, {
            cache: API_CACHE_CONFIGS.ACCOUNT_INFO
        });
    }
    
    /**
     * Get transaction information with long-term caching
     */
    async getTransactionInfo(txHash: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/txs/${txHash}`, {
            cache: API_CACHE_CONFIGS.TRANSACTION_INFO
        });
    }
    
    /**
     * Get UTXOs with frequent refresh
     */
    async getAccountUtxos(address: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/accounts/${address}/utxos`, {
            cache: API_CACHE_CONFIGS.UTXO_SET
        });
    }
    
    /**
     * Get block information with medium-term caching
     */
    async getBlockInfo(blockHash: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/blocks/${blockHash}`, {
            cache: API_CACHE_CONFIGS.BLOCK_INFO
        });
    }
    
    /**
     * Get pool information with long-term caching
     */
    async getPoolInfo(poolId: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/pools/${poolId}`, {
            cache: API_CACHE_CONFIGS.POOL_INFO
        });
    }
    
    /**
     * Get asset metadata with very long-term caching
     */
    async getAssetMetadata(assetId: string): Promise<CachedApiResponse<any>> {
        return await this.request(`/assets/${assetId}`, {
            cache: API_CACHE_CONFIGS.ASSET_METADATA
        });
    }
    
    /**
     * Get current asset prices with short-term caching
     */
    async getAssetPrices(assets: string[]): Promise<CachedApiResponse<any>> {
        const assetList = assets.join(',');
        return await this.request(`/market/prices?assets=${assetList}`, {
            cache: API_CACHE_CONFIGS.ASSET_PRICES
        });
    }
    
    // =========================================================================
    // PRIVATE HELPER METHODS
    // =========================================================================
    
    private async makeNetworkRequest<T>(
        endpoint: string,
        options: ApiRequestOptions
    ): Promise<CachedApiResponse<T>> {
        const startTime = Date.now();
        
        try {
            // Use NetworkService for actual HTTP request
            const networkService = NetworkService.getInstance();
            
            const response = await networkService.makeRequest(endpoint, {
                method: options.method || 'GET',
                headers: options.headers,
                body: options.body,
                timeout: options.timeout || this.config.requestTimeout
            });
            
            const requestDuration = Date.now() - startTime;
            
            logger.debug('API network request completed', 'ApiResponseCacheService.makeNetworkRequest', {
                endpoint,
                status: response.status,
                duration: `${requestDuration}ms`
            });
            
            return {
                data: response.data,
                status: response.status,
                headers: response.headers || {},
                timestamp: Date.now(),
                fromCache: false,
                requestDuration
            };
            
        } catch (error) {
            const requestDuration = Date.now() - startTime;
            
            logger.error('API network request failed', 'ApiResponseCacheService.makeNetworkRequest', {
                endpoint,
                duration: `${requestDuration}ms`,
                error: error.message
            });
            
            throw error;
        }
    }
    
    private generateCacheKey(endpoint: string, method: string, body?: any): string {
        const baseKey = `api_${method}_${endpoint}`;
        
        if (body) {
            const bodyHash = this.hashObject(body);
            return `${baseKey}_${bodyHash}`;
        }
        
        return baseKey;
    }
    
    private hashObject(obj: any): string {
        // Simple hash function for cache keys
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    
    private getCacheConfig(endpoint: string, customCache?: CacheOptions): CacheOptions {
        // Determine cache configuration based on endpoint pattern
        let config = { ...API_CACHE_CONFIGS.ACCOUNT_INFO }; // Default
        
        if (endpoint.includes('/blocks/')) {
            config = { ...API_CACHE_CONFIGS.BLOCK_INFO };
        } else if (endpoint.includes('/txs/')) {
            config = { ...API_CACHE_CONFIGS.TRANSACTION_INFO };
        } else if (endpoint.includes('/utxos')) {
            config = { ...API_CACHE_CONFIGS.UTXO_SET };
        } else if (endpoint.includes('/pools/')) {
            config = { ...API_CACHE_CONFIGS.POOL_INFO };
        } else if (endpoint.includes('/assets/')) {
            config = { ...API_CACHE_CONFIGS.ASSET_METADATA };
        } else if (endpoint.includes('/market/prices')) {
            config = { ...API_CACHE_CONFIGS.ASSET_PRICES };
        }
        
        // Merge with custom cache options
        return { ...config, ...customCache };
    }
    
    private checkRateLimit(endpoint: string): boolean {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute window
        
        if (!this.requestHistory.has(endpoint)) {
            this.requestHistory.set(endpoint, []);
        }
        
        const requests = this.requestHistory.get(endpoint)!;
        
        // Remove old requests outside the window
        const recentRequests = requests.filter(time => now - time < windowMs);
        
        if (recentRequests.length >= this.maxRequestsPerMinute) {
            logger.warn('Rate limit exceeded', 'ApiResponseCacheService.checkRateLimit', {
                endpoint,
                requests: recentRequests.length,
                limit: this.maxRequestsPerMinute
            });
            return false;
        }
        
        // Add current request
        recentRequests.push(now);
        this.requestHistory.set(endpoint, recentRequests);
        
        return true;
    }
    
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================
    
    /**
     * Get cache statistics
     */
    getStats() {
        const cacheStats = intelligentCache.getStats();
        return {
            ...cacheStats,
            pendingRequests: this.pendingRequests.size,
            rateLimitedEndpoints: Array.from(this.requestHistory.entries())
                .filter(([, requests]) => requests.length > this.maxRequestsPerMinute * 0.8)
                .map(([endpoint]) => endpoint)
        };
    }
    
    /**
     * Clear all API caches
     */
    async clearCache(): Promise<void> {
        await intelligentCache.invalidate(/^api_/);
        this.pendingRequests.clear();
        this.requestHistory.clear();
        
        logger.info('API cache cleared', 'ApiResponseCacheService.clearCache');
    }
    
    /**
     * Configure cache settings
     */
    configure(config: Partial<ApiCacheConfig>): void {
        this.config = { ...this.config, ...config };
        
        logger.info('API cache configured', 'ApiResponseCacheService.configure', config);
    }
}

// =========================================================================
// SINGLETON EXPORT
// =========================================================================

export default ApiResponseCacheService;

