interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

interface PerformanceReport {
    totalMetrics: number;
    averageDuration: number;
    slowestOperation: PerformanceMetric | null;
    fastestOperation: PerformanceMetric | null;
    operationsByDuration: PerformanceMetric[];
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, PerformanceMetric> = new Map();
    private isEnabled: boolean = __DEV__; // Enable in development by default
    private slowOperationThreshold: number = 1000; // 1 second

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Bắt đầu đo performance của một operation
     */
    startOperation(name: string, metadata?: Record<string, any>): string {
        if (!this.isEnabled) return '';

        const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.metrics.set(operationId, {
            name,
            startTime: performance.now(),
            metadata
        });

        return operationId;
    }

    /**
     * Kết thúc đo performance của một operation
     */
    endOperation(operationId: string): void {
        if (!this.isEnabled || !operationId) return;

        const metric = this.metrics.get(operationId);
        if (!metric) return;

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;

        // Log slow operations
        if (metric.duration > this.slowOperationThreshold) {
            console.warn(`Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`, metric.metadata);
        }

        // Clean up old metrics (keep only last 100)
        if (this.metrics.size > 100) {
            const oldestKeys = Array.from(this.metrics.keys()).slice(0, this.metrics.size - 100);
            oldestKeys.forEach(key => this.metrics.delete(key));
        }
    }

    /**
     * Đo performance của một async function
     */
    async measureAsync<T>(
        name: string,
        fn: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        const operationId = this.startOperation(name, metadata);

        try {
            const result = await fn();
            return result;
        } finally {
            this.endOperation(operationId);
        }
    }

    /**
     * Đo performance của một sync function
     */
    measureSync<T>(
        name: string,
        fn: () => T,
        metadata?: Record<string, any>
    ): T {
        const operationId = this.startOperation(name, metadata);

        try {
            const result = fn();
            return result;
        } finally {
            this.endOperation(operationId);
        }
    }

    /**
     * Lấy performance report
     */
    getPerformanceReport(): PerformanceReport {
        const metrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined);

        if (metrics.length === 0) {
            return {
                totalMetrics: 0,
                averageDuration: 0,
                slowestOperation: null,
                fastestOperation: null,
                operationsByDuration: []
            };
        }

        const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        const averageDuration = totalDuration / metrics.length;

        const sortedByDuration = [...metrics].sort((a, b) => (b.duration || 0) - (a.duration || 0));

        return {
            totalMetrics: metrics.length,
            averageDuration,
            slowestOperation: sortedByDuration[0] || null,
            fastestOperation: sortedByDuration[sortedByDuration.length - 1] || null,
            operationsByDuration: sortedByDuration
        };
    }

    /**
     * Lấy metrics cho một operation cụ thể
     */
    getOperationMetrics(operationName: string): PerformanceMetric[] {
        return Array.from(this.metrics.values())
            .filter(m => m.name === operationName && m.duration !== undefined);
    }

    /**
     * Lấy average duration cho một operation
     */
    getAverageOperationDuration(operationName: string): number {
        const metrics = this.getOperationMetrics(operationName);
        if (metrics.length === 0) return 0;

        const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        return totalDuration / metrics.length;
    }

    /**
     * Enable/disable performance monitoring
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        console.log(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set threshold cho slow operations
     */
    setSlowOperationThreshold(threshold: number): void {
        this.slowOperationThreshold = threshold;
    }

    /**
     * Clear tất cả metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
    }

    /**
     * Export metrics để debug
     */
    exportMetrics(): PerformanceMetric[] {
        return Array.from(this.metrics.values());
    }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
