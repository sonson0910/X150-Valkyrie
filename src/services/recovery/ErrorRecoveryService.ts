/**
 * Enhanced error recovery service with intelligent retry, circuit breakers, and fallback mechanisms
 */

import { EventBus } from '../EventBus';
import { AnalyticsService } from '../analytics/AnalyticsService';
import logger from '../../utils/Logger';

export type RecoveryStrategy = 'retry' | 'fallback' | 'circuit_breaker' | 'graceful_degradation' | 'manual';

export interface RecoveryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitterEnabled: boolean;
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
    fallbackTimeout: number;
    gracefulDegradationEnabled: boolean;
}

export interface RecoveryContext {
    operation: string;
    attempt: number;
    lastError: Error;
    metadata?: Record<string, any>;
    startTime: number;
    strategy: RecoveryStrategy;
}

export interface FallbackProvider {
    id: string;
    priority: number;
    canHandle: (error: Error, context: RecoveryContext) => boolean;
    execute: (error: Error, context: RecoveryContext) => Promise<any>;
    isHealthy: () => Promise<boolean>;
}

export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailureTime: number;
    nextAttemptTime: number;
    successCount: number;
}

export class ErrorRecoveryService {
    private static instance: ErrorRecoveryService;
    private eventBus: EventBus;
    private analyticsService: AnalyticsService;
    private config: RecoveryConfig;
    private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
    private fallbackProviders: Map<string, FallbackProvider[]> = new Map();
    private activeRecoveries: Map<string, RecoveryContext> = new Map();
    private healthChecks: Map<string, { healthy: boolean; lastCheck: number }> = new Map();

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.analyticsService = AnalyticsService.getInstance();
        this.config = this.getDefaultConfig();
        this.initialize();
    }

    public static getInstance(): ErrorRecoveryService {
        if (!ErrorRecoveryService.instance) {
            ErrorRecoveryService.instance = new ErrorRecoveryService();
        }
        return ErrorRecoveryService.instance;
    }

    /**
     * Initialize error recovery service
     */
    private initialize(): void {
        try {
            // Setup health check monitoring
            this.startHealthCheckMonitoring();

            // Setup automatic circuit breaker recovery
            this.startCircuitBreakerRecovery();

            logger.info('Error recovery service initialized', 'ErrorRecoveryService.initialize');
        } catch (error) {
            logger.error('Failed to initialize error recovery service', 'ErrorRecoveryService.initialize', error);
        }
    }

    /**
     * Execute operation with comprehensive error recovery
     */
    public async executeWithRecovery<T>(
        operation: () => Promise<T>,
        operationId: string,
        strategy: RecoveryStrategy = 'retry',
        metadata?: Record<string, any>
    ): Promise<T> {
        const context: RecoveryContext = {
            operation: operationId,
            attempt: 0,
            lastError: new Error('Initial attempt'),
            metadata,
            startTime: Date.now(),
            strategy
        };

        this.activeRecoveries.set(operationId, context);

        try {
            const result = await this.attemptOperation(operation, context);
            
            // Track successful recovery if there were previous attempts
            if (context.attempt > 0) {
                this.trackRecoverySuccess(context);
            }

            return result;
        } catch (error) {
            // Track final failure
            this.trackRecoveryFailure(context, error);
            throw error;
        } finally {
            this.activeRecoveries.delete(operationId);
        }
    }

    /**
     * Attempt operation with recovery logic
     */
    private async attemptOperation<T>(
        operation: () => Promise<T>,
        context: RecoveryContext
    ): Promise<T> {
        while (context.attempt <= this.config.maxRetries) {
            context.attempt++;

            try {
                // Check circuit breaker
                if (this.isCircuitBreakerOpen(context.operation)) {
                    throw new Error(`Circuit breaker is open for ${context.operation}`);
                }

                // Execute operation
                const result = await operation();
                
                // Reset circuit breaker on success
                this.recordCircuitBreakerSuccess(context.operation);
                
                return result;

            } catch (error) {
                context.lastError = error as Error;

                // Record circuit breaker failure
                this.recordCircuitBreakerFailure(context.operation);

                // Track error
                this.analyticsService.trackError(error as Error, {
                    operation: context.operation,
                    attempt: context.attempt,
                    strategy: context.strategy
                });

                // Determine if we should continue retrying
                if (await this.shouldRetry(error as Error, context)) {
                    // Apply backoff delay
                    const delay = this.calculateBackoffDelay(context.attempt);
                    await this.sleep(delay);
                    
                    logger.warn('Retrying operation', 'ErrorRecoveryService.attemptOperation', {
                        operation: context.operation,
                        attempt: context.attempt,
                        delay,
                        error: error.message
                    });
                    
                    continue;
                }

                // Try fallback if retries exhausted
                if (context.strategy === 'fallback' || context.strategy === 'graceful_degradation') {
                    const fallbackResult = await this.tryFallback(error as Error, context);
                    if (fallbackResult !== null) {
                        return fallbackResult;
                    }
                }

                // All recovery attempts failed
                throw error;
            }
        }

        throw context.lastError;
    }

    /**
     * Determine if operation should be retried
     */
    private async shouldRetry(error: Error, context: RecoveryContext): Promise<boolean> {
        // Don't retry if max attempts reached
        if (context.attempt >= this.config.maxRetries) {
            return false;
        }

        // Don't retry for certain error types
        if (this.isNonRetriableError(error)) {
            return false;
        }

        // Don't retry if circuit breaker is open
        if (this.isCircuitBreakerOpen(context.operation)) {
            return false;
        }

        // Check if operation has timed out
        const elapsed = Date.now() - context.startTime;
        if (elapsed > this.config.fallbackTimeout) {
            return false;
        }

        return true;
    }

    /**
     * Try fallback providers
     */
    private async tryFallback<T>(error: Error, context: RecoveryContext): Promise<T | null> {
        const providers = this.fallbackProviders.get(context.operation) || [];
        
        // Sort by priority
        const sortedProviders = providers.sort((a, b) => a.priority - b.priority);

        for (const provider of sortedProviders) {
            try {
                // Check if provider can handle this error
                if (!provider.canHandle(error, context)) {
                    continue;
                }

                // Check provider health
                if (!(await provider.isHealthy())) {
                    continue;
                }

                logger.info('Attempting fallback', 'ErrorRecoveryService.tryFallback', {
                    operation: context.operation,
                    provider: provider.id
                });

                const result = await provider.execute(error, context);
                
                // Track successful fallback
                this.analyticsService.trackEvent('fallback_success', 'recovery', {
                    operation: context.operation,
                    provider: provider.id,
                    attempt: context.attempt
                });

                return result;

            } catch (fallbackError) {
                logger.warn('Fallback failed', 'ErrorRecoveryService.tryFallback', {
                    operation: context.operation,
                    provider: provider.id,
                    error: fallbackError.message
                });

                // Track failed fallback
                this.analyticsService.trackEvent('fallback_failed', 'recovery', {
                    operation: context.operation,
                    provider: provider.id,
                    error: fallbackError.message
                });
            }
        }

        return null;
    }

    /**
     * Register fallback provider
     */
    public registerFallbackProvider(
        operationId: string,
        provider: FallbackProvider
    ): void {
        if (!this.fallbackProviders.has(operationId)) {
            this.fallbackProviders.set(operationId, []);
        }

        const providers = this.fallbackProviders.get(operationId)!;
        providers.push(provider);

        // Sort by priority
        providers.sort((a, b) => a.priority - b.priority);

        logger.info('Fallback provider registered', 'ErrorRecoveryService.registerFallbackProvider', {
            operation: operationId,
            provider: provider.id,
            priority: provider.priority
        });
    }

    /**
     * Circuit breaker management
     */
    private isCircuitBreakerOpen(operationId: string): boolean {
        const circuitBreaker = this.circuitBreakers.get(operationId);
        if (!circuitBreaker) {
            return false;
        }

        const now = Date.now();

        switch (circuitBreaker.state) {
            case 'closed':
                return false;
            
            case 'open':
                if (now >= circuitBreaker.nextAttemptTime) {
                    // Transition to half-open
                    circuitBreaker.state = 'half_open';
                    circuitBreaker.successCount = 0;
                    return false;
                }
                return true;
            
            case 'half_open':
                return false;
        }
    }

    private recordCircuitBreakerSuccess(operationId: string): void {
        const circuitBreaker = this.getOrCreateCircuitBreaker(operationId);
        
        if (circuitBreaker.state === 'half_open') {
            circuitBreaker.successCount++;
            
            // If enough successes, close the circuit
            if (circuitBreaker.successCount >= 3) {
                circuitBreaker.state = 'closed';
                circuitBreaker.failureCount = 0;
                
                logger.info('Circuit breaker closed', 'ErrorRecoveryService.recordCircuitBreakerSuccess', {
                    operation: operationId
                });
            }
        } else if (circuitBreaker.state === 'closed') {
            // Reset failure count on success
            circuitBreaker.failureCount = 0;
        }
    }

    private recordCircuitBreakerFailure(operationId: string): void {
        const circuitBreaker = this.getOrCreateCircuitBreaker(operationId);
        
        circuitBreaker.failureCount++;
        circuitBreaker.lastFailureTime = Date.now();

        if (circuitBreaker.state === 'closed' && 
            circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
            // Open the circuit
            circuitBreaker.state = 'open';
            circuitBreaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
            
            logger.warn('Circuit breaker opened', 'ErrorRecoveryService.recordCircuitBreakerFailure', {
                operation: operationId,
                failureCount: circuitBreaker.failureCount
            });

            // Emit circuit breaker event
            this.eventBus.emit('recovery:circuitBreakerOpened', {
                operation: operationId,
                failureCount: circuitBreaker.failureCount
            });
            
        } else if (circuitBreaker.state === 'half_open') {
            // Reopen the circuit
            circuitBreaker.state = 'open';
            circuitBreaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
        }
    }

    private getOrCreateCircuitBreaker(operationId: string): CircuitBreakerState {
        if (!this.circuitBreakers.has(operationId)) {
            this.circuitBreakers.set(operationId, {
                state: 'closed',
                failureCount: 0,
                lastFailureTime: 0,
                nextAttemptTime: 0,
                successCount: 0
            });
        }
        return this.circuitBreakers.get(operationId)!;
    }

    /**
     * Health check monitoring
     */
    private startHealthCheckMonitoring(): void {
        setInterval(async () => {
            await this.performHealthChecks();
        }, 60000); // Check every minute
    }

    private async performHealthChecks(): Promise<void> {
        try {
            // Check all registered fallback providers
            for (const [operationId, providers] of this.fallbackProviders) {
                for (const provider of providers) {
                    try {
                        const healthy = await provider.isHealthy();
                        this.healthChecks.set(provider.id, {
                            healthy,
                            lastCheck: Date.now()
                        });

                        if (!healthy) {
                            logger.warn('Fallback provider unhealthy', 'ErrorRecoveryService.performHealthChecks', {
                                operation: operationId,
                                provider: provider.id
                            });
                        }
                    } catch (error) {
                        this.healthChecks.set(provider.id, {
                            healthy: false,
                            lastCheck: Date.now()
                        });

                        logger.error('Health check failed', 'ErrorRecoveryService.performHealthChecks', {
                            provider: provider.id,
                            error
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to perform health checks', 'ErrorRecoveryService.performHealthChecks', error);
        }
    }

    /**
     * Circuit breaker recovery monitoring
     */
    private startCircuitBreakerRecovery(): void {
        setInterval(() => {
            this.checkCircuitBreakerRecovery();
        }, 30000); // Check every 30 seconds
    }

    private checkCircuitBreakerRecovery(): void {
        const now = Date.now();
        
        for (const [operationId, circuitBreaker] of this.circuitBreakers) {
            if (circuitBreaker.state === 'open' && now >= circuitBreaker.nextAttemptTime) {
                logger.info('Circuit breaker ready for recovery attempt', 'ErrorRecoveryService.checkCircuitBreakerRecovery', {
                    operation: operationId
                });
            }
        }
    }

    /**
     * Utility methods
     */
    private calculateBackoffDelay(attempt: number): number {
        const baseDelay = this.config.baseDelay;
        const multiplier = Math.pow(this.config.backoffMultiplier, attempt - 1);
        let delay = Math.min(baseDelay * multiplier, this.config.maxDelay);

        // Add jitter if enabled
        if (this.config.jitterEnabled) {
            delay += Math.random() * delay * 0.1; // 10% jitter
        }

        return Math.floor(delay);
    }

    private isNonRetriableError(error: Error): boolean {
        const nonRetriableMessages = [
            'unauthorized',
            'forbidden',
            'invalid_credentials',
            'malformed_request',
            'bad_request'
        ];

        const message = error.message.toLowerCase();
        return nonRetriableMessages.some(msg => message.includes(msg));
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private trackRecoverySuccess(context: RecoveryContext): void {
        this.analyticsService.trackEvent('recovery_success', 'recovery', {
            operation: context.operation,
            strategy: context.strategy,
            attempts: context.attempt,
            duration: Date.now() - context.startTime
        });

        logger.info('Recovery successful', 'ErrorRecoveryService.trackRecoverySuccess', {
            operation: context.operation,
            attempts: context.attempt,
            strategy: context.strategy
        });
    }

    private trackRecoveryFailure(context: RecoveryContext, error: Error): void {
        this.analyticsService.trackEvent('recovery_failed', 'recovery', {
            operation: context.operation,
            strategy: context.strategy,
            attempts: context.attempt,
            duration: Date.now() - context.startTime,
            error: error.message
        });

        logger.error('Recovery failed', 'ErrorRecoveryService.trackRecoveryFailure', {
            operation: context.operation,
            attempts: context.attempt,
            strategy: context.strategy,
            error
        });
    }

    /**
     * Get recovery status
     */
    public getRecoveryStatus(): {
        activeRecoveries: number;
        circuitBreakers: Array<{ operation: string; state: string; failures: number }>;
        healthyFallbacks: number;
        totalFallbacks: number;
    } {
        const circuitBreakers = Array.from(this.circuitBreakers.entries()).map(([operation, cb]) => ({
            operation,
            state: cb.state,
            failures: cb.failureCount
        }));

        let healthyFallbacks = 0;
        let totalFallbacks = 0;

        for (const providers of this.fallbackProviders.values()) {
            totalFallbacks += providers.length;
            for (const provider of providers) {
                const health = this.healthChecks.get(provider.id);
                if (health?.healthy) {
                    healthyFallbacks++;
                }
            }
        }

        return {
            activeRecoveries: this.activeRecoveries.size,
            circuitBreakers,
            healthyFallbacks,
            totalFallbacks
        };
    }

    /**
     * Configuration management
     */
    public updateConfig(config: Partial<RecoveryConfig>): void {
        this.config = { ...this.config, ...config };
        
        logger.info('Recovery config updated', 'ErrorRecoveryService.updateConfig', config);
    }

    private getDefaultConfig(): RecoveryConfig {
        return {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitterEnabled: true,
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 60000,
            fallbackTimeout: 120000,
            gracefulDegradationEnabled: true
        };
    }

    /**
     * Cleanup on destroy
     */
    public destroy(): void {
        this.activeRecoveries.clear();
        this.circuitBreakers.clear();
        this.fallbackProviders.clear();
        this.healthChecks.clear();
    }
}

export default ErrorRecoveryService;

