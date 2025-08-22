/**
 * React hooks for performance monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PerformanceMonitor, PerformanceMetric, MemoryMetric } from '../services/analytics/PerformanceMonitor';
import { EventBus } from '../services/EventBus';

export interface UsePerformanceResult {
    startMeasurement: (name: string, category: PerformanceMetric['category'], metadata?: Record<string, any>) => string;
    endMeasurement: (id: string, metadata?: Record<string, any>) => void;
    measureFunction: <T>(name: string, category: PerformanceMetric['category'], fn: () => Promise<T> | T) => Promise<T>;
    trackUserAction: (action: string, screen: string, metadata?: Record<string, any>) => string;
    trackEvent: (name: string, category: string, properties?: Record<string, any>) => void;
    performanceSummary: any;
    memoryUsage: MemoryMetric | null;
}

export function usePerformance(): UsePerformanceResult {
    const [performanceSummary, setPerformanceSummary] = useState<any>(null);
    const [memoryUsage, setMemoryUsage] = useState<MemoryMetric | null>(null);
    
    const performanceMonitor = PerformanceMonitor.getInstance();
    const eventBus = EventBus.getInstance();

    useEffect(() => {
        // Update performance summary periodically
        const updateSummary = () => {
            setPerformanceSummary(performanceMonitor.getPerformanceSummary());
        };

        // Handle memory updates
        const handleMemoryUpdate = (memory: MemoryMetric) => {
            setMemoryUsage(memory);
        };

        // Initial update
        updateSummary();

        // Subscribe to events
        eventBus.on('performance:memory', handleMemoryUpdate);

        // Update summary every 30 seconds
        const interval = setInterval(updateSummary, 30000);

        return () => {
            clearInterval(interval);
            eventBus.off('performance:memory', handleMemoryUpdate);
        };
    }, []);

    const startMeasurement = useCallback((
        name: string, 
        category: PerformanceMetric['category'], 
        metadata?: Record<string, any>
    ) => {
        return performanceMonitor.startMeasurement(name, category, metadata);
    }, []);

    const endMeasurement = useCallback((id: string, metadata?: Record<string, any>) => {
        performanceMonitor.endMeasurement(id, metadata);
    }, []);

    const measureFunction = useCallback(async <T,>(
        name: string, 
        category: PerformanceMetric['category'], 
        fn: () => Promise<T> | T
    ): Promise<T> => {
        return await performanceMonitor.measureFunction(name, category, fn);
    }, []);

    const trackUserAction = useCallback((
        action: string, 
        screen: string, 
        metadata?: Record<string, any>
    ) => {
        return performanceMonitor.trackUserAction(action, screen, metadata);
    }, []);

    const trackEvent = useCallback((
        name: string, 
        category: string, 
        properties?: Record<string, any>
    ) => {
        performanceMonitor.trackEvent(name, category, properties);
    }, []);

    return {
        startMeasurement,
        endMeasurement,
        measureFunction,
        trackUserAction,
        trackEvent,
        performanceSummary,
        memoryUsage
    };
}

export interface UseScreenPerformanceResult {
    trackScreenView: () => void;
    trackInteraction: (action: string, metadata?: Record<string, any>) => void;
    screenMetrics: {
        viewTime: number;
        interactions: number;
    };
}

export function useScreenPerformance(screenName: string): UseScreenPerformanceResult {
    const [screenMetrics, setScreenMetrics] = useState({
        viewTime: 0,
        interactions: 0
    });
    
    const performanceMonitor = PerformanceMonitor.getInstance();
    const screenStartTime = useRef<number>(0);
    const screenMeasurementId = useRef<string>('');
    const interactionCount = useRef<number>(0);

    useEffect(() => {
        // Track screen view on mount
        trackScreenView();

        return () => {
            // Track screen exit on unmount
            if (screenMeasurementId.current) {
                performanceMonitor.endMeasurement(screenMeasurementId.current, {
                    screenExit: true,
                    totalInteractions: interactionCount.current
                });
            }
        };
    }, [screenName]);

    const trackScreenView = useCallback(() => {
        screenStartTime.current = Date.now();
        screenMeasurementId.current = performanceMonitor.startMeasurement(
            `screen_view_${screenName}`,
            'ui',
            { screenName }
        );

        performanceMonitor.trackEvent('screen_view', 'navigation', {
            screenName,
            timestamp: screenStartTime.current
        });
    }, [screenName]);

    const trackInteraction = useCallback((action: string, metadata?: Record<string, any>) => {
        interactionCount.current++;
        
        performanceMonitor.trackUserAction(action, screenName, {
            ...metadata,
            interactionCount: interactionCount.current
        });

        setScreenMetrics(prev => ({
            viewTime: Date.now() - screenStartTime.current,
            interactions: interactionCount.current
        }));
    }, [screenName]);

    useEffect(() => {
        // Update view time every second
        const interval = setInterval(() => {
            if (screenStartTime.current > 0) {
                setScreenMetrics(prev => ({
                    ...prev,
                    viewTime: Date.now() - screenStartTime.current
                }));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return {
        trackScreenView,
        trackInteraction,
        screenMetrics
    };
}

export interface UseApiPerformanceResult {
    trackApiCall: <T>(
        url: string, 
        method: string, 
        apiCall: () => Promise<T>
    ) => Promise<T>;
    apiMetrics: {
        totalCalls: number;
        averageResponseTime: number;
        errorRate: number;
    };
}

export function useApiPerformance(): UseApiPerformanceResult {
    const [apiMetrics, setApiMetrics] = useState({
        totalCalls: 0,
        averageResponseTime: 0,
        errorRate: 0
    });

    const performanceMonitor = PerformanceMonitor.getInstance();
    const apiCalls = useRef<Array<{ duration: number; success: boolean }>>([]);

    const trackApiCall = useCallback(async <T,>(
        url: string, 
        method: string, 
        apiCall: () => Promise<T>
    ): Promise<T> => {
        const startTime = performance.now();
        let success = true;
        let error: Error | null = null;

        try {
            const result = await apiCall();
            return result;
        } catch (err) {
            success = false;
            error = err as Error;
            throw err;
        } finally {
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Track the API call
            performanceMonitor.trackNetworkRequest(
                url,
                method,
                startTime,
                endTime,
                success ? 200 : 500,
                undefined,
                undefined,
                error?.message
            );

            // Update local metrics
            apiCalls.current.push({ duration, success });
            
            // Keep only last 100 calls
            if (apiCalls.current.length > 100) {
                apiCalls.current = apiCalls.current.slice(-100);
            }

            // Update metrics
            const totalCalls = apiCalls.current.length;
            const averageResponseTime = apiCalls.current.reduce((sum, call) => sum + call.duration, 0) / totalCalls;
            const errorRate = apiCalls.current.filter(call => !call.success).length / totalCalls;

            setApiMetrics({
                totalCalls,
                averageResponseTime,
                errorRate
            });
        }
    }, []);

    return {
        trackApiCall,
        apiMetrics
    };
}

export interface UseCryptoPerformanceResult {
    measureCryptoOperation: <T>(
        operation: string,
        fn: () => Promise<T> | T
    ) => Promise<T>;
    cryptoMetrics: {
        totalOperations: number;
        averageTime: number;
        operationTimes: Record<string, number>;
    };
}

export function useCryptoPerformance(): UseCryptoPerformanceResult {
    const [cryptoMetrics, setCryptoMetrics] = useState({
        totalOperations: 0,
        averageTime: 0,
        operationTimes: {} as Record<string, number>
    });

    const performanceMonitor = PerformanceMonitor.getInstance();
    const operations = useRef<Array<{ operation: string; duration: number }>>([]);

    const measureCryptoOperation = useCallback(async <T,>(
        operation: string,
        fn: () => Promise<T> | T
    ): Promise<T> => {
        const result = await performanceMonitor.measureFunction(
            `crypto_${operation}`,
            'crypto',
            fn,
            { operation }
        );

        // Update local tracking
        const measurement = Array.from(performanceMonitor['metrics'].values())
            .filter(m => m.name === `crypto_${operation}` && m.duration !== undefined)
            .pop();

        if (measurement && measurement.duration !== undefined) {
            operations.current.push({ operation, duration: measurement.duration });

            // Keep only last 50 operations
            if (operations.current.length > 50) {
                operations.current = operations.current.slice(-50);
            }

            // Calculate metrics
            const totalOperations = operations.current.length;
            const averageTime = operations.current.reduce((sum, op) => sum + op.duration, 0) / totalOperations;
            
            const operationTimes: Record<string, number> = {};
            const operationGroups = operations.current.reduce((groups, op) => {
                if (!groups[op.operation]) {
                    groups[op.operation] = [];
                }
                groups[op.operation].push(op.duration);
                return groups;
            }, {} as Record<string, number[]>);

            Object.keys(operationGroups).forEach(op => {
                const durations = operationGroups[op];
                operationTimes[op] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
            });

            setCryptoMetrics({
                totalOperations,
                averageTime,
                operationTimes
            });
        }

        return result;
    }, []);

    return {
        measureCryptoOperation,
        cryptoMetrics
    };
}

export default usePerformance;

