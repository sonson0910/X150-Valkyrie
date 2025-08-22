/**
 * Offline-first service for handling network state and data synchronization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { EventBus } from '../EventBus';
import logger from '../../utils/Logger';

export type NetworkStatus = 'online' | 'offline' | 'poor';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed';

export interface OfflineOperation {
    id: string;
    type: string;
    action: string;
    data: any;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
    priority: 'high' | 'medium' | 'low';
    dependencies?: string[];
}

export interface SyncResult {
    success: boolean;
    operationsProcessed: number;
    operationsFailed: number;
    errors: Array<{ operationId: string; error: string }>;
}

export class OfflineService {
    private static instance: OfflineService;
    private eventBus: EventBus;
    private networkStatus: NetworkStatus = 'offline';
    private syncStatus: SyncStatus = 'idle';
    private operationQueue: OfflineOperation[] = [];
    private syncInProgress = false;
    private maxQueueSize = 1000;
    private syncInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.initialize();
    }

    public static getInstance(): OfflineService {
        if (!OfflineService.instance) {
            OfflineService.instance = new OfflineService();
        }
        return OfflineService.instance;
    }

    /**
     * Initialize offline service
     */
    private async initialize(): Promise<void> {
        try {
            // Load queued operations from storage
            await this.loadOperationQueue();

            // Start network monitoring
            this.startNetworkMonitoring();

            // Start periodic sync
            this.startPeriodicSync();

            logger.info('Offline service initialized', 'OfflineService.initialize');
        } catch (error) {
            logger.error('Failed to initialize offline service', 'OfflineService.initialize', error);
        }
    }

    /**
     * Start monitoring network status
     */
    private startNetworkMonitoring(): void {
        NetInfo.addEventListener((state: NetInfoState) => {
            const previousStatus = this.networkStatus;
            this.networkStatus = this.determineNetworkStatus(state);

            if (previousStatus !== this.networkStatus) {
                logger.info('Network status changed', 'OfflineService.networkMonitoring', {
                    from: previousStatus,
                    to: this.networkStatus
                });

                // Emit network status change event
                this.eventBus.emit('offline:networkStatusChanged', {
                    previousStatus,
                    currentStatus: this.networkStatus,
                    isOnline: this.isOnline()
                });

                // Trigger sync if we're back online
                if (this.isOnline() && this.operationQueue.length > 0) {
                    this.triggerSync();
                }
            }
        });
    }

    /**
     * Start periodic sync when online
     */
    private startPeriodicSync(): void {
        this.syncInterval = setInterval(() => {
            if (this.isOnline() && this.operationQueue.length > 0 && !this.syncInProgress) {
                this.triggerSync();
            }
        }, 30000); // Sync every 30 seconds
    }

    /**
     * Determine network status from NetInfo state
     */
    private determineNetworkStatus(state: NetInfoState): NetworkStatus {
        if (!state.isConnected) {
            return 'offline';
        }

        if (state.isInternetReachable === false) {
            return 'offline';
        }

        // Check connection quality
        if (state.details && 'effectiveType' in state.details) {
            const effectiveType = (state.details as any).effectiveType;
            if (effectiveType === '2g' || effectiveType === 'slow-2g') {
                return 'poor';
            }
        }

        return 'online';
    }

    /**
     * Check if device is online
     */
    public isOnline(): boolean {
        return this.networkStatus === 'online' || this.networkStatus === 'poor';
    }

    /**
     * Get current network status
     */
    public getNetworkStatus(): NetworkStatus {
        return this.networkStatus;
    }

    /**
     * Get current sync status
     */
    public getSyncStatus(): SyncStatus {
        return this.syncStatus;
    }

    /**
     * Queue an operation for offline execution
     */
    public async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
        try {
            // Check queue size limit
            if (this.operationQueue.length >= this.maxQueueSize) {
                // Remove oldest low-priority operations
                this.operationQueue = this.operationQueue
                    .filter(op => op.priority !== 'low')
                    .slice(-(this.maxQueueSize - 1));
            }

            const queuedOperation: OfflineOperation = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                retryCount: 0,
                ...operation
            };

            // Insert operation based on priority
            this.insertOperationByPriority(queuedOperation);

            // Save to storage
            await this.saveOperationQueue();

            logger.debug('Operation queued', 'OfflineService.queueOperation', {
                operationId: queuedOperation.id,
                type: queuedOperation.type,
                priority: queuedOperation.priority
            });

            // Emit queued event
            this.eventBus.emit('offline:operationQueued', queuedOperation);

            // Try to sync immediately if online
            if (this.isOnline()) {
                this.triggerSync();
            }

            return queuedOperation.id;
        } catch (error) {
            logger.error('Failed to queue operation', 'OfflineService.queueOperation', error);
            throw error;
        }
    }

    /**
     * Insert operation into queue based on priority
     */
    private insertOperationByPriority(operation: OfflineOperation): void {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const insertIndex = this.operationQueue.findIndex(
            op => priorityOrder[op.priority] > priorityOrder[operation.priority]
        );

        if (insertIndex === -1) {
            this.operationQueue.push(operation);
        } else {
            this.operationQueue.splice(insertIndex, 0, operation);
        }
    }

    /**
     * Trigger synchronization
     */
    public async triggerSync(force: boolean = false): Promise<SyncResult> {
        if (this.syncInProgress && !force) {
            logger.debug('Sync already in progress, skipping', 'OfflineService.triggerSync');
            return {
                success: false,
                operationsProcessed: 0,
                operationsFailed: 0,
                errors: [{ operationId: 'system', error: 'Sync already in progress' }]
            };
        }

        if (!this.isOnline() && !force) {
            logger.debug('Device is offline, skipping sync', 'OfflineService.triggerSync');
            return {
                success: false,
                operationsProcessed: 0,
                operationsFailed: 0,
                errors: [{ operationId: 'system', error: 'Device is offline' }]
            };
        }

        this.syncInProgress = true;
        this.syncStatus = 'syncing';

        logger.info('Starting sync', 'OfflineService.triggerSync', {
            queueSize: this.operationQueue.length
        });

        const result: SyncResult = {
            success: true,
            operationsProcessed: 0,
            operationsFailed: 0,
            errors: []
        };

        try {
            // Emit sync start event
            this.eventBus.emit('offline:syncStarted', { queueSize: this.operationQueue.length });

            // Process operations in order, respecting dependencies
            const processedOperations: string[] = [];
            const operationsToProcess = [...this.operationQueue];

            for (const operation of operationsToProcess) {
                try {
                    // Check dependencies
                    if (operation.dependencies) {
                        const dependenciesMet = operation.dependencies.every(depId => 
                            processedOperations.includes(depId)
                        );
                        
                        if (!dependenciesMet) {
                            continue; // Skip for now
                        }
                    }

                    // Execute operation
                    await this.executeOperation(operation);
                    
                    // Remove from queue
                    this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
                    processedOperations.push(operation.id);
                    result.operationsProcessed++;

                    logger.debug('Operation executed successfully', 'OfflineService.triggerSync', {
                        operationId: operation.id,
                        type: operation.type
                    });

                } catch (error) {
                    operation.retryCount++;
                    result.operationsFailed++;
                    result.errors.push({
                        operationId: operation.id,
                        error: error.message
                    });

                    logger.error('Operation failed', 'OfflineService.triggerSync', {
                        operationId: operation.id,
                        retryCount: operation.retryCount,
                        maxRetries: operation.maxRetries,
                        error
                    });

                    // Remove if max retries exceeded
                    if (operation.retryCount >= operation.maxRetries) {
                        this.operationQueue = this.operationQueue.filter(op => op.id !== operation.id);
                        
                        // Emit failed operation event
                        this.eventBus.emit('offline:operationFailed', {
                            operation,
                            error: error.message
                        });
                    }
                }
            }

            // Save updated queue
            await this.saveOperationQueue();

            this.syncStatus = result.operationsFailed > 0 ? 'error' : 'completed';
            result.success = result.operationsFailed === 0;

        } catch (error) {
            this.syncStatus = 'error';
            result.success = false;
            result.errors.push({
                operationId: 'sync',
                error: error.message
            });

            logger.error('Sync failed', 'OfflineService.triggerSync', error);
        } finally {
            this.syncInProgress = false;
            
            // Emit sync completed event
            this.eventBus.emit('offline:syncCompleted', result);

            logger.info('Sync completed', 'OfflineService.triggerSync', result);
        }

        return result;
    }

    /**
     * Execute a queued operation
     */
    private async executeOperation(operation: OfflineOperation): Promise<void> {
        // Emit operation execution event
        this.eventBus.emit('offline:operationExecuting', operation);

        // This would be implemented by specific services
        // For now, we'll just emit an event for the operation type
        this.eventBus.emit(`offline:execute:${operation.type}`, operation);

        // Wait a bit to allow handlers to process
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Get pending operations count
     */
    public getPendingOperationsCount(): number {
        return this.operationQueue.length;
    }

    /**
     * Get pending operations
     */
    public getPendingOperations(): OfflineOperation[] {
        return [...this.operationQueue];
    }

    /**
     * Clear all pending operations
     */
    public async clearAllOperations(): Promise<void> {
        this.operationQueue = [];
        await this.saveOperationQueue();
        
        this.eventBus.emit('offline:queueCleared');
        logger.info('All pending operations cleared', 'OfflineService.clearAllOperations');
    }

    /**
     * Load operation queue from storage
     */
    private async loadOperationQueue(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem('offline_operation_queue');
            if (stored) {
                this.operationQueue = JSON.parse(stored);
                logger.debug('Loaded operation queue from storage', 'OfflineService.loadOperationQueue', {
                    count: this.operationQueue.length
                });
            }
        } catch (error) {
            logger.error('Failed to load operation queue', 'OfflineService.loadOperationQueue', error);
            this.operationQueue = [];
        }
    }

    /**
     * Save operation queue to storage
     */
    private async saveOperationQueue(): Promise<void> {
        try {
            await AsyncStorage.setItem('offline_operation_queue', JSON.stringify(this.operationQueue));
        } catch (error) {
            logger.error('Failed to save operation queue', 'OfflineService.saveOperationQueue', error);
        }
    }

    /**
     * Cleanup service
     */
    public destroy(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInProgress = false;
        this.operationQueue = [];
    }
}

export default OfflineService;

