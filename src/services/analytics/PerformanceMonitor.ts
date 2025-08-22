/**
 * Performance monitoring and analytics service
 */

import { EventBus } from '../EventBus';
import logger from '../../utils/Logger';

export interface PerformanceMetric {
    id: string;
    name: string;
    category: 'startup' | 'navigation' | 'api' | 'crypto' | 'ui' | 'memory' | 'network';
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
    tags?: string[];
}

export interface MemoryMetric {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss?: number;
}

export interface NetworkMetric {
    url: string;
    method: string;
    startTime: number;
    endTime: number;
    duration: number;
    status: number;
    requestSize?: number;
    responseSize?: number;
    error?: string;
}

export interface UserAction {
    id: string;
    action: string;
    screen: string;
    timestamp: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export interface AnalyticsEvent {
    id: string;
    name: string;
    category: string;
    timestamp: number;
    properties?: Record<string, any>;
    userId?: string;
    sessionId: string;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private eventBus: EventBus;
    private sessionId: string;
    private metrics: Map<string, PerformanceMetric> = new Map();
    private memoryMetrics: MemoryMetric[] = [];
    private networkMetrics: NetworkMetric[] = [];
    private userActions: UserAction[] = [];
    private analyticsEvents: AnalyticsEvent[] = [];
    private memoryMonitorInterval: NodeJS.Timeout | null = null;
    private isEnabled = true;
    private maxMetricsToKeep = 1000;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.sessionId = this.generateSessionId();
        this.initialize();
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Initialize performance monitoring
     */
    private initialize(): void {
        try {
            // Start memory monitoring
            this.startMemoryMonitoring();

            // Setup automatic cleanup
            this.setupMetricsCleanup();

            // Track app startup
            this.trackAppStartup();

            logger.info('Performance monitor initialized', 'PerformanceMonitor.initialize', {
                sessionId: this.sessionId
            });
        } catch (error) {
            logger.error('Failed to initialize performance monitor', 'PerformanceMonitor.initialize', error);
        }
    }

    /**
     * Start a performance measurement
     */
    public startMeasurement(
        name: string, 
        category: PerformanceMetric['category'],
        metadata?: Record<string, any>,
        tags?: string[]
    ): string {
        if (!this.isEnabled) return '';

        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const metric: PerformanceMetric = {
            id,
            name,
            category,
            startTime: performance.now(),
            metadata,
            tags
        };

        this.metrics.set(id, metric);

        logger.debug('Performance measurement started', 'PerformanceMonitor.startMeasurement', {
            id,
            name,
            category
        });

        return id;
    }

    /**
     * End a performance measurement
     */
    public endMeasurement(id: string, metadata?: Record<string, any>): PerformanceMetric | null {
        if (!this.isEnabled || !id) return null;

        const metric = this.metrics.get(id);
        if (!metric) {
            logger.warn('Measurement not found', 'PerformanceMonitor.endMeasurement', { id });
            return null;
        }

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
        
        if (metadata) {
            metric.metadata = { ...metric.metadata, ...metadata };
        }

        // Emit performance event
        this.eventBus.emit('performance:measurement', metric);

        logger.debug('Performance measurement completed', 'PerformanceMonitor.endMeasurement', {
            id,
            name: metric.name,
            duration: metric.duration
        });

        return metric;
    }

    /**
     * Measure a function execution
     */
    public async measureFunction<T>(
        name: string,
        category: PerformanceMetric['category'],
        fn: () => Promise<T> | T,
        metadata?: Record<string, any>
    ): Promise<T> {
        const id = this.startMeasurement(name, category, metadata);
        
        try {
            const result = await fn();
            this.endMeasurement(id, { success: true });
            return result;
        } catch (error) {
            this.endMeasurement(id, { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * Track network request
     */
    public trackNetworkRequest(
        url: string,
        method: string,
        startTime: number,
        endTime: number,
        status: number,
        requestSize?: number,
        responseSize?: number,
        error?: string
    ): void {
        if (!this.isEnabled) return;

        const networkMetric: NetworkMetric = {
            url,
            method,
            startTime,
            endTime,
            duration: endTime - startTime,
            status,
            requestSize,
            responseSize,
            error
        };

        this.networkMetrics.push(networkMetric);
        this.cleanupOldMetrics();

        // Emit network event
        this.eventBus.emit('performance:network', networkMetric);

        logger.debug('Network request tracked', 'PerformanceMonitor.trackNetworkRequest', {
            url,
            method,
            duration: networkMetric.duration,
            status
        });
    }

    /**
     * Track user action
     */
    public trackUserAction(
        action: string,
        screen: string,
        metadata?: Record<string, any>
    ): string {
        if (!this.isEnabled) return '';

        const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const userAction: UserAction = {
            id,
            action,
            screen,
            timestamp: Date.now(),
            metadata
        };

        this.userActions.push(userAction);
        this.cleanupOldMetrics();

        // Emit user action event
        this.eventBus.emit('analytics:userAction', userAction);

        logger.debug('User action tracked', 'PerformanceMonitor.trackUserAction', {
            action,
            screen
        });

        return id;
    }

    /**
     * End user action (for actions with duration)
     */
    public endUserAction(id: string): void {
        if (!this.isEnabled || !id) return;

        const action = this.userActions.find(a => a.id === id);
        if (action && !action.duration) {
            action.duration = Date.now() - action.timestamp;
            
            logger.debug('User action completed', 'PerformanceMonitor.endUserAction', {
                id,
                action: action.action,
                duration: action.duration
            });
        }
    }

    /**
     * Track analytics event
     */
    public trackEvent(
        name: string,
        category: string,
        properties?: Record<string, any>,
        userId?: string
    ): void {
        if (!this.isEnabled) return;

        const event: AnalyticsEvent = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            category,
            timestamp: Date.now(),
            properties,
            userId,
            sessionId: this.sessionId
        };

        this.analyticsEvents.push(event);
        this.cleanupOldMetrics();

        // Emit analytics event
        this.eventBus.emit('analytics:event', event);

        logger.debug('Analytics event tracked', 'PerformanceMonitor.trackEvent', {
            name,
            category,
            userId
        });
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        totalMeasurements: number;
        avgDurationByCategory: Record<string, number>;
        memoryUsage: MemoryMetric | null;
        networkSummary: {
            totalRequests: number;
            avgDuration: number;
            errorRate: number;
        };
        topUserActions: Array<{ action: string; count: number }>;
    } {
        const completedMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
        
        // Calculate average duration by category
        const avgDurationByCategory: Record<string, number> = {};
        const categoryGroups = completedMetrics.reduce((groups, metric) => {
            if (!groups[metric.category]) {
                groups[metric.category] = [];
            }
            groups[metric.category].push(metric.duration!);
            return groups;
        }, {} as Record<string, number[]>);

        Object.keys(categoryGroups).forEach(category => {
            const durations = categoryGroups[category];
            avgDurationByCategory[category] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        });

        // Network summary
        const networkSummary = {
            totalRequests: this.networkMetrics.length,
            avgDuration: this.networkMetrics.length > 0 
                ? this.networkMetrics.reduce((sum, m) => sum + m.duration, 0) / this.networkMetrics.length 
                : 0,
            errorRate: this.networkMetrics.length > 0 
                ? this.networkMetrics.filter(m => m.status >= 400).length / this.networkMetrics.length 
                : 0
        };

        // Top user actions
        const actionCounts = this.userActions.reduce((counts, action) => {
            counts[action.action] = (counts[action.action] || 0) + 1;
            return counts;
        }, {} as Record<string, number>);

        const topUserActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalMeasurements: completedMetrics.length,
            avgDurationByCategory,
            memoryUsage: this.memoryMetrics[this.memoryMetrics.length - 1] || null,
            networkSummary,
            topUserActions
        };
    }

    /**
     * Get all metrics for export
     */
    public exportMetrics(): {
        sessionId: string;
        timestamp: number;
        performance: PerformanceMetric[];
        memory: MemoryMetric[];
        network: NetworkMetric[];
        userActions: UserAction[];
        events: AnalyticsEvent[];
    } {
        return {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            performance: Array.from(this.metrics.values()),
            memory: [...this.memoryMetrics],
            network: [...this.networkMetrics],
            userActions: [...this.userActions],
            events: [...this.analyticsEvents]
        };
    }

    /**
     * Clear all metrics
     */
    public clearMetrics(): void {
        this.metrics.clear();
        this.memoryMetrics = [];
        this.networkMetrics = [];
        this.userActions = [];
        this.analyticsEvents = [];

        logger.info('All metrics cleared', 'PerformanceMonitor.clearMetrics');
    }

    /**
     * Enable/disable monitoring
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        
        if (enabled) {
            this.startMemoryMonitoring();
        } else {
            this.stopMemoryMonitoring();
        }

        logger.info('Performance monitoring toggled', 'PerformanceMonitor.setEnabled', { enabled });
    }

    /**
     * Private helper methods
     */

    private startMemoryMonitoring(): void {
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }

        this.memoryMonitorInterval = setInterval(() => {
            this.collectMemoryMetrics();
        }, 10000); // Collect every 10 seconds
    }

    private stopMemoryMonitoring(): void {
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
            this.memoryMonitorInterval = null;
        }
    }

    private collectMemoryMetrics(): void {
        try {
            if (typeof process !== 'undefined' && process.memoryUsage) {
                const memUsage = process.memoryUsage();
                const metric: MemoryMetric = {
                    timestamp: Date.now(),
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    rss: memUsage.rss
                };

                this.memoryMetrics.push(metric);
                
                // Keep only last 100 memory metrics
                if (this.memoryMetrics.length > 100) {
                    this.memoryMetrics = this.memoryMetrics.slice(-100);
                }

                // Emit memory event
                this.eventBus.emit('performance:memory', metric);
            }
        } catch (error) {
            logger.warn('Failed to collect memory metrics', 'PerformanceMonitor.collectMemoryMetrics', error);
        }
    }

    private setupMetricsCleanup(): void {
        // Cleanup old metrics every 5 minutes
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 5 * 60 * 1000);
    }

    private cleanupOldMetrics(): void {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

        // Cleanup old user actions
        this.userActions = this.userActions.filter(action => action.timestamp > cutoffTime);

        // Cleanup old analytics events
        this.analyticsEvents = this.analyticsEvents.filter(event => event.timestamp > cutoffTime);

        // Cleanup old network metrics
        this.networkMetrics = this.networkMetrics.filter(metric => metric.startTime > cutoffTime);

        // Keep only recent performance metrics
        if (this.metrics.size > this.maxMetricsToKeep) {
            const sortedMetrics = Array.from(this.metrics.entries())
                .sort(([, a], [, b]) => b.startTime - a.startTime)
                .slice(0, this.maxMetricsToKeep);
            
            this.metrics.clear();
            sortedMetrics.forEach(([id, metric]) => {
                this.metrics.set(id, metric);
            });
        }
    }

    private trackAppStartup(): void {
        // Track app startup time
        if (typeof window !== 'undefined' && window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const startupTime = timing.loadEventEnd - timing.navigationStart;
            
            this.trackEvent('app_startup', 'performance', {
                duration: startupTime,
                navigationStart: timing.navigationStart,
                loadEventEnd: timing.loadEventEnd
            });
        }
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleanup on destroy
     */
    public destroy(): void {
        this.stopMemoryMonitoring();
        this.clearMetrics();
    }
}

export default PerformanceMonitor;

