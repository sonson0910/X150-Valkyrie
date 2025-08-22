/**
 * withMemoryOptimization - Higher-Order Component for automatic memory optimization
 * 
 * Wraps React components with memory optimization features including:
 * - Automatic cleanup tracking
 * - Memory leak detection
 * - Performance monitoring
 * - Safe state management
 */

import React, { ComponentType, ForwardRefExoticComponent, RefAttributes } from 'react';
import { useMemoryCleanup, startMemoryMonitoring } from './MemoryOptimizer';
import logger from './Logger';

// =========================================================================
// MEMORY OPTIMIZATION HOC
// =========================================================================

interface MemoryOptimizationOptions {
    /**
     * Component name for debugging (auto-detected if not provided)
     */
    componentName?: string;
    
    /**
     * Enable performance monitoring for this component
     */
    enablePerformanceMonitoring?: boolean;
    
    /**
     * Enable automatic cleanup tracking
     */
    enableCleanupTracking?: boolean;
    
    /**
     * Warn if component lifecycle exceeds this duration (ms)
     */
    maxLifetimeWarning?: number;
    
    /**
     * Custom cleanup function called on unmount
     */
    customCleanup?: () => void;
}

/**
 * Higher-order component that adds memory optimization to any React component
 * @param WrappedComponent - Component to wrap
 * @param options - Optimization options
 * @returns Memory-optimized component
 */
export function withMemoryOptimization<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: MemoryOptimizationOptions = {}
) {
    const {
        componentName = WrappedComponent.displayName || WrappedComponent.name || 'Unknown',
        enablePerformanceMonitoring = __DEV__,
        enableCleanupTracking = true,
        maxLifetimeWarning = 300000, // 5 minutes
        customCleanup
    } = options;
    
    const MemoryOptimizedComponent = React.forwardRef<any, P>((props, ref) => {
        const startTime = React.useRef(Date.now());
        const renderCount = React.useRef(0);
        
        // Use memory cleanup hook
        const memoryCleanup = enableCleanupTracking 
            ? useMemoryCleanup(componentName)
            : null;
        
        // Performance monitoring
        React.useEffect(() => {
            if (enablePerformanceMonitoring) {
                const mountTime = Date.now() - startTime.current;
                
                if (mountTime > 100) {
                    logger.warn('Slow component mount detected', `withMemoryOptimization.${componentName}`, {
                        mountTime,
                        renderCount: renderCount.current
                    });
                }
                
                logger.debug('Component mounted with memory optimization', `withMemoryOptimization.${componentName}`, {
                    mountTime,
                    hasCleanupTracking: !!memoryCleanup,
                    componentId: memoryCleanup?.componentId
                });
            }
            
            // Warn about long-lived components
            const lifetimeWarningTimer = setTimeout(() => {
                logger.warn('Long-lived component detected', `withMemoryOptimization.${componentName}`, {
                    lifetime: maxLifetimeWarning,
                    componentId: memoryCleanup?.componentId
                });
            }, maxLifetimeWarning);
            
            return () => {
                clearTimeout(lifetimeWarningTimer);
                
                if (enablePerformanceMonitoring) {
                    const totalLifetime = Date.now() - startTime.current;
                    logger.debug('Component unmounted', `withMemoryOptimization.${componentName}`, {
                        totalLifetime,
                        finalRenderCount: renderCount.current
                    });
                }
                
                // Custom cleanup
                if (customCleanup) {
                    try {
                        customCleanup();
                    } catch (error) {
                        logger.error('Custom cleanup error', `withMemoryOptimization.${componentName}`, error);
                    }
                }
            };
        }, []);
        
        // Track render count
        renderCount.current++;
        
        // Warn about excessive re-renders
        React.useEffect(() => {
            if (enablePerformanceMonitoring && renderCount.current > 50) {
                logger.warn('Excessive renders detected', `withMemoryOptimization.${componentName}`, {
                    renderCount: renderCount.current,
                    componentId: memoryCleanup?.componentId
                });
            }
        });
        
        return <WrappedComponent ref={ref} {...props} />;
    });
    
    // Set display name for debugging
    MemoryOptimizedComponent.displayName = `withMemoryOptimization(${componentName})`;
    
    return MemoryOptimizedComponent;
}

// =========================================================================
// SPECIALIZED MEMORY OPTIMIZATION HOCS
// =========================================================================

/**
 * HOC specifically for screen components with navigation
 * @param ScreenComponent - Screen component
 * @param options - Optimization options
 */
export function withScreenMemoryOptimization<P extends object>(
    ScreenComponent: ComponentType<P>,
    options: MemoryOptimizationOptions = {}
) {
    return withMemoryOptimization(ScreenComponent, {
        enablePerformanceMonitoring: true,
        enableCleanupTracking: true,
        maxLifetimeWarning: 600000, // 10 minutes for screens
        ...options
    });
}

/**
 * HOC for heavy computation components
 * @param HeavyComponent - Component with heavy computations
 * @param options - Optimization options
 */
export function withHeavyComputationOptimization<P extends object>(
    HeavyComponent: ComponentType<P>,
    options: MemoryOptimizationOptions = {}
) {
    return withMemoryOptimization(HeavyComponent, {
        enablePerformanceMonitoring: true,
        enableCleanupTracking: true,
        maxLifetimeWarning: 120000, // 2 minutes for heavy components
        ...options
    });
}

/**
 * HOC for components with real-time data (intervals, websockets, etc.)
 * @param RealtimeComponent - Component with real-time features
 * @param options - Optimization options
 */
export function withRealtimeOptimization<P extends object>(
    RealtimeComponent: ComponentType<P>,
    options: MemoryOptimizationOptions = {}
) {
    return withMemoryOptimization(RealtimeComponent, {
        enablePerformanceMonitoring: true,
        enableCleanupTracking: true,
        maxLifetimeWarning: 1800000, // 30 minutes for real-time components
        customCleanup: () => {
            // Additional cleanup for real-time components
            logger.debug('Real-time component cleanup executed', 'withRealtimeOptimization');
        },
        ...options
    });
}

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================

/**
 * Start global memory monitoring for the entire app
 * @param intervalMs - Monitoring interval in milliseconds
 * @returns Cleanup function
 */
export const startGlobalMemoryMonitoring = (intervalMs: number = 30000): (() => void) => {
    logger.info('Starting global memory monitoring', 'withMemoryOptimization.startGlobalMemoryMonitoring', {
        intervalMs,
        isDev: __DEV__
    });
    
    return startMemoryMonitoring(intervalMs);
};

/**
 * Create a memoized version of a component with memory optimization
 * @param Component - Component to memoize and optimize
 * @param options - Optimization options
 * @param areEqual - Custom comparison function for React.memo
 */
export function createOptimizedMemoComponent<P extends object>(
    Component: ComponentType<P>,
    options: MemoryOptimizationOptions = {},
    areEqual?: (prevProps: P, nextProps: P) => boolean
) {
    const OptimizedComponent = withMemoryOptimization(Component, options);
    return React.memo(OptimizedComponent, areEqual);
}

/**
 * Decorator for class components (if needed)
 * @param options - Optimization options
 */
export function MemoryOptimized(options: MemoryOptimizationOptions = {}) {
    return function<T extends ComponentType<any>>(WrappedComponent: T): T {
        return withMemoryOptimization(WrappedComponent, options) as any;
    };
}

// =========================================================================
// TYPE HELPERS
// =========================================================================

export type OptimizedComponent<P> = ForwardRefExoticComponent<P & RefAttributes<any>>;

export interface MemoryOptimizedProps {
    /**
     * Override component name for memory tracking
     */
    memoryComponentName?: string;
    
    /**
     * Disable memory optimization for this instance
     */
    disableMemoryOptimization?: boolean;
}

