/**
 * ErrorHandlers - Standardized Error Handling Decorators and Utilities
 * 
 * This module provides decorators, utilities, and patterns for consistent
 * error handling across all services in the application.
 */

import AppError, { ErrorContext } from './AppError';
import { ErrorCategory, ErrorSeverity, ERROR_CODES } from './ErrorTypes';
import logger from '../../utils/Logger';

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
    // Retry configuration
    maxRetries?: number;
    retryDelay?: number;
    retryCondition?: (error: AppError) => boolean;
    
    // Recovery configuration
    fallbackAction?: () => any;
    onError?: (error: AppError) => void;
    suppressReporting?: boolean;
    
    // Context enhancement
    contextEnhancer?: (context: ErrorContext) => ErrorContext;
    
    // Custom error mapping
    errorMapper?: (error: Error) => AppError;
    
    // Performance tracking
    trackPerformance?: boolean;
}

/**
 * Method error handling decorator
 */
export function HandleErrors(config: ErrorHandlingConfig = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const className = target.constructor.name;
        
        descriptor.value = async function (...args: any[]) {
            const startTime = performance.now();
            let attempt = 0;
            
            while (attempt <= (config.maxRetries || 0)) {
                try {
                    // Create base context
                    const baseContext: ErrorContext = {
                        service: className,
                        method: propertyKey,
                        operation: `${className}.${propertyKey}`,
                        correlationId: generateCorrelationId(),
                        ...(config.contextEnhancer ? config.contextEnhancer({}) : {})
                    };
                    
                    // Execute method
                    const result = await originalMethod.apply(this, args);
                    
                    // Track performance if enabled
                    if (config.trackPerformance) {
                        const duration = performance.now() - startTime;
                        logger.debug(`Method execution completed`, `${className}.${propertyKey}`, {
                            duration,
                            attempts: attempt + 1
                        });
                    }
                    
                    return result;
                    
                } catch (error) {
                    attempt++;
                    const duration = performance.now() - startTime;
                    
                    // Convert to AppError if needed
                    let appError: AppError;
                    if (error instanceof AppError) {
                        appError = error;
                    } else if (config.errorMapper) {
                        appError = config.errorMapper(error as Error);
                    } else {
                        appError = AppError.fromError(error as Error, ERROR_CODES.SYS_INITIALIZATION_FAILED, {
                            service: className,
                            method: propertyKey,
                            duration
                        });
                    }
                    
                    // Enhance context
                    appError = appError.withContext({
                        service: className,
                        method: propertyKey,
                        duration,
                        retryCount: attempt - 1
                    });
                    
                    // Check if should retry
                    const shouldRetry = attempt <= (config.maxRetries || 0) && 
                                      appError.canRetry() &&
                                      (!config.retryCondition || config.retryCondition(appError));
                    
                    if (shouldRetry) {
                        // Log retry attempt
                        logger.warn(`Retrying method after error`, `${className}.${propertyKey}`, {
                            errorCode: appError.code,
                            attempt,
                            maxRetries: config.maxRetries,
                            delay: config.retryDelay
                        });
                        
                        // Wait before retry
                        if (config.retryDelay) {
                            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
                        }
                        
                        continue;
                    }
                    
                    // No more retries, handle the error
                    try {
                        // Call custom error handler
                        if (config.onError) {
                            config.onError(appError);
                        }
                        
                        // Try fallback action
                        if (config.fallbackAction) {
                            logger.info(`Executing fallback action`, `${className}.${propertyKey}`, {
                                errorCode: appError.code
                            });
                            return config.fallbackAction();
                        }
                        
                        // Report error if not suppressed
                        if (!config.suppressReporting && appError.isReportable) {
                            await reportError(appError);
                        }
                        
                    } catch (handlingError) {
                        logger.error(`Error handling failed`, `${className}.${propertyKey}`, handlingError);
                    }
                    
                    // Re-throw the error
                    throw appError;
                }
            }
        };
        
        return descriptor;
    };
}

/**
 * Network operation error handling decorator
 */
export function HandleNetworkErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const networkConfig: ErrorHandlingConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        retryCondition: (error) => error.category === ErrorCategory.NETWORK,
        errorMapper: (error) => AppError.network(ERROR_CODES.NET_CONNECTION_FAILED, error.message),
        trackPerformance: true,
        ...config
    };
    
    return HandleErrors(networkConfig);
}

/**
 * Wallet operation error handling decorator
 */
export function HandleWalletErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const walletConfig: ErrorHandlingConfig = {
        maxRetries: 1,
        retryDelay: 500,
        retryCondition: (error) => error.category === ErrorCategory.WALLET && error.canRetry(),
        errorMapper: (error) => AppError.wallet(ERROR_CODES.WAL_NOT_INITIALIZED, error.message),
        trackPerformance: true,
        ...config
    };
    
    return HandleErrors(walletConfig);
}

/**
 * Transaction operation error handling decorator
 */
export function HandleTransactionErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const transactionConfig: ErrorHandlingConfig = {
        maxRetries: 2,
        retryDelay: 2000,
        retryCondition: (error) => error.category === ErrorCategory.TRANSACTION && 
                                 error.code !== ERROR_CODES.TXN_INSUFFICIENT_FEES,
        errorMapper: (error) => AppError.transaction(ERROR_CODES.TXN_BUILD_FAILED, error.message),
        trackPerformance: true,
        ...config
    };
    
    return HandleErrors(transactionConfig);
}

/**
 * Bluetooth operation error handling decorator
 */
export function HandleBluetoothErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const bluetoothConfig: ErrorHandlingConfig = {
        maxRetries: 2,
        retryDelay: 1500,
        retryCondition: (error) => error.category === ErrorCategory.BLUETOOTH &&
                                  error.code !== ERROR_CODES.BLE_NOT_SUPPORTED,
        errorMapper: (error) => AppError.bluetooth(ERROR_CODES.BLE_CONNECTION_FAILED, error.message),
        trackPerformance: true,
        ...config
    };
    
    return HandleErrors(bluetoothConfig);
}

/**
 * API operation error handling decorator
 */
export function HandleAPIErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const apiConfig: ErrorHandlingConfig = {
        maxRetries: 2,
        retryDelay: 2000,
        retryCondition: (error) => error.category === ErrorCategory.API &&
                                  error.code !== ERROR_CODES.API_AUTHENTICATION_FAILED,
        errorMapper: (error) => AppError.api(ERROR_CODES.API_INVALID_REQUEST, error.message),
        trackPerformance: true,
        ...config
    };
    
    return HandleErrors(apiConfig);
}

/**
 * Validation error handling decorator
 */
export function HandleValidationErrors(config: Partial<ErrorHandlingConfig> = {}) {
    const validationConfig: ErrorHandlingConfig = {
        maxRetries: 0, // No retries for validation errors
        suppressReporting: true, // Don't report validation errors
        errorMapper: (error) => AppError.validation(ERROR_CODES.VAL_INVALID_FORMAT, error.message),
        ...config
    };
    
    return HandleErrors(validationConfig);
}

// =============================================================================
// ERROR RECOVERY UTILITIES
// =============================================================================

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 10000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            
            if (attempt === maxRetries) {
                break; // No more retries
            }
            
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            
            logger.debug(`Retrying operation`, 'retryWithBackoff', {
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastError.message
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError!;
}

/**
 * Execute with fallback
 */
export async function executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    condition?: (error: Error) => boolean
): Promise<T> {
    try {
        return await primaryOperation();
    } catch (error) {
        const shouldUseFallback = !condition || condition(error as Error);
        
        if (shouldUseFallback) {
            logger.warn('Primary operation failed, using fallback', 'executeWithFallback', {
                error: (error as Error).message
            });
            return await fallbackOperation();
        }
        
        throw error;
    }
}

/**
 * Execute with timeout
 */
export async function executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutError?: AppError
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            const error = timeoutError || AppError.network(
                ERROR_CODES.NET_TIMEOUT,
                `Operation timed out after ${timeoutMs}ms`
            );
            reject(error);
        }, timeoutMs);
    });
    
    return Promise.race([operation(), timeoutPromise]);
}

/**
 * Execute with circuit breaker pattern
 */
export class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private maxFailures: number = 5,
        private resetTimeoutMs: number = 60000
    ) {}
    
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime < this.resetTimeoutMs) {
                throw AppError.network(
                    ERROR_CODES.NET_CONNECTION_FAILED,
                    'Circuit breaker is OPEN'
                );
            } else {
                this.state = 'HALF_OPEN';
            }
        }
        
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    
    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.maxFailures) {
            this.state = 'OPEN';
        }
    }
    
    getState(): { state: string; failures: number; lastFailureTime: number } {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime
        };
    }
}

// =============================================================================
// ERROR REPORTING UTILITIES
// =============================================================================

/**
 * Report error to monitoring service
 */
export async function reportError(error: AppError): Promise<void> {
    try {
        if (error.wasReported) {
            return; // Already reported
        }
        
        // Mark as reported to prevent duplicates
        error.markAsReported();
        
        // Log the error
        logger.error(`AppError reported: ${error.code}`, 'reportError', error.toLogSummary());
        
        // Send to external monitoring (Sentry, etc.)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            const Sentry = (window as any).Sentry;
            Sentry.withScope((scope: any) => {
                scope.setTag('errorCode', error.code);
                scope.setTag('errorCategory', error.category);
                scope.setLevel(getSentryLevel(error.severity));
                scope.setContext('appError', error.toDetailedInfo());
                
                if (error.context.userId) {
                    scope.setUser({ id: error.context.userId });
                }
                
                if (error.context.correlationId) {
                    scope.setTag('correlationId', error.context.correlationId);
                }
                
                Sentry.captureException(error);
            });
        }
        
        // Store for local analytics
        await storeErrorForAnalytics(error);
        
    } catch (reportingError) {
        logger.warn('Failed to report error', 'reportError', {
            originalError: error.code,
            reportingError: reportingError instanceof Error ? reportingError.message : reportingError
        });
    }
}

/**
 * Batch report multiple errors
 */
export async function batchReportErrors(errors: AppError[]): Promise<void> {
    const unreportedErrors = errors.filter(error => !error.wasReported);
    
    if (unreportedErrors.length === 0) {
        return;
    }
    
    try {
        // Report in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < unreportedErrors.length; i += batchSize) {
            const batch = unreportedErrors.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(error => reportError(error)));
        }
    } catch (error) {
        logger.error('Batch error reporting failed', 'batchReportErrors', error);
    }
}

// =============================================================================
// ERROR ANALYTICS
// =============================================================================

/**
 * Store error for analytics
 */
async function storeErrorForAnalytics(error: AppError): Promise<void> {
    try {
        // Store in local storage for analytics
        const errorData = {
            ...error.toLogSummary(),
            deviceInfo: getDeviceInfo(),
            appVersion: getAppVersion()
        };
        
        // You could store this in AsyncStorage, IndexedDB, etc.
        // For now, just log it
        logger.info('Error stored for analytics', 'storeErrorForAnalytics', errorData);
        
    } catch (error) {
        logger.warn('Failed to store error for analytics', 'storeErrorForAnalytics', error);
    }
}

/**
 * Get error trends and analytics
 */
export interface ErrorAnalytics {
    totalErrors: number;
    errorsByCategory: { [key: string]: number };
    errorsBySeverity: { [key: string]: number };
    topErrorCodes: Array<{ code: string; count: number }>;
    errorTrends: Array<{ timestamp: string; count: number }>;
    recoverableErrorsPercentage: number;
}

export async function getErrorAnalytics(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<ErrorAnalytics> {
    // This would typically query from storage
    // For now, return mock data structure
    return {
        totalErrors: 0,
        errorsByCategory: {},
        errorsBySeverity: {},
        topErrorCodes: [],
        errorTrends: [],
        recoverableErrorsPercentage: 0
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getSentryLevel(severity: ErrorSeverity): string {
    switch (severity) {
        case ErrorSeverity.TRACE:
        case ErrorSeverity.DEBUG:
            return 'debug';
        case ErrorSeverity.INFO:
            return 'info';
        case ErrorSeverity.WARN:
            return 'warning';
        case ErrorSeverity.ERROR:
            return 'error';
        case ErrorSeverity.FATAL:
        case ErrorSeverity.CRITICAL:
            return 'fatal';
        default:
            return 'error';
    }
}

function getDeviceInfo(): object {
    // Return device information for analytics
    return {
        platform: typeof window !== 'undefined' ? 'web' : 'mobile',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: new Date().toISOString()
    };
}

function getAppVersion(): string {
    // Return app version from constants or environment
    try {
        return process.env.APP_VERSION || '1.0.0';
    } catch {
        return '1.0.0';
    }
}

export default {
    HandleErrors,
    HandleNetworkErrors,
    HandleWalletErrors,
    HandleTransactionErrors,
    HandleBluetoothErrors,
    HandleAPIErrors,
    HandleValidationErrors,
    retryWithBackoff,
    executeWithFallback,
    executeWithTimeout,
    CircuitBreaker,
    reportError,
    batchReportErrors,
    getErrorAnalytics
};

