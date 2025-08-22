/**
 * Offline data storage and synchronization service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineService } from './OfflineService';
import logger from '../../utils/Logger';
import { EventBus } from '../EventBus';

export interface DataEntity {
    id: string;
    type: string;
    data: any;
    lastModified: number;
    version: number;
    syncStatus: 'pending' | 'synced' | 'conflict';
    hash?: string;
}

export interface ConflictResolution {
    strategy: 'local' | 'remote' | 'merge' | 'manual';
    data?: any;
}

export interface SyncStrategy {
    syncOnStart: boolean;
    syncInterval: number;
    maxRetries: number;
    conflictResolution: 'local' | 'remote' | 'merge' | 'manual';
    priority: 'high' | 'medium' | 'low';
}

export class OfflineDataService {
    private static instance: OfflineDataService;
    private offlineService: OfflineService;
    private eventBus: EventBus;
    private storagePrefix = 'offline_data_';
    private entityCache: Map<string, DataEntity> = new Map();

    private constructor() {
        this.offlineService = OfflineService.getInstance();
        this.eventBus = EventBus.getInstance();
        this.initialize();
    }

    public static getInstance(): OfflineDataService {
        if (!OfflineDataService.instance) {
            OfflineDataService.instance = new OfflineDataService();
        }
        return OfflineDataService.instance;
    }

    /**
     * Initialize the data service
     */
    private async initialize(): Promise<void> {
        try {
            // Load cached entities
            await this.loadEntityCache();

            // Subscribe to offline events
            this.setupEventHandlers();

            logger.info('Offline data service initialized', 'OfflineDataService.initialize');
        } catch (error) {
            logger.error('Failed to initialize offline data service', 'OfflineDataService.initialize', error);
        }
    }

    /**
     * Setup event handlers for offline operations
     */
    private setupEventHandlers(): void {
        // Handle wallet data operations
        this.eventBus.on('offline:execute:wallet', this.handleWalletOperation.bind(this));
        this.eventBus.on('offline:execute:transaction', this.handleTransactionOperation.bind(this));
        this.eventBus.on('offline:execute:account', this.handleAccountOperation.bind(this));
    }

    /**
     * Store data entity locally
     */
    public async storeEntity(
        type: string, 
        id: string, 
        data: any, 
        syncStrategy: Partial<SyncStrategy> = {}
    ): Promise<void> {
        try {
            const entity: DataEntity = {
                id,
                type,
                data,
                lastModified: Date.now(),
                version: 1,
                syncStatus: 'pending',
                hash: this.generateHash(data)
            };

            // Check if entity exists
            const existingEntity = await this.getEntity(type, id);
            if (existingEntity) {
                entity.version = existingEntity.version + 1;
            }

            // Store in cache
            const cacheKey = `${type}:${id}`;
            this.entityCache.set(cacheKey, entity);

            // Store in AsyncStorage
            const storageKey = `${this.storagePrefix}${type}_${id}`;
            await AsyncStorage.setItem(storageKey, JSON.stringify(entity));

            // Queue for sync if online sync is enabled
            if (this.offlineService.isOnline() || syncStrategy.syncOnStart !== false) {
                await this.queueSyncOperation(entity, syncStrategy);
            }

            logger.debug('Entity stored', 'OfflineDataService.storeEntity', {
                type,
                id,
                version: entity.version
            });

        } catch (error) {
            logger.error('Failed to store entity', 'OfflineDataService.storeEntity', {
                type,
                id,
                error
            });
            throw error;
        }
    }

    /**
     * Get data entity
     */
    public async getEntity(type: string, id: string): Promise<DataEntity | null> {
        try {
            const cacheKey = `${type}:${id}`;
            
            // Check cache first
            if (this.entityCache.has(cacheKey)) {
                return this.entityCache.get(cacheKey)!;
            }

            // Load from storage
            const storageKey = `${this.storagePrefix}${type}_${id}`;
            const stored = await AsyncStorage.getItem(storageKey);
            
            if (stored) {
                const entity: DataEntity = JSON.parse(stored);
                this.entityCache.set(cacheKey, entity);
                return entity;
            }

            return null;
        } catch (error) {
            logger.error('Failed to get entity', 'OfflineDataService.getEntity', {
                type,
                id,
                error
            });
            return null;
        }
    }

    /**
     * Get all entities of a type
     */
    public async getEntitiesByType(type: string): Promise<DataEntity[]> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const typeKeys = allKeys.filter(key => key.startsWith(`${this.storagePrefix}${type}_`));
            
            const entities: DataEntity[] = [];
            
            for (const key of typeKeys) {
                const stored = await AsyncStorage.getItem(key);
                if (stored) {
                    entities.push(JSON.parse(stored));
                }
            }

            return entities.sort((a, b) => b.lastModified - a.lastModified);
        } catch (error) {
            logger.error('Failed to get entities by type', 'OfflineDataService.getEntitiesByType', {
                type,
                error
            });
            return [];
        }
    }

    /**
     * Delete entity
     */
    public async deleteEntity(type: string, id: string): Promise<void> {
        try {
            const cacheKey = `${type}:${id}`;
            const storageKey = `${this.storagePrefix}${type}_${id}`;

            // Remove from cache
            this.entityCache.delete(cacheKey);

            // Remove from storage
            await AsyncStorage.removeItem(storageKey);

            // Queue deletion operation
            await this.offlineService.queueOperation({
                type: 'delete',
                action: `delete_${type}`,
                data: { type, id },
                maxRetries: 3,
                priority: 'medium'
            });

            logger.debug('Entity deleted', 'OfflineDataService.deleteEntity', { type, id });
        } catch (error) {
            logger.error('Failed to delete entity', 'OfflineDataService.deleteEntity', {
                type,
                id,
                error
            });
            throw error;
        }
    }

    /**
     * Sync entity with remote
     */
    public async syncEntity(entity: DataEntity): Promise<boolean> {
        try {
            // Emit sync event for specific handlers
            const syncEvent = `offline:sync:${entity.type}`;
            const result = await new Promise<boolean>((resolve) => {
                let handled = false;
                
                const handler = (response: { success: boolean }) => {
                    handled = true;
                    resolve(response.success);
                };

                this.eventBus.once(`${syncEvent}:response`, handler);
                this.eventBus.emit(syncEvent, entity);

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!handled) {
                        this.eventBus.off(`${syncEvent}:response`, handler);
                        resolve(false);
                    }
                }, 10000);
            });

            if (result) {
                entity.syncStatus = 'synced';
                await this.updateEntity(entity);
            }

            return result;
        } catch (error) {
            logger.error('Failed to sync entity', 'OfflineDataService.syncEntity', {
                entityId: entity.id,
                type: entity.type,
                error
            });
            return false;
        }
    }

    /**
     * Handle conflict resolution
     */
    public async resolveConflict(
        localEntity: DataEntity,
        remoteEntity: DataEntity,
        resolution: ConflictResolution
    ): Promise<DataEntity> {
        try {
            let resolvedEntity: DataEntity;

            switch (resolution.strategy) {
                case 'local':
                    resolvedEntity = localEntity;
                    break;
                
                case 'remote':
                    resolvedEntity = {
                        ...remoteEntity,
                        id: localEntity.id,
                        lastModified: Date.now()
                    };
                    break;
                
                case 'merge':
                    resolvedEntity = {
                        ...localEntity,
                        data: { ...localEntity.data, ...remoteEntity.data },
                        version: Math.max(localEntity.version, remoteEntity.version) + 1,
                        lastModified: Date.now()
                    };
                    break;
                
                case 'manual':
                    if (!resolution.data) {
                        throw new Error('Manual resolution requires data');
                    }
                    resolvedEntity = {
                        ...localEntity,
                        data: resolution.data,
                        version: localEntity.version + 1,
                        lastModified: Date.now()
                    };
                    break;
            }

            resolvedEntity.syncStatus = 'pending';
            resolvedEntity.hash = this.generateHash(resolvedEntity.data);

            await this.updateEntity(resolvedEntity);

            logger.info('Conflict resolved', 'OfflineDataService.resolveConflict', {
                entityId: localEntity.id,
                strategy: resolution.strategy
            });

            return resolvedEntity;
        } catch (error) {
            logger.error('Failed to resolve conflict', 'OfflineDataService.resolveConflict', {
                entityId: localEntity.id,
                error
            });
            throw error;
        }
    }

    /**
     * Get pending sync entities
     */
    public async getPendingSyncEntities(): Promise<DataEntity[]> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const dataKeys = allKeys.filter(key => key.startsWith(this.storagePrefix));
            
            const pendingEntities: DataEntity[] = [];
            
            for (const key of dataKeys) {
                const stored = await AsyncStorage.getItem(key);
                if (stored) {
                    const entity: DataEntity = JSON.parse(stored);
                    if (entity.syncStatus === 'pending') {
                        pendingEntities.push(entity);
                    }
                }
            }

            return pendingEntities.sort((a, b) => a.lastModified - b.lastModified);
        } catch (error) {
            logger.error('Failed to get pending sync entities', 'OfflineDataService.getPendingSyncEntities', error);
            return [];
        }
    }

    /**
     * Clear all offline data
     */
    public async clearAllData(): Promise<void> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const dataKeys = allKeys.filter(key => key.startsWith(this.storagePrefix));
            
            await AsyncStorage.multiRemove(dataKeys);
            this.entityCache.clear();

            logger.info('All offline data cleared', 'OfflineDataService.clearAllData');
        } catch (error) {
            logger.error('Failed to clear offline data', 'OfflineDataService.clearAllData', error);
            throw error;
        }
    }

    /**
     * Private helper methods
     */

    private async updateEntity(entity: DataEntity): Promise<void> {
        const cacheKey = `${entity.type}:${entity.id}`;
        const storageKey = `${this.storagePrefix}${entity.type}_${entity.id}`;

        this.entityCache.set(cacheKey, entity);
        await AsyncStorage.setItem(storageKey, JSON.stringify(entity));
    }

    private async loadEntityCache(): Promise<void> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const dataKeys = allKeys.filter(key => key.startsWith(this.storagePrefix));
            
            for (const key of dataKeys) {
                const stored = await AsyncStorage.getItem(key);
                if (stored) {
                    const entity: DataEntity = JSON.parse(stored);
                    const cacheKey = `${entity.type}:${entity.id}`;
                    this.entityCache.set(cacheKey, entity);
                }
            }

            logger.debug('Entity cache loaded', 'OfflineDataService.loadEntityCache', {
                count: this.entityCache.size
            });
        } catch (error) {
            logger.error('Failed to load entity cache', 'OfflineDataService.loadEntityCache', error);
        }
    }

    private async queueSyncOperation(entity: DataEntity, strategy: Partial<SyncStrategy>): Promise<void> {
        await this.offlineService.queueOperation({
            type: 'sync',
            action: `sync_${entity.type}`,
            data: entity,
            maxRetries: strategy.maxRetries || 3,
            priority: strategy.priority || 'medium'
        });
    }

    private generateHash(data: any): string {
        // Simple hash function for data integrity
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    // Operation handlers
    private async handleWalletOperation(operation: any): Promise<void> {
        logger.debug('Handling wallet operation', 'OfflineDataService.handleWalletOperation', operation);
        // Implement wallet-specific sync logic
    }

    private async handleTransactionOperation(operation: any): Promise<void> {
        logger.debug('Handling transaction operation', 'OfflineDataService.handleTransactionOperation', operation);
        // Implement transaction-specific sync logic
    }

    private async handleAccountOperation(operation: any): Promise<void> {
        logger.debug('Handling account operation', 'OfflineDataService.handleAccountOperation', operation);
        // Implement account-specific sync logic
    }
}

export default OfflineDataService;

