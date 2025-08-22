/**
 * Portfolio Data Cache Service
 * 
 * Features:
 * - Asset price caching with real-time updates
 * - Portfolio analytics caching
 * - Market data aggregation
 * - Performance metrics caching
 * - Historical data preservation
 * - Smart cache warming for popular assets
 */

import { intelligentCache, CacheStrategy, CachePriority, CacheOptions } from '../../utils/IntelligentCache';
import logger from '../../utils/Logger';

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface AssetPriceData {
    symbol: string;
    price: number;
    priceUsd: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    lastUpdated: number;
    source: string;
}

export interface PortfolioAnalyticsData {
    totalValue: number;
    totalValueUsd: number;
    adaBalance: number;
    nativeTokens: Array<{
        unit: string;
        quantity: string;
        value: number;
        valueUsd: number;
        metadata?: any;
    }>;
    nftCount: number;
    stakingRewards: number;
    allocation: {
        ada: number;
        tokens: number;
        nfts: number;
        staking: number;
    };
    performance: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
    riskMetrics: {
        volatility: number;
        sharpeRatio: number;
        maxDrawdown: number;
        beta: number;
    };
}

export interface HistoricalPriceData {
    symbol: string;
    timeframe: '1h' | '1d' | '1w' | '1m' | '1y';
    data: Array<{
        timestamp: number;
        price: number;
        volume: number;
    }>;
    lastUpdated: number;
}

export interface MarketDataCache {
    topAssets: AssetPriceData[];
    marketSummary: {
        totalMarketCap: number;
        total24hVolume: number;
        btcDominance: number;
        adaRank: number;
    };
    trendingAssets: string[];
    lastUpdated: number;
}

export interface PerformanceMetrics {
    address: string;
    period: '24h' | '7d' | '30d' | '90d' | '1y';
    metrics: {
        totalReturn: number;
        annualizedReturn: number;
        volatility: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        bestDay: number;
        worstDay: number;
    };
    benchmark: {
        ada: number;
        btc: number;
        spy: number;
    };
    calculatedAt: number;
}

// =========================================================================
// CACHE CONFIGURATIONS
// =========================================================================

const PORTFOLIO_CACHE_CONFIGS = {
    ASSET_PRICES: {
        ttl: 30 * 1000, // 30 seconds for real-time prices
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['portfolio', 'prices'],
        syncInBackground: true
    },
    
    PORTFOLIO_ANALYTICS: {
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['portfolio', 'analytics'],
        syncInBackground: true
    },
    
    HISTORICAL_PRICES: {
        ttl: 60 * 60 * 1000, // 1 hour
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['portfolio', 'historical'],
        syncInBackground: false
    },
    
    MARKET_DATA: {
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['portfolio', 'market'],
        syncInBackground: true
    },
    
    PERFORMANCE_METRICS: {
        ttl: 15 * 60 * 1000, // 15 minutes
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['portfolio', 'performance'],
        syncInBackground: true
    }
} as const;

// Popular assets to warm cache for
const POPULAR_ASSETS = [
    'ADA', 'BTC', 'ETH', 'USDC', 'USDT', 'BNB', 'SOL', 'DOT', 'MATIC', 'LINK'
];

// =========================================================================
// PORTFOLIO DATA CACHE SERVICE
// =========================================================================

export class PortfolioDataCacheService {
    private static instance: PortfolioDataCacheService;
    
    // Price update management
    private priceUpdateInterval: NodeJS.Timeout | null = null;
    private activePriceRequests = new Set<string>();
    
    // Subscription management for real-time updates
    private priceSubscriptions = new Map<string, Array<(data: AssetPriceData) => void>>();
    private portfolioSubscriptions = new Map<string, Array<(data: PortfolioAnalyticsData) => void>>();
    
    // Cache warming
    private warmupInProgress = false;
    
    private constructor() {
        this.initializeService();
    }
    
    public static getInstance(): PortfolioDataCacheService {
        if (!PortfolioDataCacheService.instance) {
            PortfolioDataCacheService.instance = new PortfolioDataCacheService();
        }
        return PortfolioDataCacheService.instance;
    }
    
    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    
    private async initializeService(): Promise<void> {
        try {
            // Start price update system
            this.startPriceUpdates();
            
            // Warm up cache with popular assets
            await this.warmupCache();
            
            logger.info('Portfolio data cache service initialized', 'PortfolioDataCacheService.initializeService');
            
        } catch (error) {
            logger.error('Failed to initialize portfolio cache', 'PortfolioDataCacheService.initializeService', error);
        }
    }
    
    private startPriceUpdates(): void {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
        
        // Update prices every 30 seconds
        this.priceUpdateInterval = setInterval(() => {
            this.updateSubscribedPrices();
        }, 30000);
    }
    
    private async warmupCache(): Promise<void> {
        if (this.warmupInProgress) return;
        
        this.warmupInProgress = true;
        
        try {
            logger.info('Starting portfolio cache warmup', 'PortfolioDataCacheService.warmupCache');
            
            // Warm up popular asset prices
            const pricePromises = POPULAR_ASSETS.map(async (symbol) => {
                try {
                    await this.getAssetPrice(symbol);
                } catch (error) {
                    logger.warn('Failed to warm up price cache', 'PortfolioDataCacheService.warmupCache', {
                        symbol,
                        error: error.message
                    });
                }
            });
            
            // Warm up market data
            const marketDataPromise = this.getMarketData();
            
            await Promise.allSettled([...pricePromises, marketDataPromise]);
            
            logger.info('Portfolio cache warmup completed', 'PortfolioDataCacheService.warmupCache');
            
        } catch (error) {
            logger.error('Portfolio cache warmup failed', 'PortfolioDataCacheService.warmupCache', error);
        } finally {
            this.warmupInProgress = false;
        }
    }
    
    // =========================================================================
    // ASSET PRICE METHODS
    // =========================================================================
    
    /**
     * Get current asset price with caching
     */
    async getAssetPrice(symbol: string): Promise<AssetPriceData> {
        const cacheKey = `price_${symbol.toLowerCase()}`;
        
        try {
            const fetchFunction = async (): Promise<AssetPriceData> => {
                return await this.fetchAssetPrice(symbol);
            };
            
            const cached = await intelligentCache.get<AssetPriceData>(
                cacheKey,
                fetchFunction,
                PORTFOLIO_CACHE_CONFIGS.ASSET_PRICES
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchAssetPrice(symbol);
            
        } catch (error) {
            logger.error('Failed to get asset price', 'PortfolioDataCacheService.getAssetPrice', {
                symbol,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Get multiple asset prices efficiently
     */
    async getAssetPrices(symbols: string[]): Promise<AssetPriceData[]> {
        try {
            const pricePromises = symbols.map(symbol => this.getAssetPrice(symbol));
            const results = await Promise.allSettled(pricePromises);
            
            return results
                .filter((result): result is PromiseFulfilledResult<AssetPriceData> => 
                    result.status === 'fulfilled')
                .map(result => result.value);
                
        } catch (error) {
            logger.error('Failed to get asset prices', 'PortfolioDataCacheService.getAssetPrices', {
                symbols,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Subscribe to real-time price updates
     */
    subscribeToPriceUpdates(symbol: string, callback: (data: AssetPriceData) => void): () => void {
        const key = symbol.toLowerCase();
        
        if (!this.priceSubscriptions.has(key)) {
            this.priceSubscriptions.set(key, []);
        }
        
        this.priceSubscriptions.get(key)!.push(callback);
        
        // Immediately fetch current price
        this.getAssetPrice(symbol).then(callback).catch(error => {
            logger.warn('Failed to get initial price for subscription', 'PortfolioDataCacheService.subscribeToPriceUpdates', {
                symbol,
                error: error.message
            });
        });
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.priceSubscriptions.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
                
                // Clean up empty subscriptions
                if (callbacks.length === 0) {
                    this.priceSubscriptions.delete(key);
                }
            }
        };
    }
    
    // =========================================================================
    // PORTFOLIO ANALYTICS METHODS
    // =========================================================================
    
    /**
     * Get portfolio analytics with caching
     */
    async getPortfolioAnalytics(address: string): Promise<PortfolioAnalyticsData> {
        const cacheKey = `portfolio_${address}`;
        
        try {
            const fetchFunction = async (): Promise<PortfolioAnalyticsData> => {
                return await this.calculatePortfolioAnalytics(address);
            };
            
            const cached = await intelligentCache.get<PortfolioAnalyticsData>(
                cacheKey,
                fetchFunction,
                PORTFOLIO_CACHE_CONFIGS.PORTFOLIO_ANALYTICS
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.calculatePortfolioAnalytics(address);
            
        } catch (error) {
            logger.error('Failed to get portfolio analytics', 'PortfolioDataCacheService.getPortfolioAnalytics', {
                address,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Subscribe to portfolio updates
     */
    subscribeToPortfolioUpdates(address: string, callback: (data: PortfolioAnalyticsData) => void): () => void {
        if (!this.portfolioSubscriptions.has(address)) {
            this.portfolioSubscriptions.set(address, []);
        }
        
        this.portfolioSubscriptions.get(address)!.push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.portfolioSubscriptions.get(address);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
                
                if (callbacks.length === 0) {
                    this.portfolioSubscriptions.delete(address);
                }
            }
        };
    }
    
    // =========================================================================
    // HISTORICAL DATA METHODS
    // =========================================================================
    
    /**
     * Get historical price data
     */
    async getHistoricalPrices(
        symbol: string, 
        timeframe: '1h' | '1d' | '1w' | '1m' | '1y'
    ): Promise<HistoricalPriceData> {
        const cacheKey = `historical_${symbol.toLowerCase()}_${timeframe}`;
        
        try {
            const fetchFunction = async (): Promise<HistoricalPriceData> => {
                return await this.fetchHistoricalPrices(symbol, timeframe);
            };
            
            const cached = await intelligentCache.get<HistoricalPriceData>(
                cacheKey,
                fetchFunction,
                PORTFOLIO_CACHE_CONFIGS.HISTORICAL_PRICES
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchHistoricalPrices(symbol, timeframe);
            
        } catch (error) {
            logger.error('Failed to get historical prices', 'PortfolioDataCacheService.getHistoricalPrices', {
                symbol,
                timeframe,
                error: error.message
            });
            throw error;
        }
    }
    
    // =========================================================================
    // MARKET DATA METHODS
    // =========================================================================
    
    /**
     * Get market data summary
     */
    async getMarketData(): Promise<MarketDataCache> {
        const cacheKey = 'market_data_summary';
        
        try {
            const fetchFunction = async (): Promise<MarketDataCache> => {
                return await this.fetchMarketData();
            };
            
            const cached = await intelligentCache.get<MarketDataCache>(
                cacheKey,
                fetchFunction,
                PORTFOLIO_CACHE_CONFIGS.MARKET_DATA
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchMarketData();
            
        } catch (error) {
            logger.error('Failed to get market data', 'PortfolioDataCacheService.getMarketData', {
                error: error.message
            });
            throw error;
        }
    }
    
    // =========================================================================
    // PERFORMANCE METRICS METHODS
    // =========================================================================
    
    /**
     * Get performance metrics for an address
     */
    async getPerformanceMetrics(
        address: string, 
        period: '24h' | '7d' | '30d' | '90d' | '1y'
    ): Promise<PerformanceMetrics> {
        const cacheKey = `performance_${address}_${period}`;
        
        try {
            const fetchFunction = async (): Promise<PerformanceMetrics> => {
                return await this.calculatePerformanceMetrics(address, period);
            };
            
            const cached = await intelligentCache.get<PerformanceMetrics>(
                cacheKey,
                fetchFunction,
                PORTFOLIO_CACHE_CONFIGS.PERFORMANCE_METRICS
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.calculatePerformanceMetrics(address, period);
            
        } catch (error) {
            logger.error('Failed to get performance metrics', 'PortfolioDataCacheService.getPerformanceMetrics', {
                address,
                period,
                error: error.message
            });
            throw error;
        }
    }
    
    // =========================================================================
    // CACHE INVALIDATION
    // =========================================================================
    
    /**
     * Invalidate portfolio data for an address
     */
    async invalidatePortfolioData(address: string): Promise<void> {
        try {
            const patterns = [
                new RegExp(`portfolio_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                new RegExp(`performance_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`)
            ];
            
            for (const pattern of patterns) {
                await intelligentCache.invalidate(pattern);
            }
            
            logger.debug('Portfolio data invalidated', 'PortfolioDataCacheService.invalidatePortfolioData', {
                address
            });
            
        } catch (error) {
            logger.error('Failed to invalidate portfolio data', 'PortfolioDataCacheService.invalidatePortfolioData', error);
        }
    }
    
    /**
     * Invalidate price data
     */
    async invalidatePriceData(symbols?: string[]): Promise<void> {
        try {
            if (symbols && symbols.length > 0) {
                for (const symbol of symbols) {
                    await intelligentCache.invalidate(`price_${symbol.toLowerCase()}`);
                }
            } else {
                await intelligentCache.invalidate(/^price_/);
            }
            
            logger.debug('Price data invalidated', 'PortfolioDataCacheService.invalidatePriceData', {
                symbols
            });
            
        } catch (error) {
            logger.error('Failed to invalidate price data', 'PortfolioDataCacheService.invalidatePriceData', error);
        }
    }
    
    // =========================================================================
    // PRIVATE METHODS (MOCK IMPLEMENTATIONS)
    // =========================================================================
    
    private async fetchAssetPrice(symbol: string): Promise<AssetPriceData> {
        // Mock implementation - replace with actual API calls
        logger.debug('Fetching asset price from network', 'PortfolioDataCacheService.fetchAssetPrice', {
            symbol
        });
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            symbol: symbol.toUpperCase(),
            price: Math.random() * 100,
            priceUsd: Math.random() * 100,
            change24h: (Math.random() - 0.5) * 20,
            volume24h: Math.random() * 1000000,
            marketCap: Math.random() * 10000000,
            lastUpdated: Date.now(),
            source: 'mock'
        };
    }
    
    private async calculatePortfolioAnalytics(address: string): Promise<PortfolioAnalyticsData> {
        // Mock implementation
        logger.debug('Calculating portfolio analytics', 'PortfolioDataCacheService.calculatePortfolioAnalytics', {
            address
        });
        
        return {
            totalValue: 1000,
            totalValueUsd: 1200,
            adaBalance: 500,
            nativeTokens: [],
            nftCount: 5,
            stakingRewards: 50,
            allocation: {
                ada: 70,
                tokens: 20,
                nfts: 5,
                staking: 5
            },
            performance: {
                daily: 2.5,
                weekly: 8.3,
                monthly: 15.7,
                yearly: 45.2
            },
            riskMetrics: {
                volatility: 0.35,
                sharpeRatio: 1.2,
                maxDrawdown: -0.15,
                beta: 0.8
            }
        };
    }
    
    private async fetchHistoricalPrices(
        symbol: string, 
        timeframe: string
    ): Promise<HistoricalPriceData> {
        // Mock implementation
        logger.debug('Fetching historical prices from network', 'PortfolioDataCacheService.fetchHistoricalPrices', {
            symbol,
            timeframe
        });
        
        return {
            symbol: symbol.toUpperCase(),
            timeframe: timeframe as any,
            data: [],
            lastUpdated: Date.now()
        };
    }
    
    private async fetchMarketData(): Promise<MarketDataCache> {
        // Mock implementation
        logger.debug('Fetching market data from network', 'PortfolioDataCacheService.fetchMarketData');
        
        return {
            topAssets: [],
            marketSummary: {
                totalMarketCap: 1000000000000,
                total24hVolume: 50000000000,
                btcDominance: 45.2,
                adaRank: 8
            },
            trendingAssets: ['ADA', 'BTC', 'ETH'],
            lastUpdated: Date.now()
        };
    }
    
    private async calculatePerformanceMetrics(
        address: string, 
        period: string
    ): Promise<PerformanceMetrics> {
        // Mock implementation
        logger.debug('Calculating performance metrics', 'PortfolioDataCacheService.calculatePerformanceMetrics', {
            address,
            period
        });
        
        return {
            address,
            period: period as any,
            metrics: {
                totalReturn: 15.7,
                annualizedReturn: 42.3,
                volatility: 0.35,
                sharpeRatio: 1.2,
                maxDrawdown: -0.15,
                winRate: 0.65,
                bestDay: 8.5,
                worstDay: -5.2
            },
            benchmark: {
                ada: 12.3,
                btc: 18.9,
                spy: 8.7
            },
            calculatedAt: Date.now()
        };
    }
    
    // =========================================================================
    // BACKGROUND UPDATES
    // =========================================================================
    
    private async updateSubscribedPrices(): Promise<void> {
        const subscribedSymbols = Array.from(this.priceSubscriptions.keys());
        
        if (subscribedSymbols.length === 0) return;
        
        try {
            const pricePromises = subscribedSymbols.map(async (symbol) => {
                if (this.activePriceRequests.has(symbol)) return;
                
                this.activePriceRequests.add(symbol);
                
                try {
                    const priceData = await this.getAssetPrice(symbol);
                    
                    // Notify subscribers
                    const callbacks = this.priceSubscriptions.get(symbol);
                    if (callbacks) {
                        callbacks.forEach(callback => {
                            try {
                                callback(priceData);
                            } catch (error) {
                                logger.error('Price update callback error', 'PortfolioDataCacheService.updateSubscribedPrices', error);
                            }
                        });
                    }
                    
                } finally {
                    this.activePriceRequests.delete(symbol);
                }
            });
            
            await Promise.allSettled(pricePromises);
            
        } catch (error) {
            logger.error('Background price update failed', 'PortfolioDataCacheService.updateSubscribedPrices', error);
        }
    }
    
    // =========================================================================
    // PUBLIC API
    // =========================================================================
    
    /**
     * Get cache statistics
     */
    getStats() {
        const baseStats = intelligentCache.getStats();
        return {
            ...baseStats,
            priceSubscriptions: this.priceSubscriptions.size,
            portfolioSubscriptions: this.portfolioSubscriptions.size,
            activePriceRequests: this.activePriceRequests.size,
            warmupInProgress: this.warmupInProgress
        };
    }
    
    /**
     * Clear all portfolio caches
     */
    async clearCache(): Promise<void> {
        await intelligentCache.invalidate(/^(price_|portfolio_|historical_|performance_|market_)/);
        
        logger.info('Portfolio data cache cleared', 'PortfolioDataCacheService.clearCache');
    }
    
    /**
     * Shutdown service
     */
    async shutdown(): Promise<void> {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
            this.priceUpdateInterval = null;
        }
        
        this.priceSubscriptions.clear();
        this.portfolioSubscriptions.clear();
        this.activePriceRequests.clear();
        
        logger.info('Portfolio data cache service shut down', 'PortfolioDataCacheService.shutdown');
    }
}

// =========================================================================
// SINGLETON EXPORT
// =========================================================================

export const portfolioDataCache = PortfolioDataCacheService.getInstance();
export default portfolioDataCache;

