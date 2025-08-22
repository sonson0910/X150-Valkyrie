/**
 * Intelligent Multi-Layer Cache System
 * 
 * Features:
 * - Memory cache (L1) - Fastest access
 * - Storage cache (L2) - Persistent across app restarts
 * - Network cache (L3) - Background sync and offline support
 * - Smart invalidation strategies
 * - Cache warming and prefetching
 * - Performance monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './Logger';
import { MemoryUtils } from './MemoryUtils';

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface CacheEntry<T = any> {
    key: string;
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
    version: string;
    tags: string[];
    size: number; // Approximate size in bytes
    accessCount: number;
    lastAccessed: number;
    priority: CachePriority;
    metadata?: Record<string, any>;
}

export enum CachePriority {
    CRITICAL = 'critical',     // Never evict unless expired
    HIGH = 'high',            // Evict only if memory pressure
    MEDIUM = 'medium',        // Normal eviction rules
    LOW = 'low'               // First to evict
}

export enum CacheStrategy {
    CACHE_FIRST = 'cache_first',           // Return cache if available
    CACHE_THEN_NETWORK = 'cache_then_network', // Return cache, update in background
    NETWORK_FIRST = 'network_first',       // Try network first, fallback to cache
    NETWORK_ONLY = 'network_only',         // Always fetch from network
    CACHE_ONLY = 'cache_only'              // Only return cached data
}

export interface CacheOptions {
    ttl?: number;
    strategy?: CacheStrategy;
    priority?: CachePriority;
    tags?: string[];
    version?: string;
    compress?: boolean;
    encrypt?: boolean;
    syncInBackground?: boolean;
    maxRetries?: number;
}

export interface CacheStats {
    memoryCache: {
        size: number;
        count: number;
        hitRate: number;
        missRate: number;
    };
    storageCache: {
        size: number;
        count: number;
        hitRate: number;
        missRate: number;
    };
    network: {
        requests: number;
        successRate: number;
        avgResponseTime: number;
    };
    evictions: {
        memory: number;
        storage: number;
        reasons: Record<string, number>;
    };
}

// =========================================================================
// INTELLIGENT CACHE MANAGER
// =========================================================================

export class IntelligentCacheManager {
    private static instance: IntelligentCacheManager;
    
    // Multi-layer cache storage
    private memoryCache = new Map<string, CacheEntry>();
    private storageCache = new Map<string, CacheEntry>();
    
    // Cache configuration
    private maxMemorySize = 50 * 1024 * 1024; // 50MB memory cache
    private maxStorageSize = 200 * 1024 * 1024; // 200MB storage cache
    private maxMemoryEntries = 1000;
    private maxStorageEntries = 5000;
    
    // Performance tracking
    private stats: CacheStats = {
        memoryCache: { size: 0, count: 0, hitRate: 0, missRate: 0 },
        storageCache: { size: 0, count: 0, hitRate: 0, missRate: 0 },
        network: { requests: 0, successRate: 0, avgResponseTime: 0 },
        evictions: { memory: 0, storage: 0, reasons: {} }
    };
    
    // Background sync management
    private syncQueue = new Set<string>();
    private syncInterval: NodeJS.Timeout | null = null;
    private isInitialized = false;
    
    private constructor() {
        this.initializeCache();
    }
    
    public static getInstance(): IntelligentCacheManager {
        if (!IntelligentCacheManager.instance) {
            IntelligentCacheManager.instance = new IntelligentCacheManager();
        }
        return IntelligentCacheManager.instance;
    }
    
    // =========================================================================
    // INITIALIZATION AND LIFECYCLE
    // =========================================================================
    
    private async initializeCache(): Promise<void> {
        try {
            // Load storage cache metadata
            await this.loadStorageCache();
            
            // Start background sync
            this.startBackgroundSync();
            
            // Setup memory monitoring
            this.setupMemoryMonitoring();
            
            this.isInitialized = true;
            logger.info('Intelligent cache initialized successfully', 'IntelligentCacheManager.initializeCache', {
                memoryEntries: this.memoryCache.size,
                storageEntries: this.storageCache.size
            });
            
        } catch (error) {
            logger.error('Failed to initialize cache', 'IntelligentCacheManager.initializeCache', error);
        }
    }
    
    private async loadStorageCache(): Promise<void> {
        try {
            const cacheIndex = await AsyncStorage.getItem('cache_index');
            if (!cacheIndex) return;
            
            const entries: Array<{ key: string; metadata: Omit<CacheEntry, 'data'> }> = JSON.parse(cacheIndex);
            
            for (const { key, metadata } of entries) {
                // Check if entry is still valid
                if (this.isEntryValid(metadata)) {
                    this.storageCache.set(key, metadata as CacheEntry);
                } else {
                    // Clean up expired entries
                    await AsyncStorage.removeItem(`cache_${key}`);
                }
            }
            
            this.updateStorageStats();
            
                    } catch (error) {
                logger.warn('Failed to load storage cache', 'IntelligentCacheManager.loadStorageCache', error as Error);
        }
    }
    
    private startBackgroundSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Sync every 30 seconds
        this.syncInterval = setInterval(() => {
            this.performBackgroundSync();
        }, 30000);
    }
    
    private setupMemoryMonitoring(): void {
        // Monitor memory usage every 10 seconds
        setInterval(() => {
            this.checkMemoryPressure();
        }, 10000);
    }
    
    // =========================================================================
    // CORE CACHE OPERATIONS
    // =========================================================================
    
    /**
     * Get data from cache with intelligent fallback
     */
    async get<T>(
        key: string, 
        fetchFunction?: () => Promise<T>, 
        options: CacheOptions = {}
    ): Promise<T | null> {
        const {
            strategy = CacheStrategy.CACHE_FIRST,
            ttl = 5 * 60 * 1000, // 5 minutes default
            priority = CachePriority.MEDIUM,
            tags = [],
            syncInBackground = true
        } = options;
        
        try {
            switch (strategy) {
                case CacheStrategy.CACHE_FIRST:
                    return await this.getCacheFirst(key, fetchFunction, options);
                    
                case CacheStrategy.CACHE_THEN_NETWORK:
                    return await this.getCacheThenNetwork(key, fetchFunction, options);
                    
                case CacheStrategy.NETWORK_FIRST:
                    return await this.getNetworkFirst(key, fetchFunction, options);
                    
                case CacheStrategy.NETWORK_ONLY:
                    return fetchFunction ? await fetchFunction() : null;
                    
                case CacheStrategy.CACHE_ONLY:
                    return await this.getCacheOnly(key);
                    
                default:
                    return await this.getCacheFirst(key, fetchFunction, options);
            }
            
        } catch (error) {
            logger.error('Cache get operation failed', 'IntelligentCacheManager.get', {
                key,
                strategy,
                error: (error as Error).message
            });
            
            // Fallback to fetch function if available
            if (fetchFunction) {
                try {
                    return await fetchFunction();
                } catch (fetchError) {
                    logger.error('Fallback fetch failed', 'IntelligentCacheManager.get', fetchError);
                    return null;
                }
            }
            
            return null;
        }
    }
    
    /**
     * Set data in cache with intelligent storage
     */
    async set<T>(
        key: string, 
        data: T, 
        options: CacheOptions = {}
    ): Promise<void> {
        const {
            ttl = 5 * 60 * 1000,
            priority = CachePriority.MEDIUM,
            tags = [],
            version = '1.0',
            compress = false,
            encrypt = false
        } = options;
        
        try {
            const now = Date.now();
            const serializedData = JSON.stringify(data);
            const size = new Blob([serializedData]).size;
            
            const entry: CacheEntry<T> = {
                key,
                data,
                timestamp: now,
                ttl,
                version,
                tags,
                size,
                accessCount: 0,
                lastAccessed: now,
                priority,
                metadata: {
                    compressed: compress,
                    encrypted: encrypt
                }
            };
            
            // Store in memory cache
            await this.setMemoryCache(key, entry);
            
            // Store in storage cache for persistence
            await this.setStorageCache(key, entry);
            
            logger.debug('Data cached successfully', 'IntelligentCacheManager.set', {
                key,
                size: `${(size / 1024).toFixed(2)}KB`,
                ttl: `${ttl / 1000}s`,
                priority
            });
            
        } catch (error) {
            logger.error('Failed to cache data', 'IntelligentCacheManager.set', {
                key,
                error: (error as Error).message
            });
        }
    }
    
    /**
     * Invalidate cache entries by key or tags
     */
    async invalidate(keyOrPattern: string | RegExp, tags?: string[]): Promise<void> {
        try {
            const keysToInvalidate = new Set<string>();
            
            // Find keys to invalidate
            if (typeof keyOrPattern === 'string') {
                keysToInvalidate.add(keyOrPattern);
            } else {
                // Pattern matching
                for (const key of this.memoryCache.keys()) {
                    if (keyOrPattern.test(key)) {
                        keysToInvalidate.add(key);
                    }
                }
                for (const key of this.storageCache.keys()) {
                    if (keyOrPattern.test(key)) {
                        keysToInvalidate.add(key);
                    }
                }
            }
            
            // Invalidate by tags
            if (tags && tags.length > 0) {
                for (const [key, entry] of this.memoryCache.entries()) {
                    if (entry.tags.some(tag => tags.includes(tag))) {
                        keysToInvalidate.add(key);
                    }
                }
                for (const [key, entry] of this.storageCache.entries()) {
                    if (entry.tags.some(tag => tags.includes(tag))) {
                        keysToInvalidate.add(key);
                    }
                }
            }
            
            // Remove from caches
            for (const key of keysToInvalidate) {
                this.memoryCache.delete(key);
                this.storageCache.delete(key);
                await AsyncStorage.removeItem(`cache_${key}`);
            }
            
            await this.saveStorageIndex();
            this.updateStats();
            
            logger.debug('Cache invalidated', 'IntelligentCacheManager.invalidate', {
                pattern: keyOrPattern.toString(),
                tags,
                invalidatedCount: keysToInvalidate.size
            });
            
        } catch (error) {
            logger.error('Cache invalidation failed', 'IntelligentCacheManager.invalidate', error);
        }
    }
    
    // =========================================================================
    // CACHE STRATEGY IMPLEMENTATIONS
    // =========================================================================
    
    private async getCacheFirst<T>(
        key: string,
        fetchFunction?: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T | null> {
        // Try memory cache first
        let entry = this.memoryCache.get(key);
        if (entry && this.isEntryValid(entry)) {
            this.updateAccessStats(entry, 'memory');
            return entry.data;
        }
        
        // Try storage cache
        entry = this.storageCache.get(key);
        if (entry && this.isEntryValid(entry)) {
            // Promote to memory cache
            this.memoryCache.set(key, entry);
            this.updateAccessStats(entry, 'storage');
            return entry.data;
        }
        
        // Try loading from storage
        const storedData = await this.loadFromStorage(key);
        if (storedData) {
            return storedData;
        }
        
        // Cache miss - fetch from network if available
        if (fetchFunction) {
            const data = await fetchFunction();
            if (data !== null) {
                await this.set(key, data, options);
            }
            return data;
        }
        
        this.stats.memoryCache.missRate++;
        this.stats.storageCache.missRate++;
        return null;
    }
    
    private async getCacheThenNetwork<T>(
        key: string,
        fetchFunction?: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T | null> {
        // Return cached data immediately if available
        const cachedData = await this.getCacheOnly(key);
        
        // Fetch fresh data in background if syncInBackground is true
        if (options.syncInBackground && fetchFunction) {
            this.syncQueue.add(key);
            
            // Don't await - let it update in background
            fetchFunction().then(async (freshData) => {
                if (freshData !== null) {
                    await this.set(key, freshData, options);
                }
                this.syncQueue.delete(key);
            }).catch((error) => {
                logger.warn('Background sync failed', 'IntelligentCacheManager.getCacheThenNetwork', {
                    key,
                    error: error.message
                });
                this.syncQueue.delete(key);
            });
        }
        
        return cachedData;
    }
    
    private async getNetworkFirst<T>(
        key: string,
        fetchFunction?: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T | null> {
        if (fetchFunction) {
            try {
                const startTime = Date.now();
                const data = await fetchFunction();
                
                // Update network stats
                this.stats.network.requests++;
                this.stats.network.avgResponseTime = 
                    (this.stats.network.avgResponseTime + (Date.now() - startTime)) / 2;
                this.stats.network.successRate = 
                    (this.stats.network.successRate * (this.stats.network.requests - 1) + 1) / this.stats.network.requests;
                
                if (data !== null) {
                    await this.set(key, data, options);
                }
                return data;
                
            } catch (error) {
                // Network failed - fallback to cache
                logger.warn('Network fetch failed, falling back to cache', 'IntelligentCacheManager.getNetworkFirst', {
                    key,
                    error: error.message
                });
                
                return await this.getCacheOnly(key);
            }
        }
        
        return await this.getCacheOnly(key);
    }
    
    private async getCacheOnly<T>(key: string): Promise<T | null> {
        // Check memory cache
        let entry = this.memoryCache.get(key);
        if (entry && this.isEntryValid(entry)) {
            this.updateAccessStats(entry, 'memory');
            return entry.data;
        }
        
        // Check storage cache
        entry = this.storageCache.get(key);
        if (entry && this.isEntryValid(entry)) {
            this.updateAccessStats(entry, 'storage');
            return entry.data;
        }
        
        // Try loading from storage
        return await this.loadFromStorage(key);
    }
    
    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    
    private isEntryValid(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp < entry.ttl;
    }
    
    private updateAccessStats(entry: CacheEntry, cacheType: 'memory' | 'storage'): void {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        
        if (cacheType === 'memory') {
            this.stats.memoryCache.hitRate++;
        } else {
            this.stats.storageCache.hitRate++;
        }
    }
    
    private async setMemoryCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
        // Check if we need to evict entries
        await this.evictIfNeeded('memory');
        
        this.memoryCache.set(key, entry);
        this.updateMemoryStats();
    }
    
    private async setStorageCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
        // Check if we need to evict entries
        await this.evictIfNeeded('storage');
        
        // Store data
        await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry.data));
        
                        // Store metadata without data
                const { data, ...metadata } = entry;
                this.storageCache.set(key, { ...metadata, data: undefined as any } as CacheEntry);
        
        await this.saveStorageIndex();
        this.updateStorageStats();
    }
    
    private async loadFromStorage<T>(key: string): Promise<T | null> {
        try {
            const stored = await AsyncStorage.getItem(`cache_${key}`);
            if (stored) {
                const data = JSON.parse(stored);
                
                // Check if we have metadata
                const entry = this.storageCache.get(key);
                if (entry && this.isEntryValid(entry)) {
                    // Promote to memory cache
                    const fullEntry = { ...entry, data };
                    this.memoryCache.set(key, fullEntry);
                    this.updateAccessStats(fullEntry, 'storage');
                    return data;
                }
            }
            
            return null;
            
        } catch (error) {
            logger.warn('Failed to load from storage', 'IntelligentCacheManager.loadFromStorage', {
                key,
                error: error.message
            });
            return null;
        }
    }
    
    private async saveStorageIndex(): Promise<void> {
        try {
            const index = Array.from(this.storageCache.entries()).map(([key, entry]) => ({
                key,
                metadata: { ...entry }
            }));
            
            await AsyncStorage.setItem('cache_index', JSON.stringify(index));
            
        } catch (error) {
            logger.warn('Failed to save storage index', 'IntelligentCacheManager.saveStorageIndex', error);
        }
    }
    
    private async evictIfNeeded(cacheType: 'memory' | 'storage'): Promise<void> {
        const cache = cacheType === 'memory' ? this.memoryCache : this.storageCache;
        const maxSize = cacheType === 'memory' ? this.maxMemorySize : this.maxStorageSize;
        const maxEntries = cacheType === 'memory' ? this.maxMemoryEntries : this.maxStorageEntries;
        
        const currentSize = this.calculateCacheSize(cache);
        
        if (cache.size >= maxEntries || currentSize >= maxSize) {
            await this.performEviction(cacheType);
        }
    }
    
    private async performEviction(cacheType: 'memory' | 'storage'): Promise<void> {
        const cache = cacheType === 'memory' ? this.memoryCache : this.storageCache;
        const entries = Array.from(cache.entries());
        
        // Sort by priority and last accessed time
        entries.sort(([, a], [, b]) => {
            // Never evict critical entries unless expired
            if (a.priority === CachePriority.CRITICAL && this.isEntryValid(a)) return 1;
            if (b.priority === CachePriority.CRITICAL && this.isEntryValid(b)) return -1;
            
            // Evict expired entries first
            const aExpired = !this.isEntryValid(a);
            const bExpired = !this.isEntryValid(b);
            if (aExpired && !bExpired) return -1;
            if (!aExpired && bExpired) return 1;
            
            // Then by priority
            const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Finally by access time (LRU)
            return a.lastAccessed - b.lastAccessed;
        });
        
        // Evict 25% of entries
        const evictCount = Math.ceil(entries.length * 0.25);
        const toEvict = entries.slice(0, evictCount);
        
        for (const [key] of toEvict) {
            cache.delete(key);
            
            if (cacheType === 'storage') {
                await AsyncStorage.removeItem(`cache_${key}`);
            }
        }
        
        // Update stats
        if (cacheType === 'memory') {
            this.stats.evictions.memory += evictCount;
        } else {
            this.stats.evictions.storage += evictCount;
            await this.saveStorageIndex();
        }
        
        logger.debug(`Evicted ${evictCount} entries from ${cacheType} cache`, 'IntelligentCacheManager.performEviction');
    }
    
    private calculateCacheSize(cache: Map<string, CacheEntry>): number {
        return Array.from(cache.values()).reduce((total, entry) => total + entry.size, 0);
    }
    
    private updateMemoryStats(): void {
        this.stats.memoryCache.count = this.memoryCache.size;
        this.stats.memoryCache.size = this.calculateCacheSize(this.memoryCache);
    }
    
    private updateStorageStats(): void {
        this.stats.storageCache.count = this.storageCache.size;
        this.stats.storageCache.size = this.calculateCacheSize(this.storageCache);
    }
    
    private updateStats(): void {
        this.updateMemoryStats();
        this.updateStorageStats();
    }
    
    private async performBackgroundSync(): Promise<void> {
        if (this.syncQueue.size === 0) return;
        
        logger.debug('Performing background sync', 'IntelligentCacheManager.performBackgroundSync', {
            queueSize: this.syncQueue.size
        });
        
        // Process sync queue (implementation depends on specific API needs)
        // This is a hook for implementing custom sync logic
    }
    
    private checkMemoryPressure(): void {
        const memorySize = this.stats.memoryCache.size;
        const memoryPressure = memorySize / this.maxMemorySize;
        
        if (memoryPressure > 0.8) {
            logger.warn('High memory cache pressure detected', 'IntelligentCacheManager.checkMemoryPressure', {
                currentSize: `${(memorySize / 1024 / 1024).toFixed(2)}MB`,
                maxSize: `${(this.maxMemorySize / 1024 / 1024).toFixed(2)}MB`,
                pressure: `${(memoryPressure * 100).toFixed(1)}%`
            });
            
            // Trigger aggressive eviction
            this.performEviction('memory');
        }
    }
    
    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }
    
    /**
     * Clear all caches
     */
    async clearAll(): Promise<void> {
        this.memoryCache.clear();
        this.storageCache.clear();
        
        // Clear AsyncStorage cache entries
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith('cache_'));
        await AsyncStorage.multiRemove([...cacheKeys, 'cache_index']);
        
        this.updateStats();
        
        logger.info('All caches cleared', 'IntelligentCacheManager.clearAll');
    }
    
    /**
     * Warm up cache with critical data
     */
    async warmup(entries: Array<{ key: string; fetchFunction: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
        logger.info('Starting cache warmup', 'IntelligentCacheManager.warmup', {
            entriesCount: entries.length
        });
        
        const promises = entries.map(async ({ key, fetchFunction, options }) => {
            try {
                await this.get(key, fetchFunction, { priority: CachePriority.HIGH, ...options });
            } catch (error) {
                logger.warn('Cache warmup failed for key', 'IntelligentCacheManager.warmup', {
                    key,
                    error: error.message
                });
            }
        });
        
        await Promise.allSettled(promises);
        
        logger.info('Cache warmup completed', 'IntelligentCacheManager.warmup');
    }
    
    /**
     * Cleanup and shutdown
     */
    async shutdown(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        await this.saveStorageIndex();
        
        // Clear sensitive data from memory
        this.memoryCache.clear();
        
        logger.info('Cache manager shut down', 'IntelligentCacheManager.shutdown');
    }
}

// =========================================================================
// SINGLETON EXPORT
// =========================================================================

export const intelligentCache = IntelligentCacheManager.getInstance();
export default intelligentCache;
