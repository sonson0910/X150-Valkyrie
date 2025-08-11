type EventCallback = (...args: any[]) => void;

interface EventMap {
    'show-toast': { message: string; type: 'success' | 'error' | 'warning' | 'info' };
    'network-status-changed': { isOnline: boolean; type: string };
    'transaction-updated': { transactionId: string; status: string };
    'wallet-locked': { reason: string };
    'wallet-unlocked': { method: string };
    'biometric-auth': { success: boolean; type: string };
}

export class EventBus {
    private static instance: EventBus;
    private listeners: Map<keyof EventMap, EventCallback[]> = new Map();

    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Subscribe to an event
     */
    on<K extends keyof EventMap>(event: K, callback: (data: EventMap[K]) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const eventListeners = this.listeners.get(event)!;
        eventListeners.push(callback);

        // Return unsubscribe function
        return () => {
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        };
    }

    /**
     * Emit an event
     */
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Unsubscribe from an event
     */
    off<K extends keyof EventMap>(event: K, callback: EventCallback): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    /**
     * Clear all listeners for an event
     */
    clear<K extends keyof EventMap>(event: K): void {
        this.listeners.delete(event);
    }

    /**
     * Clear all listeners
     */
    clearAll(): void {
        this.listeners.clear();
    }

    /**
     * Get listener count for an event
     */
    getListenerCount<K extends keyof EventMap>(event: K): number {
        const eventListeners = this.listeners.get(event);
        return eventListeners ? eventListeners.length : 0;
    }

    /**
     * Check if event has listeners
     */
    hasListeners<K extends keyof EventMap>(event: K): boolean {
        return this.getListenerCount(event) > 0;
    }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();
