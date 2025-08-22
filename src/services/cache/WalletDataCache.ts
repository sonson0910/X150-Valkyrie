/**
 * Wallet Data Cache Service
 * 
 * Features:
 * - Transaction history caching
 * - Balance and UTXO caching
 * - Account state management
 * - Offline data availability
 * - Smart invalidation on new transactions
 * - Background sync with blockchain
 */

import { intelligentCache, CacheStrategy, CachePriority, CacheOptions } from '../../utils/IntelligentCache';
import logger from '../../utils/Logger';
import { Transaction, WalletAccount, TransactionStatus } from '../../types/wallet';

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface WalletCacheEntry<T = any> {
    address: string;
    data: T;
    lastUpdated: number;
    blockHeight?: number;
    syncStatus: 'synced' | 'syncing' | 'stale' | 'error';
}

export interface TransactionCacheData {
    transactions: Transaction[];
    totalCount: number;
    lastSyncHeight: number;
    lastSyncTime: number;
    pendingTransactions: Transaction[];
}

export interface BalanceCacheData {
    confirmed: string;
    unconfirmed: string;
    available: string;
    staking: string;
    rewards: string;
    assets: Array<{
        unit: string;
        quantity: string;
        metadata?: any;
    }>;
    lastSyncHeight: number;
}

export interface UtxoCacheData {
    utxos: Array<{
        tx_hash: string;
        tx_index: number;
        amount: Array<{
            unit: string;
            quantity: string;
        }>;
        address: string;
        block: string;
        data_hash?: string;
    }>;
    totalCount: number;
    totalValue: string;
    lastSyncHeight: number;
}

export interface StakingCacheData {
    active: boolean;
    poolId?: string;
    rewards: string;
    lifecycle: {
        epoch: number;
        slot: number;
    };
    history: Array<{
        epoch: number;
        rewards: string;
        poolId: string;
    }>;
}

// =========================================================================
// CACHE CONFIGURATIONS
// =========================================================================

const WALLET_CACHE_CONFIGS = {
    TRANSACTION_HISTORY: {
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['wallet', 'transactions'],
        syncInBackground: true
    },
    
    ACCOUNT_BALANCE: {
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: CachePriority.CRITICAL,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['wallet', 'balance'],
        syncInBackground: true
    },
    
    UTXO_SET: {
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: CachePriority.HIGH,
        strategy: CacheStrategy.CACHE_THEN_NETWORK,
        tags: ['wallet', 'utxos'],
        syncInBackground: true
    },
    
    STAKING_INFO: {
        ttl: 10 * 60 * 1000, // 10 minutes
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['wallet', 'staking'],
        syncInBackground: true
    },
    
    ACCOUNT_STATE: {
        ttl: 60 * 60 * 1000, // 1 hour
        priority: CachePriority.MEDIUM,
        strategy: CacheStrategy.CACHE_FIRST,
        tags: ['wallet', 'account']
    }
} as const;

// =========================================================================
// WALLET DATA CACHE SERVICE
// =========================================================================

export class WalletDataCacheService {
    private static instance: WalletDataCacheService;
    
    // Background sync management
    private syncInterval: NodeJS.Timeout | null = null;
    private activeSyncs = new Set<string>();
    private syncQueue = new Map<string, { address: string; dataType: string; lastAttempt: number }>();
    
    // Event listeners for real-time updates
    private eventListeners = new Map<string, Array<(data: any) => void>>();
    
    private constructor() {
        this.initializeService();
    }
    
    public static getInstance(): WalletDataCacheService {
        if (!WalletDataCacheService.instance) {
            WalletDataCacheService.instance = new WalletDataCacheService();
        }
        return WalletDataCacheService.instance;
    }
    
    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    
    private async initializeService(): Promise<void> {
        try {
            // Start background sync
            this.startBackgroundSync();
            
            // Setup event listeners
            this.setupEventListeners();
            
            logger.info('Wallet data cache service initialized', 'WalletDataCacheService.initializeService');
            
        } catch (error) {
            logger.error('Failed to initialize wallet data cache', 'WalletDataCacheService.initializeService', error);
        }
    }
    
    private startBackgroundSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Sync every 60 seconds
        this.syncInterval = setInterval(() => {
            this.performBackgroundSync();
        }, 60000);
    }
    
    private setupEventListeners(): void {
        // Listen for transaction events to invalidate relevant caches
        // This would integrate with your blockchain monitoring service
    }
    
    // =========================================================================
    // TRANSACTION CACHE METHODS
    // =========================================================================
    
    /**
     * Get cached transaction history
     */
    async getTransactionHistory(
        address: string,
        options: { limit?: number; offset?: number; includeOffline?: boolean } = {}
    ): Promise<WalletCacheEntry<TransactionCacheData>> {
        const { limit = 50, offset = 0, includeOffline = true } = options;
        const cacheKey = `tx_history_${address}_${limit}_${offset}`;
        
        try {
            const fetchFunction = async (): Promise<WalletCacheEntry<TransactionCacheData>> => {
                return await this.fetchTransactionHistory(address, options);
            };
            
            const cached = await intelligentCache.get<WalletCacheEntry<TransactionCacheData>>(
                cacheKey,
                fetchFunction,
                WALLET_CACHE_CONFIGS.TRANSACTION_HISTORY
            );
            
            if (cached) {
                return cached;
            }
            
            // Fallback to fresh fetch
            return await this.fetchTransactionHistory(address, options);
            
        } catch (error) {
            logger.error('Failed to get transaction history', 'WalletDataCacheService.getTransactionHistory', {
                address,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Add new transaction to cache
     */
    async addTransaction(address: string, transaction: Transaction): Promise<void> {
        try {
            // Get current cached data
            const cacheKey = `tx_history_${address}_50_0`; // Default key
            const cached = await intelligentCache.get<WalletCacheEntry<TransactionCacheData>>(cacheKey);
            
            if (cached) {
                // Add transaction to the beginning of the list
                const updatedData = { ...cached };
                updatedData.data.transactions.unshift(transaction);
                updatedData.data.totalCount++;
                updatedData.lastUpdated = Date.now();
                updatedData.syncStatus = 'synced';
                
                // Update cache
                await intelligentCache.set(cacheKey, updatedData, WALLET_CACHE_CONFIGS.TRANSACTION_HISTORY);
                
                // Invalidate balance and UTXO caches since they might be affected
                await this.invalidateAccountData(address);
                
                // Notify listeners
                this.notifyListeners(`tx_${address}`, updatedData);
            }
            
            logger.debug('Transaction added to cache', 'WalletDataCacheService.addTransaction', {
                address,
                txId: transaction.id
            });
            
        } catch (error) {
            logger.error('Failed to add transaction to cache', 'WalletDataCacheService.addTransaction', error);
        }
    }
    
    /**
     * Update transaction status in cache
     */
    async updateTransactionStatus(
        address: string,
        txId: string,
        status: TransactionStatus,
        blockHeight?: number
    ): Promise<void> {
        try {
            // Find and update in all relevant cache entries
            const pattern = new RegExp(`tx_history_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`);
            const cacheEntries = await this.getCacheEntriesByPattern(pattern);
            
            for (const [key, entry] of cacheEntries) {
                const transaction = entry.data.transactions.find((tx: Transaction) => tx.id === txId);
                if (transaction) {
                    transaction.status = status;
                    if (blockHeight) {
                        transaction.metadata = {
                            ...transaction.metadata,
                            blockHeight
                        };
                    }
                    
                    entry.lastUpdated = Date.now();
                    entry.syncStatus = 'synced';
                    
                    await intelligentCache.set(key, entry, WALLET_CACHE_CONFIGS.TRANSACTION_HISTORY);
                }
            }
            
            logger.debug('Transaction status updated in cache', 'WalletDataCacheService.updateTransactionStatus', {
                address,
                txId,
                status
            });
            
        } catch (error) {
            logger.error('Failed to update transaction status', 'WalletDataCacheService.updateTransactionStatus', error);
        }
    }
    
    // =========================================================================
    // BALANCE CACHE METHODS
    // =========================================================================
    
    /**
     * Get cached account balance
     */
    async getAccountBalance(address: string): Promise<WalletCacheEntry<BalanceCacheData>> {
        const cacheKey = `balance_${address}`;
        
        try {
            const fetchFunction = async (): Promise<WalletCacheEntry<BalanceCacheData>> => {
                return await this.fetchAccountBalance(address);
            };
            
            const cached = await intelligentCache.get<WalletCacheEntry<BalanceCacheData>>(
                cacheKey,
                fetchFunction,
                WALLET_CACHE_CONFIGS.ACCOUNT_BALANCE
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchAccountBalance(address);
            
        } catch (error) {
            logger.error('Failed to get account balance', 'WalletDataCacheService.getAccountBalance', {
                address,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Update account balance in cache
     */
    async updateAccountBalance(address: string, balanceData: Partial<BalanceCacheData>): Promise<void> {
        const cacheKey = `balance_${address}`;
        
        try {
            const existing = await intelligentCache.get<WalletCacheEntry<BalanceCacheData>>(cacheKey);
            
            const updatedEntry: WalletCacheEntry<BalanceCacheData> = {
                address,
                data: existing ? { ...existing.data, ...balanceData } : balanceData as BalanceCacheData,
                lastUpdated: Date.now(),
                syncStatus: 'synced'
            };
            
            await intelligentCache.set(cacheKey, updatedEntry, WALLET_CACHE_CONFIGS.ACCOUNT_BALANCE);
            
            // Notify listeners
            this.notifyListeners(`balance_${address}`, updatedEntry);
            
            logger.debug('Account balance updated in cache', 'WalletDataCacheService.updateAccountBalance', {
                address
            });
            
        } catch (error) {
            logger.error('Failed to update account balance', 'WalletDataCacheService.updateAccountBalance', error);
        }
    }
    
    // =========================================================================
    // UTXO CACHE METHODS
    // =========================================================================
    
    /**
     * Get cached UTXOs
     */
    async getAccountUtxos(address: string): Promise<WalletCacheEntry<UtxoCacheData>> {
        const cacheKey = `utxos_${address}`;
        
        try {
            const fetchFunction = async (): Promise<WalletCacheEntry<UtxoCacheData>> => {
                return await this.fetchAccountUtxos(address);
            };
            
            const cached = await intelligentCache.get<WalletCacheEntry<UtxoCacheData>>(
                cacheKey,
                fetchFunction,
                WALLET_CACHE_CONFIGS.UTXO_SET
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchAccountUtxos(address);
            
        } catch (error) {
            logger.error('Failed to get account UTXOs', 'WalletDataCacheService.getAccountUtxos', {
                address,
                error: error.message
            });
            throw error;
        }
    }
    
    // =========================================================================
    // STAKING CACHE METHODS
    // =========================================================================
    
    /**
     * Get cached staking information
     */
    async getStakingInfo(address: string): Promise<WalletCacheEntry<StakingCacheData>> {
        const cacheKey = `staking_${address}`;
        
        try {
            const fetchFunction = async (): Promise<WalletCacheEntry<StakingCacheData>> => {
                return await this.fetchStakingInfo(address);
            };
            
            const cached = await intelligentCache.get<WalletCacheEntry<StakingCacheData>>(
                cacheKey,
                fetchFunction,
                WALLET_CACHE_CONFIGS.STAKING_INFO
            );
            
            if (cached) {
                return cached;
            }
            
            return await this.fetchStakingInfo(address);
            
        } catch (error) {
            logger.error('Failed to get staking info', 'WalletDataCacheService.getStakingInfo', {
                address,
                error: error.message
            });
            throw error;
        }
    }
    
    // =========================================================================
    // CACHE INVALIDATION METHODS
    // =========================================================================
    
    /**
     * Invalidate all data for an address
     */
    async invalidateAccountData(address: string): Promise<void> {
        try {
            const patterns = [
                new RegExp(`tx_history_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`),
                new RegExp(`balance_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                new RegExp(`utxos_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                new RegExp(`staking_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
            ];
            
            for (const pattern of patterns) {
                await intelligentCache.invalidate(pattern);
            }
            
            logger.debug('Account data invalidated', 'WalletDataCacheService.invalidateAccountData', {
                address
            });
            
        } catch (error) {
            logger.error('Failed to invalidate account data', 'WalletDataCacheService.invalidateAccountData', error);
        }
    }
    
    /**
     * Invalidate transaction data only
     */
    async invalidateTransactionData(address: string): Promise<void> {
        await intelligentCache.invalidate(/tx_history_/, ['wallet', 'transactions']);
    }
    
    /**
     * Invalidate balance and UTXO data
     */
    async invalidateBalanceData(address: string): Promise<void> {
        const patterns = [
            new RegExp(`balance_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
            new RegExp(`utxos_${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        ];
        
        for (const pattern of patterns) {
            await intelligentCache.invalidate(pattern);
        }
    }
    
    // =========================================================================
    // EVENT MANAGEMENT
    // =========================================================================
    
    /**
     * Subscribe to cache updates
     */
    subscribe(eventKey: string, callback: (data: any) => void): () => void {
        if (!this.eventListeners.has(eventKey)) {
            this.eventListeners.set(eventKey, []);
        }
        
        this.eventListeners.get(eventKey)!.push(callback);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(eventKey);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    
    private notifyListeners(eventKey: string, data: any): void {
        const listeners = this.eventListeners.get(eventKey);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error('Event listener error', 'WalletDataCacheService.notifyListeners', error);
                }
            });
        }
    }
    
    // =========================================================================
    // BACKGROUND SYNC
    // =========================================================================
    
    private async performBackgroundSync(): Promise<void> {
        try {
            // Process sync queue
            const syncPromises = Array.from(this.syncQueue.entries()).map(async ([key, syncItem]) => {
                if (this.activeSyncs.has(key)) return;
                
                // Don't retry too frequently
                if (Date.now() - syncItem.lastAttempt < 30000) return;
                
                this.activeSyncs.add(key);
                syncItem.lastAttempt = Date.now();
                
                try {
                    await this.syncAddressData(syncItem.address, syncItem.dataType);
                    this.syncQueue.delete(key);
                } catch (error) {
                    logger.warn('Background sync failed', 'WalletDataCacheService.performBackgroundSync', {
                        address: syncItem.address,
                        dataType: syncItem.dataType,
                        error: error.message
                    });
                } finally {
                    this.activeSyncs.delete(key);
                }
            });
            
            await Promise.allSettled(syncPromises);
            
        } catch (error) {
            logger.error('Background sync error', 'WalletDataCacheService.performBackgroundSync', error);
        }
    }
    
    private async syncAddressData(address: string, dataType: string): Promise<void> {
        switch (dataType) {
            case 'transactions':
                await this.fetchTransactionHistory(address, {});
                break;
            case 'balance':
                await this.fetchAccountBalance(address);
                break;
            case 'utxos':
                await this.fetchAccountUtxos(address);
                break;
            case 'staking':
                await this.fetchStakingInfo(address);
                break;
        }
    }
    
    // =========================================================================
    // FETCH METHODS (MOCK IMPLEMENTATIONS)
    // =========================================================================
    
    private async fetchTransactionHistory(
        address: string,
        options: { limit?: number; offset?: number; includeOffline?: boolean }
    ): Promise<WalletCacheEntry<TransactionCacheData>> {
        // Mock implementation - replace with actual API calls
        logger.debug('Fetching transaction history from network', 'WalletDataCacheService.fetchTransactionHistory', {
            address,
            options
        });
        
        return {
            address,
            data: {
                transactions: [],
                totalCount: 0,
                lastSyncHeight: 0,
                lastSyncTime: Date.now(),
                pendingTransactions: []
            },
            lastUpdated: Date.now(),
            syncStatus: 'synced'
        };
    }
    
    private async fetchAccountBalance(address: string): Promise<WalletCacheEntry<BalanceCacheData>> {
        // Mock implementation
        logger.debug('Fetching account balance from network', 'WalletDataCacheService.fetchAccountBalance', {
            address
        });
        
        return {
            address,
            data: {
                confirmed: '0',
                unconfirmed: '0',
                available: '0',
                staking: '0',
                rewards: '0',
                assets: [],
                lastSyncHeight: 0
            },
            lastUpdated: Date.now(),
            syncStatus: 'synced'
        };
    }
    
    private async fetchAccountUtxos(address: string): Promise<WalletCacheEntry<UtxoCacheData>> {
        // Mock implementation
        logger.debug('Fetching account UTXOs from network', 'WalletDataCacheService.fetchAccountUtxos', {
            address
        });
        
        return {
            address,
            data: {
                utxos: [],
                totalCount: 0,
                totalValue: '0',
                lastSyncHeight: 0
            },
            lastUpdated: Date.now(),
            syncStatus: 'synced'
        };
    }
    
    private async fetchStakingInfo(address: string): Promise<WalletCacheEntry<StakingCacheData>> {
        // Mock implementation
        logger.debug('Fetching staking info from network', 'WalletDataCacheService.fetchStakingInfo', {
            address
        });
        
        return {
            address,
            data: {
                active: false,
                rewards: '0',
                lifecycle: {
                    epoch: 0,
                    slot: 0
                },
                history: []
            },
            lastUpdated: Date.now(),
            syncStatus: 'synced'
        };
    }
    
    // =========================================================================
    // UTILITY METHODS
    // =========================================================================
    
    private async getCacheEntriesByPattern(pattern: RegExp): Promise<Array<[string, any]>> {
        // This would need to be implemented in the intelligent cache
        // For now, return empty array
        return [];
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const baseStats = intelligentCache.getStats();
        return {
            ...baseStats,
            activeSyncs: this.activeSyncs.size,
            syncQueueSize: this.syncQueue.size,
            eventListeners: this.eventListeners.size
        };
    }
    
    /**
     * Clear all wallet caches
     */
    async clearCache(): Promise<void> {
        await intelligentCache.invalidate(/^(tx_history_|balance_|utxos_|staking_)/);
        this.syncQueue.clear();
        
        logger.info('Wallet data cache cleared', 'WalletDataCacheService.clearCache');
    }
    
    /**
     * Shutdown service
     */
    async shutdown(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.eventListeners.clear();
        this.syncQueue.clear();
        this.activeSyncs.clear();
        
        logger.info('Wallet data cache service shut down', 'WalletDataCacheService.shutdown');
    }
}

// =========================================================================
// SINGLETON EXPORT
// =========================================================================

export const walletDataCache = WalletDataCacheService.getInstance();
export default walletDataCache;

