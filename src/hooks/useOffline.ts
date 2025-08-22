/**
 * React hooks for offline functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { OfflineService, NetworkStatus, SyncStatus } from '../services/offline/OfflineService';
import { OfflineDataService, DataEntity } from '../services/offline/OfflineDataService';
import { EventBus } from '../services/EventBus';

export interface UseOfflineResult {
    isOnline: boolean;
    networkStatus: NetworkStatus;
    syncStatus: SyncStatus;
    pendingOperations: number;
    sync: () => Promise<void>;
    queueOperation: (operation: any) => Promise<string>;
}

export function useOffline(): UseOfflineResult {
    const [isOnline, setIsOnline] = useState(false);
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('offline');
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [pendingOperations, setPendingOperations] = useState(0);

    const offlineService = OfflineService.getInstance();
    const eventBus = EventBus.getInstance();

    useEffect(() => {
        // Initialize state
        setIsOnline(offlineService.isOnline());
        setNetworkStatus(offlineService.getNetworkStatus());
        setSyncStatus(offlineService.getSyncStatus());
        setPendingOperations(offlineService.getPendingOperationsCount());

        // Network status change handler
        const handleNetworkStatusChange = (event: any) => {
            setIsOnline(event.isOnline);
            setNetworkStatus(event.currentStatus);
        };

        // Sync status change handlers
        const handleSyncStarted = () => {
            setSyncStatus('syncing');
        };

        const handleSyncCompleted = (result: any) => {
            setSyncStatus(result.success ? 'completed' : 'error');
            setPendingOperations(offlineService.getPendingOperationsCount());
        };

        const handleOperationQueued = () => {
            setPendingOperations(offlineService.getPendingOperationsCount());
        };

        // Subscribe to events
        eventBus.on('offline:networkStatusChanged', handleNetworkStatusChange);
        eventBus.on('offline:syncStarted', handleSyncStarted);
        eventBus.on('offline:syncCompleted', handleSyncCompleted);
        eventBus.on('offline:operationQueued', handleOperationQueued);

        return () => {
            eventBus.off('offline:networkStatusChanged', handleNetworkStatusChange);
            eventBus.off('offline:syncStarted', handleSyncStarted);
            eventBus.off('offline:syncCompleted', handleSyncCompleted);
            eventBus.off('offline:operationQueued', handleOperationQueued);
        };
    }, []);

    const sync = useCallback(async () => {
        await offlineService.triggerSync();
    }, []);

    const queueOperation = useCallback(async (operation: any) => {
        return await offlineService.queueOperation(operation);
    }, []);

    return {
        isOnline,
        networkStatus,
        syncStatus,
        pendingOperations,
        sync,
        queueOperation
    };
}

export interface UseOfflineDataResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    save: (data: T) => Promise<void>;
    delete: () => Promise<void>;
    sync: () => Promise<void>;
    isSynced: boolean;
}

export function useOfflineData<T>(
    type: string, 
    id: string,
    initialData?: T
): UseOfflineDataResult<T> {
    const [data, setData] = useState<T | null>(initialData || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSynced, setIsSynced] = useState(false);

    const dataService = OfflineDataService.getInstance();

    useEffect(() => {
        loadData();
    }, [type, id]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const entity = await dataService.getEntity(type, id);
            if (entity) {
                setData(entity.data);
                setIsSynced(entity.syncStatus === 'synced');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const save = useCallback(async (newData: T) => {
        try {
            setError(null);
            await dataService.storeEntity(type, id, newData);
            setData(newData);
            setIsSynced(false);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [type, id]);

    const deleteData = useCallback(async () => {
        try {
            setError(null);
            await dataService.deleteEntity(type, id);
            setData(null);
            setIsSynced(false);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [type, id]);

    const sync = useCallback(async () => {
        try {
            setError(null);
            const entity = await dataService.getEntity(type, id);
            if (entity) {
                const success = await dataService.syncEntity(entity);
                setIsSynced(success);
            }
        } catch (err) {
            setError(err.message);
        }
    }, [type, id]);

    return {
        data,
        loading,
        error,
        save,
        delete: deleteData,
        sync,
        isSynced
    };
}

export interface UseOfflineListResult<T> {
    items: T[];
    loading: boolean;
    error: string | null;
    add: (item: T, id: string) => Promise<void>;
    update: (id: string, item: T) => Promise<void>;
    remove: (id: string) => Promise<void>;
    syncAll: () => Promise<void>;
    pendingSyncCount: number;
}

export function useOfflineList<T>(type: string): UseOfflineListResult<T> {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    const dataService = OfflineDataService.getInstance();

    useEffect(() => {
        loadItems();
    }, [type]);

    const loadItems = async () => {
        try {
            setLoading(true);
            setError(null);

            const entities = await dataService.getEntitiesByType(type);
            setItems(entities.map(entity => entity.data));
            
            const pendingCount = entities.filter(entity => entity.syncStatus === 'pending').length;
            setPendingSyncCount(pendingCount);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const add = useCallback(async (item: T, id: string) => {
        try {
            setError(null);
            await dataService.storeEntity(type, id, item);
            await loadItems(); // Reload to get updated list
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [type]);

    const update = useCallback(async (id: string, item: T) => {
        try {
            setError(null);
            await dataService.storeEntity(type, id, item);
            await loadItems(); // Reload to get updated list
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [type]);

    const remove = useCallback(async (id: string) => {
        try {
            setError(null);
            await dataService.deleteEntity(type, id);
            await loadItems(); // Reload to get updated list
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [type]);

    const syncAll = useCallback(async () => {
        try {
            setError(null);
            const entities = await dataService.getEntitiesByType(type);
            const pendingEntities = entities.filter(entity => entity.syncStatus === 'pending');
            
            for (const entity of pendingEntities) {
                await dataService.syncEntity(entity);
            }
            
            await loadItems(); // Reload to get updated sync status
        } catch (err) {
            setError(err.message);
        }
    }, [type]);

    return {
        items,
        loading,
        error,
        add,
        update,
        remove,
        syncAll,
        pendingSyncCount
    };
}

export default useOffline;

