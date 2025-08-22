/**
 * MemoryOptimizer - React memory optimization utilities and hooks
 * 
 * Provides hooks and utilities to prevent memory leaks and optimize
 * React component performance and memory usage.
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import logger from './Logger';

// =========================================================================
// MEMORY TRACKING
// =========================================================================

interface ComponentMemoryInfo {
    componentName: string;
    mountTime: number;
    unmountTime?: number;
    memoryUsage?: {
        before: number;
        after: number;
    };
    activeEffects: Set<string>;
    activeTimers: Set<NodeJS.Timeout>;
    activeSubscriptions: Set<() => void>;
}

// Global memory tracking
const componentMemoryMap = new Map<string, ComponentMemoryInfo>();
let memoryTrackingEnabled = __DEV__;

/**
 * Enable/disable memory tracking (useful for production)
 */
export const setMemoryTracking = (enabled: boolean): void => {
    memoryTrackingEnabled = enabled;
};

/**
 * Get memory usage statistics
 */
export const getMemoryStats = () => {
    const activeComponents = Array.from(componentMemoryMap.values())
        .filter(info => !info.unmountTime);
    
    const totalComponents = componentMemoryMap.size;
    const activeCount = activeComponents.length;
    const unmountedCount = totalComponents - activeCount;
    
    let totalActiveEffects = 0;
    let totalActiveTimers = 0;
    let totalActiveSubscriptions = 0;
    
    activeComponents.forEach(info => {
        totalActiveEffects += info.activeEffects.size;
        totalActiveTimers += info.activeTimers.size;
        totalActiveSubscriptions += info.activeSubscriptions.size;
    });
    
    return {
        totalComponents,
        activeComponents: activeCount,
        unmountedComponents: unmountedCount,
        totalActiveEffects,
        totalActiveTimers,
        totalActiveSubscriptions,
        activeComponentsList: activeComponents.map(info => info.componentName)
    };
};

// =========================================================================
// SAFE ASYNC EFFECT HOOK
// =========================================================================

/**
 * Safe async useEffect that prevents state updates after component unmount
 * @param effect - Async effect function
 * @param deps - Dependency array
 * @param componentName - Component name for debugging
 */
export const useAsyncEffect = (
    effect: () => Promise<void | (() => void)>,
    deps: React.DependencyList,
    componentName: string = 'Unknown'
): void => {
    const isMountedRef = useRef(true);
    const cleanupRef = useRef<(() => void) | null>(null);
    
    useEffect(() => {
        let effectCleanup: (() => void) | undefined;
        
        const runEffect = async () => {
            try {
                if (!isMountedRef.current) return;
                
                const result = await effect();
                
                if (typeof result === 'function') {
                    effectCleanup = result;
                    cleanupRef.current = result;
                }
                
            } catch (error) {
                if (isMountedRef.current) {
                    logger.error('Async effect error', `useAsyncEffect.${componentName}`, error);
                }
            }
        };
        
        runEffect();
        
        return () => {
            isMountedRef.current = false;
            if (effectCleanup) {
                effectCleanup();
            }
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
        };
    }, deps);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);
};

// =========================================================================
// SAFE TIMER HOOKS
// =========================================================================

/**
 * Safe setInterval hook with automatic cleanup
 * @param callback - Function to call periodically
 * @param delay - Delay in milliseconds (null to pause)
 * @param componentName - Component name for debugging
 */
export const useInterval = (
    callback: () => void,
    delay: number | null,
    componentName: string = 'Unknown'
): void => {
    const savedCallback = useRef<() => void>(callback);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    
    // Set up the interval
    useEffect(() => {
        const tick = () => {
            if (savedCallback.current) {
                try {
                    savedCallback.current();
                } catch (error) {
                    logger.error('Interval callback error', `useInterval.${componentName}`, error);
                }
            }
        };
        
        if (delay !== null) {
            intervalRef.current = setInterval(tick, delay);
            
            if (memoryTrackingEnabled) {
                logger.debug('Interval started', `useInterval.${componentName}`, { delay });
            }
        }
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                
                if (memoryTrackingEnabled) {
                    logger.debug('Interval cleaned up', `useInterval.${componentName}`);
                }
            }
        };
    }, [delay, componentName]);
};

/**
 * Safe setTimeout hook with automatic cleanup
 * @param callback - Function to call after delay
 * @param delay - Delay in milliseconds (null to cancel)
 * @param componentName - Component name for debugging
 */
export const useTimeout = (
    callback: () => void,
    delay: number | null,
    componentName: string = 'Unknown'
): void => {
    const savedCallback = useRef<() => void>(callback);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    
    // Set up the timeout
    useEffect(() => {
        const tick = () => {
            if (savedCallback.current) {
                try {
                    savedCallback.current();
                } catch (error) {
                    logger.error('Timeout callback error', `useTimeout.${componentName}`, error);
                }
            }
        };
        
        if (delay !== null) {
            timeoutRef.current = setTimeout(tick, delay);
            
            if (memoryTrackingEnabled) {
                logger.debug('Timeout started', `useTimeout.${componentName}`, { delay });
            }
        }
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
                
                if (memoryTrackingEnabled) {
                    logger.debug('Timeout cleaned up', `useTimeout.${componentName}`);
                }
            }
        };
    }, [delay, componentName]);
};

// =========================================================================
// MEMORY CLEANUP HOOK
// =========================================================================

/**
 * Comprehensive memory cleanup hook for components
 * @param componentName - Component name for tracking
 * @returns Cleanup utilities
 */
export const useMemoryCleanup = (componentName: string) => {
    const componentId = useRef(`${componentName}_${Date.now()}_${Math.random()}`).current;
    const subscriptionsRef = useRef<Set<() => void>>(new Set());
    const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
    const isMountedRef = useRef(true);
    
    // Initialize component memory tracking
    useEffect(() => {
        if (memoryTrackingEnabled) {
            const memoryInfo: ComponentMemoryInfo = {
                componentName,
                mountTime: Date.now(),
                activeEffects: new Set(),
                activeTimers: new Set(),
                activeSubscriptions: new Set()
            };
            
            componentMemoryMap.set(componentId, memoryInfo);
            
            logger.debug('Component mounted', `useMemoryCleanup.${componentName}`, {
                componentId,
                mountTime: memoryInfo.mountTime
            });
        }
        
        return () => {
            isMountedRef.current = false;
            
            // Cleanup all subscriptions
            subscriptionsRef.current.forEach(cleanup => {
                try {
                    cleanup();
                } catch (error) {
                    logger.warn('Subscription cleanup error', `useMemoryCleanup.${componentName}`, error);
                }
            });
            subscriptionsRef.current.clear();
            
            // Cleanup all timers
            timersRef.current.forEach(timer => {
                try {
                    if (timer) {
                        clearTimeout(timer);
                        clearInterval(timer);
                    }
                } catch (error) {
                    logger.warn('Timer cleanup error', `useMemoryCleanup.${componentName}`, error);
                }
            });
            timersRef.current.clear();
            
            // Update memory tracking
            if (memoryTrackingEnabled) {
                const memoryInfo = componentMemoryMap.get(componentId);
                if (memoryInfo) {
                    memoryInfo.unmountTime = Date.now();
                    const lifetime = memoryInfo.unmountTime - memoryInfo.mountTime;
                    
                    logger.debug('Component unmounted', `useMemoryCleanup.${componentName}`, {
                        componentId,
                        lifetime,
                        activeEffects: memoryInfo.activeEffects.size,
                        activeTimers: memoryInfo.activeTimers.size,
                        activeSubscriptions: memoryInfo.activeSubscriptions.size
                    });
                }
            }
        };
    }, [componentName, componentId]);
    
    // Utilities for manual cleanup management
    const addSubscription = useCallback((cleanup: () => void) => {
        if (isMountedRef.current) {
            subscriptionsRef.current.add(cleanup);
        }
    }, []);
    
    const removeSubscription = useCallback((cleanup: () => void) => {
        subscriptionsRef.current.delete(cleanup);
    }, []);
    
    const addTimer = useCallback((timer: NodeJS.Timeout) => {
        if (isMountedRef.current) {
            timersRef.current.add(timer);
        }
    }, []);
    
    const removeTimer = useCallback((timer: NodeJS.Timeout) => {
        timersRef.current.delete(timer);
    }, []);
    
    const isMounted = useCallback(() => isMountedRef.current, []);
    
    return {
        addSubscription,
        removeSubscription,
        addTimer,
        removeTimer,
        isMounted,
        componentId
    };
};

// =========================================================================
// OPTIMIZED STATE HOOKS
// =========================================================================

/**
 * Safe state setter that checks if component is still mounted
 * @param initialState - Initial state value
 * @param componentName - Component name for debugging
 * @returns [state, safeSetter, isMounted]
 */
export const useSafeState = <T>(
    initialState: T,
    componentName: string = 'Unknown'
): [T, (value: T | ((prev: T) => T)) => void, () => boolean] => {
    const [state, setState] = useState<T>(initialState);
    const isMountedRef = useRef(true);
    
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    
    const safeSetter = useCallback((value: T | ((prev: T) => T)) => {
        if (isMountedRef.current) {
            setState(value);
        } else if (memoryTrackingEnabled) {
            logger.warn('Attempted to set state on unmounted component', `useSafeState.${componentName}`);
        }
    }, [componentName]);
    
    const isMounted = useCallback(() => isMountedRef.current, []);
    
    return [state, safeSetter, isMounted];
};

/**
 * Memoized callback with dependency validation
 * @param callback - Function to memoize
 * @param deps - Dependencies
 * @param componentName - Component name for debugging
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList,
    componentName: string = 'Unknown'
): T => {
    return useCallback(callback, deps) as T;
};

/**
 * Memoized value with performance monitoring
 * @param factory - Function that creates the value
 * @param deps - Dependencies
 * @param componentName - Component name for debugging
 */
export const useOptimizedMemo = <T>(
    factory: () => T,
    deps: React.DependencyList,
    componentName: string = 'Unknown'
): T => {
    return useMemo(() => {
        const startTime = performance.now();
        const result = factory();
        const endTime = performance.now();
        
        if (memoryTrackingEnabled && endTime - startTime > 5) {
            logger.debug('Expensive memo calculation', `useOptimizedMemo.${componentName}`, {
                calculationTime: endTime - startTime
            });
        }
        
        return result;
    }, deps);
};

// =========================================================================
// PERFORMANCE MONITORING
// =========================================================================

/**
 * Log memory statistics periodically (for development)
 */
export const startMemoryMonitoring = (intervalMs: number = 30000): (() => void) => {
    if (!memoryTrackingEnabled) {
        return () => {};
    }
    
    const interval = setInterval(() => {
        const stats = getMemoryStats();
        
        if (stats.activeComponents > 0) {
            logger.info('Memory monitoring report', 'MemoryOptimizer.monitoring', stats);
            
            // Warn about potential leaks
            if (stats.totalActiveTimers > 20) {
                logger.warn('High number of active timers detected', 'MemoryOptimizer.monitoring', {
                    activeTimers: stats.totalActiveTimers
                });
            }
            
            if (stats.totalActiveSubscriptions > 50) {
                logger.warn('High number of active subscriptions detected', 'MemoryOptimizer.monitoring', {
                    activeSubscriptions: stats.totalActiveSubscriptions
                });
            }
        }
    }, intervalMs);
    
    return () => clearInterval(interval);
};

/**
 * Clear all memory tracking data (useful for testing)
 */
export const clearMemoryTracking = (): void => {
    componentMemoryMap.clear();
    logger.debug('Memory tracking data cleared', 'MemoryOptimizer.clearMemoryTracking');
};
