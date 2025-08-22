import { DI } from './index';
import logger from '../../utils/Logger';
import { environment } from '../../config/Environment';

/**
 * DIInitializer - Handles initialization of the dependency injection system
 * 
 * This class manages the startup sequence for the DI container and provides
 * error handling, retry logic, and graceful fallbacks for service registration.
 */
export class DIInitializer {
    private static initializationPromise: Promise<void> | null = null;
    private static initializationAttempts = 0;
    private static readonly MAX_RETRY_ATTEMPTS = 3;
    private static readonly RETRY_DELAY_MS = 1000;

    /**
     * Initialize DI system with retry logic
     */
    static async initialize(): Promise<void> {
        // Return existing promise if initialization is in progress
        if (DIInitializer.initializationPromise) {
            return DIInitializer.initializationPromise;
        }

        DIInitializer.initializationPromise = DIInitializer.performInitialization();
        return DIInitializer.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    private static async performInitialization(): Promise<void> {
        const startTime = performance.now();

        try {
            logger.info('Starting DI system initialization', 'DIInitializer.performInitialization', {
                attempt: DIInitializer.initializationAttempts + 1,
                maxAttempts: DIInitializer.MAX_RETRY_ATTEMPTS
            });

            DIInitializer.initializationAttempts++;

            // Check if already initialized
            if (DI.isInitialized) {
                logger.debug('DI system already initialized', 'DIInitializer.performInitialization');
                return;
            }

            // Determine configuration mode
            const useMinimalConfig = DIInitializer.shouldUseMinimalConfig();

            // Initialize DI system
            await DI.initialize(useMinimalConfig);

            // Validate initialization
            await DIInitializer.validateInitialization();

            // Run post-initialization tasks
            await DIInitializer.runPostInitializationTasks();

            const elapsedTime = performance.now() - startTime;

            logger.info('DI system initialization completed successfully', 'DIInitializer.performInitialization', {
                elapsedTime: Math.round(elapsedTime),
                serviceCount: DI.serviceCount,
                useMinimalConfig,
                attempts: DIInitializer.initializationAttempts
            });

        } catch (error) {
            logger.error('DI system initialization failed', 'DIInitializer.performInitialization', {
                error,
                attempts: DIInitializer.initializationAttempts,
                elapsedTime: Math.round(performance.now() - startTime)
            });

            // Retry logic
            if (DIInitializer.initializationAttempts < DIInitializer.MAX_RETRY_ATTEMPTS) {
                logger.warn(`Retrying DI initialization in ${DIInitializer.RETRY_DELAY_MS}ms`, 'DIInitializer.performInitialization', {
                    nextAttempt: DIInitializer.initializationAttempts + 1
                });

                // Reset promise to allow retry
                DIInitializer.initializationPromise = null;

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, DIInitializer.RETRY_DELAY_MS));

                // Recursive retry
                return DIInitializer.initialize();
            } else {
                logger.error('Max retry attempts reached for DI initialization', 'DIInitializer.performInitialization');
                throw new Error(`DI initialization failed after ${DIInitializer.MAX_RETRY_ATTEMPTS} attempts: ${error}`);
            }
        }
    }

    /**
     * Determine if minimal configuration should be used
     */
    private static shouldUseMinimalConfig(): boolean {
        try {
            // Use minimal config in development or test environments
            const envType = environment.get('ENVIRONMENT');
            const isTest = envType === 'test' || process.env.NODE_ENV === 'test';
            const isDev = envType === 'development' || __DEV__;

            // Check for specific flags
            const forceMinimal = environment.get('USE_MINIMAL_DI') || process.env.USE_MINIMAL_DI;
            const forceFull = environment.get('USE_FULL_DI') || process.env.USE_FULL_DI;

            if (forceFull) return false;
            if (forceMinimal) return true;

            // Default logic
            return isTest || (isDev && !forceFull);

        } catch (error) {
            logger.warn('Failed to determine DI config mode, using full config', 'DIInitializer.shouldUseMinimalConfig', error);
            return false;
        }
    }

    /**
     * Validate that initialization was successful
     */
    private static async validateInitialization(): Promise<void> {
        try {
            // Check basic DI functionality
            if (!DI.isInitialized) {
                throw new Error('DI system reports as not initialized');
            }

            // Validate container
            const validation = DI.container().validate();
            if (!validation.isValid) {
                throw new Error(`DI validation failed: ${validation.errors.join(', ')}`);
            }

            // Test critical service resolution
            const criticalServices = [
                'Logger',
                'Environment',
                'ErrorHandler',
                'NetworkService'
            ];

            for (const serviceToken of criticalServices) {
                try {
                    const service = DI.tryResolve(serviceToken);
                    if (!service) {
                        logger.warn(`Critical service '${serviceToken}' not available`, 'DIInitializer.validateInitialization');
                    }
                } catch (error) {
                    logger.warn(`Failed to resolve critical service '${serviceToken}'`, 'DIInitializer.validateInitialization', error);
                }
            }

            logger.debug('DI initialization validation passed', 'DIInitializer.validateInitialization', {
                serviceCount: DI.serviceCount,
                criticalServicesChecked: criticalServices.length
            });

        } catch (error) {
            logger.error('DI initialization validation failed', 'DIInitializer.validateInitialization', error);
            throw new Error(`DI validation failed: ${error}`);
        }
    }

    /**
     * Run post-initialization tasks
     */
    private static async runPostInitializationTasks(): Promise<void> {
        try {
            // Initialize critical services that require setup
            const tasksToRun: Array<() => Promise<void>> = [];

            // Error handler initialization
            tasksToRun.push(async () => {
                try {
                    const errorHandler = DI.tryResolve('ErrorHandler');
                    if (errorHandler && typeof (errorHandler as any).initialize === 'function') {
                        await (errorHandler as any).initialize();
                    }
                } catch (error) {
                    logger.warn('Error handler post-init failed', 'DIInitializer.runPostInitializationTasks', error);
                }
            });

            // Performance monitor initialization
            tasksToRun.push(async () => {
                try {
                    const perfMonitor = DI.tryResolve('PerformanceMonitor');
                    if (perfMonitor && typeof (perfMonitor as any).startMonitoring === 'function') {
                        (perfMonitor as any).startMonitoring();
                    }
                } catch (error) {
                    logger.warn('Performance monitor post-init failed', 'DIInitializer.runPostInitializationTasks', error);
                }
            });

            // Run all tasks
            await Promise.allSettled(tasksToRun.map(task => task()));

            logger.debug('Post-initialization tasks completed', 'DIInitializer.runPostInitializationTasks', {
                taskCount: tasksToRun.length
            });

        } catch (error) {
            // Log but don't fail - post-init tasks are optional
            logger.warn('Some post-initialization tasks failed', 'DIInitializer.runPostInitializationTasks', error);
        }
    }

    /**
     * Get initialization status
     */
    static getStatus(): {
        isInitialized: boolean;
        attempts: number;
        serviceCount: number;
        isInProgress: boolean;
    } {
        return {
            isInitialized: DI.isInitialized,
            attempts: DIInitializer.initializationAttempts,
            serviceCount: DI.serviceCount,
            isInProgress: !!DIInitializer.initializationPromise && !DI.isInitialized
        };
    }

    /**
     * Force reset initialization state (for testing)
     */
    static reset(): void {
        DIInitializer.initializationPromise = null;
        DIInitializer.initializationAttempts = 0;
        DI.reset();
        logger.debug('DI initializer reset', 'DIInitializer.reset');
    }

    /**
     * Create initialization health check
     */
    static createHealthCheck(): () => Promise<{ healthy: boolean; details: any }> {
        return async () => {
            try {
                const status = DIInitializer.getStatus();
                const metrics = DI.isInitialized ? DI.getMetrics() : new Map();
                const metadata = DI.isInitialized ? DI.getAllMetadata() : [];

                const healthy = DI.isInitialized && status.serviceCount > 0;

                return {
                    healthy,
                    details: {
                        status,
                        metrics: Object.fromEntries(metrics),
                        serviceCount: metadata.length,
                        services: metadata.map(m => ({
                            token: m.token,
                            lifetime: m.lifetime,
                            hasInstance: m.hasInstance,
                            dependencyCount: m.dependencies.length
                        }))
                    }
                };

            } catch (error) {
                return {
                    healthy: false,
                    details: {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        status: DIInitializer.getStatus()
                    }
                };
            }
        };
    }

    /**
     * Initialize DI with error boundaries and fallbacks
     */
    static async safeInitialize(): Promise<{
        success: boolean;
        error?: string;
        fallbackMode?: boolean;
    }> {
        try {
            await DIInitializer.initialize();
            return { success: true };

        } catch (error) {
            logger.error('DI initialization completely failed, attempting fallback', 'DIInitializer.safeInitialize', error);

            try {
                // Try minimal config as fallback
                DI.reset();
                await DI.initialize(true);

                logger.warn('DI initialized in fallback minimal mode', 'DIInitializer.safeInitialize');

                return {
                    success: true,
                    fallbackMode: true
                };

            } catch (fallbackError) {
                logger.error('DI fallback initialization also failed', 'DIInitializer.safeInitialize', fallbackError);

                return {
                    success: false,
                    error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
                };
            }
        }
    }
}

export default DIInitializer;

