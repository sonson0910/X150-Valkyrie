import logger from '../../utils/Logger';
import { environment } from '../../config/Environment';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PriceData {
    symbol: string;
    price: number;
    change24h: number;
    change7d: number;
    change30d: number;
    lastUpdated: Date;
}

export interface HistoricalPrice {
    date: Date;
    price: number;
    volume: number;
}

/**
 * AssetPriceService - Manages asset price tracking and market data
 * 
 * Responsibilities:
 * - Fetch real-time prices from multiple sources
 * - Cache price data for offline usage
 * - Historical price data management
 * - Price change calculations
 * - Market data aggregation
 * - Rate limiting and API key management
 */
export class AssetPriceService {
    private static instance: AssetPriceService;
    private priceCache: Map<string, PriceData> = new Map();
    private historicalCache: Map<string, HistoricalPrice[]> = new Map();
    private lastFetchTime: Map<string, number> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly RATE_LIMIT_DELAY = 1000; // 1 second between API calls

    private constructor() {
        // Load cached prices on initialization
        this.loadCachedPrices();
    }

    public static getInstance(): AssetPriceService {
        if (!AssetPriceService.instance) {
            AssetPriceService.instance = new AssetPriceService();
        }
        return AssetPriceService.instance;
    }

    /**
     * Get current ADA price
     * @returns ADA price in USD
     */
    async getADAPrice(): Promise<number> {
        try {
            const priceData = await this.getAssetPrice('ADA');
            return priceData.price;
        } catch (error) {
            logger.error('Failed to get ADA price', 'AssetPriceService.getADAPrice', error);
            return this.getFallbackPrice('ADA');
        }
    }

    /**
     * Get price for any asset
     * @param symbol - Asset symbol (e.g., 'ADA', 'AGIX', 'MIN')
     * @returns Price data with changes
     */
    async getAssetPrice(symbol: string): Promise<PriceData> {
        try {
            // Check cache first
            const cached = this.priceCache.get(symbol);
            const lastFetch = this.lastFetchTime.get(symbol) || 0;
            const now = Date.now();

            if (cached && (now - lastFetch) < this.CACHE_DURATION) {
                logger.debug('Returning cached price', 'AssetPriceService.getAssetPrice', { symbol, price: cached.price });
                return cached;
            }

            // Fetch from API
            const priceData = await this.fetchPriceFromAPI(symbol);
            
            // Update cache
            this.priceCache.set(symbol, priceData);
            this.lastFetchTime.set(symbol, now);
            
            // Cache to storage
            await this.cachePriceData(symbol, priceData);

            logger.debug('Fetched fresh price data', 'AssetPriceService.getAssetPrice', { 
                symbol, 
                price: priceData.price,
                change24h: priceData.change24h 
            });

            return priceData;

        } catch (error) {
            logger.error('Failed to get asset price', 'AssetPriceService.getAssetPrice', { symbol, error });
            
            // Return cached data if available, otherwise fallback
            const cached = this.priceCache.get(symbol);
            return cached || this.createFallbackPriceData(symbol);
        }
    }

    /**
     * Get prices for multiple assets
     * @param symbols - Array of asset symbols
     * @returns Map of symbol to price data
     */
    async getMultipleAssetPrices(symbols: string[]): Promise<Map<string, PriceData>> {
        const results = new Map<string, PriceData>();
        
        try {
            // Use rate limiting to avoid API throttling
            for (const symbol of symbols) {
                const priceData = await this.getAssetPrice(symbol);
                results.set(symbol, priceData);
                
                // Rate limiting delay
                if (symbols.indexOf(symbol) < symbols.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
                }
            }

            logger.info('Fetched multiple asset prices', 'AssetPriceService.getMultipleAssetPrices', {
                symbolCount: symbols.length,
                successCount: results.size
            });

        } catch (error) {
            logger.error('Failed to fetch multiple asset prices', 'AssetPriceService.getMultipleAssetPrices', {
                symbols,
                error
            });
        }

        return results;
    }

    /**
     * Get historical price data
     * @param symbol - Asset symbol
     * @param days - Number of days of history
     * @returns Array of historical price points
     */
    async getHistoricalPrices(symbol: string, days: number = 30): Promise<HistoricalPrice[]> {
        try {
            const cacheKey = `${symbol}_${days}d`;
            
            // Check cache first
            const cached = this.historicalCache.get(cacheKey);
            if (cached && cached.length > 0) {
                const latestDate = cached[cached.length - 1].date;
                const hoursSinceUpdate = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceUpdate < 1) { // Use cache if less than 1 hour old
                    logger.debug('Returning cached historical prices', 'AssetPriceService.getHistoricalPrices', {
                        symbol,
                        days,
                        dataPoints: cached.length
                    });
                    return cached;
                }
            }

            // Fetch from API
            const historicalData = await this.fetchHistoricalPricesFromAPI(symbol, days);
            
            // Update cache
            this.historicalCache.set(cacheKey, historicalData);
            
            // Cache to storage
            await this.cacheHistoricalData(cacheKey, historicalData);

            logger.info('Fetched historical price data', 'AssetPriceService.getHistoricalPrices', {
                symbol,
                days,
                dataPoints: historicalData.length
            });

            return historicalData;

        } catch (error) {
            logger.error('Failed to get historical prices', 'AssetPriceService.getHistoricalPrices', {
                symbol,
                days,
                error
            });

            // Return cached data if available, otherwise generate mock data
            const cacheKey = `${symbol}_${days}d`;
            const cached = this.historicalCache.get(cacheKey);
            return cached || this.generateMockHistoricalData(symbol, days);
        }
    }

    /**
     * Calculate price change percentage
     * @param currentPrice - Current price
     * @param previousPrice - Previous price
     * @returns Change percentage
     */
    calculatePriceChange(currentPrice: number, previousPrice: number): number {
        if (previousPrice === 0) return 0;
        return ((currentPrice - previousPrice) / previousPrice) * 100;
    }

    /**
     * Get price at specific date
     * @param symbol - Asset symbol
     * @param date - Target date
     * @returns Price at that date
     */
    async getPriceAtDate(symbol: string, date: Date): Promise<number> {
        try {
            const historicalData = await this.getHistoricalPrices(symbol, 30);
            
            // Find closest date
            const targetTime = date.getTime();
            let closestPrice = historicalData[0]?.price || 0;
            let minTimeDiff = Math.abs(historicalData[0]?.date.getTime() - targetTime);

            for (const dataPoint of historicalData) {
                const timeDiff = Math.abs(dataPoint.date.getTime() - targetTime);
                if (timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    closestPrice = dataPoint.price;
                }
            }

            logger.debug('Found price at date', 'AssetPriceService.getPriceAtDate', {
                symbol,
                date: date.toISOString(),
                price: closestPrice
            });

            return closestPrice;

        } catch (error) {
            logger.error('Failed to get price at date', 'AssetPriceService.getPriceAtDate', {
                symbol,
                date,
                error
            });
            return this.getFallbackPrice(symbol);
        }
    }

    /**
     * Clear all cached price data
     */
    async clearCache(): Promise<void> {
        try {
            this.priceCache.clear();
            this.historicalCache.clear();
            this.lastFetchTime.clear();

            // Clear from storage
            const keys = await AsyncStorage.getAllKeys();
            const priceKeys = keys.filter(key => key.startsWith('price_') || key.startsWith('historical_'));
            await AsyncStorage.multiRemove(priceKeys);

            logger.info('Price cache cleared', 'AssetPriceService.clearCache');

        } catch (error) {
            logger.error('Failed to clear price cache', 'AssetPriceService.clearCache', error);
        }
    }

    /**
     * Get cached price data for offline usage
     * @returns Map of all cached price data
     */
    getCachedPrices(): Map<string, PriceData> {
        return new Map(this.priceCache);
    }

    // Private helper methods

    /**
     * Fetch price from external API
     */
    private async fetchPriceFromAPI(symbol: string): Promise<PriceData> {
        try {
            // Try CoinGecko API first
            const coingeckoResponse = await this.fetchFromCoinGecko(symbol);
            if (coingeckoResponse) {
                return coingeckoResponse;
            }

            // Fallback to other APIs if needed
            throw new Error('All price APIs failed');

        } catch (error) {
            logger.warn('API price fetch failed, using fallback', 'AssetPriceService.fetchPriceFromAPI', {
                symbol,
                error
            });
            return this.createFallbackPriceData(symbol);
        }
    }

    /**
     * Fetch from CoinGecko API
     */
    private async fetchFromCoinGecko(symbol: string): Promise<PriceData | null> {
        try {
            const coinGeckoApiKey = environment.get('COINGECKO_API_KEY');
            const coinId = this.symbolToCoinGeckoId(symbol);
            
            if (!coinId) {
                return null;
            }

            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true`;
            
            const headers: HeadersInit = {
                'Accept': 'application/json',
            };

            if (coinGeckoApiKey) {
                headers['X-CG-Demo-API-Key'] = coinGeckoApiKey;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,

            });

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }

            const data = await response.json();
            const coinData = data[coinId];

            if (!coinData) {
                return null;
            }

            return {
                symbol,
                price: coinData.usd || 0,
                change24h: coinData.usd_24h_change || 0,
                change7d: coinData.usd_7d_change || 0,
                change30d: coinData.usd_30d_change || 0,
                lastUpdated: new Date()
            };

        } catch (error) {
            logger.warn('CoinGecko API failed', 'AssetPriceService.fetchFromCoinGecko', { symbol, error });
            return null;
        }
    }

    /**
     * Fetch historical prices from API
     */
    private async fetchHistoricalPricesFromAPI(symbol: string, days: number): Promise<HistoricalPrice[]> {
        try {
            const coinId = this.symbolToCoinGeckoId(symbol);
            if (!coinId) {
                return this.generateMockHistoricalData(symbol, days);
            }

            const coinGeckoApiKey = environment.get('COINGECKO_API_KEY');
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
            
            const headers: HeadersInit = {
                'Accept': 'application/json',
            };

            if (coinGeckoApiKey) {
                headers['X-CG-Demo-API-Key'] = coinGeckoApiKey;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,

            });

            if (!response.ok) {
                throw new Error(`CoinGecko historical API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.prices || !Array.isArray(data.prices)) {
                return this.generateMockHistoricalData(symbol, days);
            }

            return data.prices.map(([timestamp, price]: [number, number], index: number) => ({
                date: new Date(timestamp),
                price,
                volume: data.total_volumes?.[index]?.[1] || 0
            }));

        } catch (error) {
            logger.warn('Historical price API failed, using mock data', 'AssetPriceService.fetchHistoricalPricesFromAPI', {
                symbol,
                days,
                error
            });
            return this.generateMockHistoricalData(symbol, days);
        }
    }

    /**
     * Map symbol to CoinGecko coin ID
     */
    private symbolToCoinGeckoId(symbol: string): string | null {
        const mapping: { [key: string]: string } = {
            'ADA': 'cardano',
            'AGIX': 'singularitynet',
            'MIN': 'minswap',
            'SUNDAE': 'sundaeswap-finance',
            'COPI': 'cornucopias',
            'BOOK': 'booktoken'
        };

        return mapping[symbol.toUpperCase()] || null;
    }

    /**
     * Generate mock historical data for development
     */
    private generateMockHistoricalData(symbol: string, days: number): HistoricalPrice[] {
        const data: HistoricalPrice[] = [];
        const basePrice = this.getFallbackPrice(symbol);
        const now = new Date();

        for (let i = days; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const randomFactor = 0.9 + Math.random() * 0.2; // ±10% variance
            const price = basePrice * randomFactor;
            const volume = Math.random() * 1000000; // Random volume

            data.push({ date, price, volume });
        }

        return data;
    }

    /**
     * Create fallback price data when API fails
     */
    private createFallbackPriceData(symbol: string): PriceData {
        return {
            symbol,
            price: this.getFallbackPrice(symbol),
            change24h: Math.random() * 10 - 5, // -5% to +5%
            change7d: Math.random() * 20 - 10, // -10% to +10%
            change30d: Math.random() * 40 - 20, // -20% to +20%
            lastUpdated: new Date()
        };
    }

    /**
     * Get fallback price for asset
     */
    private getFallbackPrice(symbol: string): number {
        const fallbackPrices: { [key: string]: number } = {
            'ADA': 0.45,
            'AGIX': 0.25,
            'MIN': 0.15,
            'SUNDAE': 0.08,
            'COPI': 0.12,
            'BOOK': 0.05
        };

        return fallbackPrices[symbol.toUpperCase()] || 0.01;
    }

    /**
     * Load cached prices from storage
     */
    private async loadCachedPrices(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const priceKeys = keys.filter(key => key.startsWith('price_'));
            
            if (priceKeys.length > 0) {
                const items = await AsyncStorage.multiGet(priceKeys);
                
                for (const [key, value] of items) {
                    if (value) {
                        const symbol = key.replace('price_', '');
                        const priceData = JSON.parse(value);
                        priceData.lastUpdated = new Date(priceData.lastUpdated);
                        this.priceCache.set(symbol, priceData);
                    }
                }

                logger.debug('Loaded cached prices', 'AssetPriceService.loadCachedPrices', {
                    count: this.priceCache.size
                });
            }

        } catch (error) {
            logger.warn('Failed to load cached prices', 'AssetPriceService.loadCachedPrices', error);
        }
    }

    /**
     * Cache price data to storage
     */
    private async cachePriceData(symbol: string, priceData: PriceData): Promise<void> {
        try {
            await AsyncStorage.setItem(`price_${symbol}`, JSON.stringify(priceData));
        } catch (error) {
            logger.warn('Failed to cache price data', 'AssetPriceService.cachePriceData', { symbol, error });
        }
    }

    /**
     * Cache historical data to storage
     */
    private async cacheHistoricalData(cacheKey: string, historicalData: HistoricalPrice[]): Promise<void> {
        try {
            await AsyncStorage.setItem(`historical_${cacheKey}`, JSON.stringify(historicalData));
        } catch (error) {
            logger.warn('Failed to cache historical data', 'AssetPriceService.cacheHistoricalData', { cacheKey, error });
        }
    }
}

export default AssetPriceService;
