/**
 * EnhancedErrorHandler - Comprehensive Error Management Service
 * 
 * This service extends the existing ErrorHandler with enhanced capabilities
 * including error recovery, analytics, reporting, and integration with the
 * standardized error handling framework.
 */

import AppError, { ErrorContext } from './AppError';
import { ErrorCategory, ErrorSeverity, ERROR_CODES, getErrorMetadata } from './ErrorTypes';
import { reportError, batchReportErrors, ErrorAnalytics, getErrorAnalytics } from './ErrorHandlers';
import { environment } from '../../config/Environment';
import logger from '../../utils/Logger';

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
    // Reporting configuration
    enableRemoteReporting: boolean;
    enableLocalStorage: boolean;
    maxStoredErrors: number;
    batchReportingSize: number;
    batchReportingInterval: number;
    
    // Recovery configuration
    enableAutoRecovery: boolean;
    maxAutoRetries: number;
    retryDelayMs: number;
    
    // Analytics configuration
    enableAnalytics: boolean;
    analyticsRetentionDays: number;
    
    // Performance configuration
    errorBufferSize: number;
    reportingThrottleMs: number;
    
    // Security configuration
    sanitizeContext: boolean;
    excludeSensitiveData: boolean;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
    totalErrors: number;
    errorsByCategory: Map<ErrorCategory, number>;
    errorsBySeverity: Map<ErrorSeverity, number>;
    errorsByCode: Map<string, number>;
    recoveredErrors: number;
    reportedErrors: number;
    lastError?: AppError;
    lastErrorTime?: Date;
}

/**
 * Error recovery result
 */
export interface RecoveryResult {
    success: boolean;
    strategy: string;
    attempts: number;
    duration: number;
    error?: AppError;
}

/**
 * Enhanced Error Handler Service
 */
export class EnhancedErrorHandler {
    private static instance: EnhancedErrorHandler;
    private config: ErrorHandlerConfig;
    private errorBuffer: AppError[] = [];
    private errorStats: ErrorStatistics;
    private recoveryStrategies: Map<string, (error: AppError) => Promise<RecoveryResult>>;
    private reportingQueue: AppError[] = [];
    private lastReportingTime = 0;
    private reportingTimer?: any;
    
    private constructor(config?: Partial<ErrorHandlerConfig>) {
        this.config = {
            enableRemoteReporting: environment.get('ENVIRONMENT') === 'production',
            enableLocalStorage: true,
            maxStoredErrors: 1000,
            batchReportingSize: 10,
            batchReportingInterval: 30000, // 30 seconds
            enableAutoRecovery: true,
            maxAutoRetries: 3,
            retryDelayMs: 1000,
            enableAnalytics: true,
            analyticsRetentionDays: 7,
            errorBufferSize: 100,
            reportingThrottleMs: 1000,
            sanitizeContext: true,
            excludeSensitiveData: true,
            ...config
        };
        
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsBySeverity: new Map(),
            errorsByCode: new Map(),
            recoveredErrors: 0,
            reportedErrors: 0
        };
        
        this.recoveryStrategies = new Map();
        this.initializeRecoveryStrategies();
        this.startBatchReporting();
    }
    
    static getInstance(config?: Partial<ErrorHandlerConfig>): EnhancedErrorHandler {
        if (!EnhancedErrorHandler.instance) {
            EnhancedErrorHandler.instance = new EnhancedErrorHandler(config);
        }
        return EnhancedErrorHandler.instance;
    }
    
    /**
     * Handle an application error
     */
    async handleError(
        error: Error | AppError,
        context: ErrorContext = {},
        options: {
            suppressReporting?: boolean;
            suppressRecovery?: boolean;
            suppressUserNotification?: boolean;
        } = {}
    ): Promise<void> {
        try {
            // Convert to AppError if needed
            let appError: AppError;
            if (error instanceof AppError) {
                appError = error.withContext(context);
            } else {
                appError = AppError.fromError(error, ERROR_CODES.SYS_INITIALIZATION_FAILED, context);
            }
            
            // Update statistics
            this.updateStatistics(appError);
            
            // Add to buffer
            this.addToBuffer(appError);
            
            // Log the error
            this.logError(appError);
            
            // Attempt recovery if enabled
            if (!options.suppressRecovery && this.config.enableAutoRecovery) {
                const recoveryResult = await this.attemptRecovery(appError);
                if (recoveryResult.success) {
                    logger.info(`Error recovered successfully`, 'EnhancedErrorHandler.handleError', {
                        errorCode: appError.code,
                        strategy: recoveryResult.strategy,
                        attempts: recoveryResult.attempts
                    });
                    this.errorStats.recoveredErrors++;
                    return; // Error was recovered, no need to report
                }
            }
            
            // Queue for reporting if not suppressed
            if (!options.suppressReporting && this.config.enableRemoteReporting && appError.isReportable) {
                this.queueForReporting(appError);
            }
            
            // Notify user if not suppressed and severity warrants it
            if (!options.suppressUserNotification && this.shouldNotifyUser(appError)) {
                this.notifyUser(appError);
            }
            
            // Mark as handled
            appError.markAsHandled();
            
        } catch (handlingError) {
            // Error handling failed - log and continue
            logger.error('Error handling failed', 'EnhancedErrorHandler.handleError', handlingError);
        }
    }
    
    /**
     * Handle multiple errors in batch
     */
    async handleErrors(errors: Array<Error | AppError>, context: ErrorContext = {}): Promise<void> {
        const promises = errors.map(error => this.handleError(error, context, { suppressReporting: true }));
        await Promise.allSettled(promises);
        
        // Batch report all errors
        const appErrors = errors.map(error => 
            error instanceof AppError ? error : AppError.fromError(error, ERROR_CODES.SYS_INITIALIZATION_FAILED, context)
        );
        
        if (this.config.enableRemoteReporting) {
            await batchReportErrors(appErrors);
        }
    }
    
    /**
     * Register a custom recovery strategy
     */
    registerRecoveryStrategy(
        errorCode: string,
        strategy: (error: AppError) => Promise<RecoveryResult>
    ): void {
        this.recoveryStrategies.set(errorCode, strategy);
        logger.debug(`Recovery strategy registered for ${errorCode}`, 'EnhancedErrorHandler.registerRecoveryStrategy');
    }
    
    /**
     * Get error statistics
     */
    getStatistics(): ErrorStatistics {
        return {
            ...this.errorStats,
            errorsByCategory: new Map(this.errorStats.errorsByCategory),
            errorsBySeverity: new Map(this.errorStats.errorsBySeverity),
            errorsByCode: new Map(this.errorStats.errorsByCode)
        };
    }
    
    /**
     * Get error analytics
     */
    async getAnalytics(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<ErrorAnalytics> {
        if (!this.config.enableAnalytics) {
            throw new Error('Error analytics is disabled');
        }
        
        return await getErrorAnalytics(timeRange);
    }
    
    /**
     * Get recent errors from buffer
     */
    getRecentErrors(count: number = 10): AppError[] {
        return this.errorBuffer.slice(-count);
    }
    
    /**
     * Clear error buffer and statistics
     */
    clearErrors(): void {
        this.errorBuffer = [];
        this.reportingQueue = [];
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsBySeverity: new Map(),
            errorsByCode: new Map(),
            recoveredErrors: 0,
            reportedErrors: 0
        };
        
        logger.info('Error buffer and statistics cleared', 'EnhancedErrorHandler.clearErrors');
    }
    
    /**
     * Export errors for analysis
     */
    exportErrors(format: 'json' | 'csv' = 'json'): string {
        const errorData = this.errorBuffer.map(error => ({
            ...error.toLogSummary(),
            userMessage: error.userMessage,
            category: error.category,
            severity: error.severity,
            canRetry: error.canRetry(),
            wasReported: error.wasReported,
            wasHandled: error.wasHandled
        }));
        
        if (format === 'json') {
            return JSON.stringify(errorData, null, 2);
        } else {
            // Simple CSV export
            if (errorData.length === 0) return '';
            
            const headers = Object.keys(errorData[0]).join(',');
            const rows = errorData.map(row => Object.values(row).join(','));
            return [headers, ...rows].join('\n');
        }
    }
    
    /**
     * Configure error handler
     */
    updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        logger.info('Error handler configuration updated', 'EnhancedErrorHandler.updateConfig', newConfig);
    }
    
    /**
     * Health check for error handler
     */
    getHealthStatus(): {
        isHealthy: boolean;
        bufferSize: number;
        queueSize: number;
        lastError?: string;
        errorRate: number;
    } {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        const recentErrors = this.errorBuffer.filter(error => error.timestamp.getTime() > fiveMinutesAgo);
        
        return {
            isHealthy: recentErrors.length < 10, // Less than 10 errors in 5 minutes
            bufferSize: this.errorBuffer.length,
            queueSize: this.reportingQueue.length,
            lastError: this.errorStats.lastError?.code,
            errorRate: recentErrors.length / 5 // Errors per minute
        };
    }
    
    /**
     * Dispose error handler
     */
    dispose(): void {
        // Stop batch reporting
        if (this.reportingTimer) {
            clearInterval(this.reportingTimer);
        }
        
        // Report any remaining errors
        if (this.reportingQueue.length > 0) {
            batchReportErrors([...this.reportingQueue]).catch(error => {
                logger.warn('Failed to report remaining errors during disposal', 'EnhancedErrorHandler.dispose', error);
            });
        }
        
        // Clear all data
        this.clearErrors();
        
        logger.info('Enhanced error handler disposed', 'EnhancedErrorHandler.dispose');
    }
    
    // Private methods
    
    private updateStatistics(error: AppError): void {
        this.errorStats.totalErrors++;
        this.errorStats.lastError = error;
        this.errorStats.lastErrorTime = error.timestamp;
        
        // Update category counts
        const categoryCount = this.errorStats.errorsByCategory.get(error.category) || 0;
        this.errorStats.errorsByCategory.set(error.category, categoryCount + 1);
        
        // Update severity counts
        const severityCount = this.errorStats.errorsBySeverity.get(error.severity) || 0;
        this.errorStats.errorsBySeverity.set(error.severity, severityCount + 1);
        
        // Update code counts
        const codeCount = this.errorStats.errorsByCode.get(error.code) || 0;
        this.errorStats.errorsByCode.set(error.code, codeCount + 1);
    }
    
    private addToBuffer(error: AppError): void {
        this.errorBuffer.push(error);
        
        // Trim buffer if it exceeds max size
        if (this.errorBuffer.length > this.config.errorBufferSize) {
            this.errorBuffer = this.errorBuffer.slice(-this.config.errorBufferSize);
        }
    }
    
    private logError(error: AppError): void {
        const logLevel = this.getLogLevel(error.severity);
        const message = `[${error.code}] ${error.message}`;
        const context = 'EnhancedErrorHandler.logError';
        const data = error.toLogSummary();
        
        switch (logLevel) {
            case 'debug':
                logger.debug(message, context, data);
                break;
            case 'info':
                logger.info(message, context, data);
                break;
            case 'warn':
                logger.warn(message, context, data);
                break;
            case 'error':
            default:
                logger.error(message, context, data);
                break;
        }
    }
    
    private getLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
        switch (severity) {
            case ErrorSeverity.TRACE:
            case ErrorSeverity.DEBUG:
                return 'debug';
            case ErrorSeverity.INFO:
                return 'info';
            case ErrorSeverity.WARN:
                return 'warn';
            case ErrorSeverity.ERROR:
            case ErrorSeverity.FATAL:
            case ErrorSeverity.CRITICAL:
            default:
                return 'error';
        }
    }
    
    private async attemptRecovery(error: AppError): Promise<RecoveryResult> {
        const startTime = performance.now();
        let attempts = 0;
        
        try {
            // Check for custom recovery strategy
            const customStrategy = this.recoveryStrategies.get(error.code);
            if (customStrategy) {
                attempts++;
                const result = await customStrategy(error);
                result.duration = performance.now() - startTime;
                return result;
            }
            
            // Default recovery based on category and recovery strategy
            switch (error.recovery.strategy) {
                case 'RETRY':
                    return await this.retryRecovery(error);
                case 'FALLBACK':
                    return await this.fallbackRecovery(error);
                case 'RECONNECT':
                    return await this.reconnectRecovery(error);
                case 'REFRESH':
                    return await this.refreshRecovery(error);
                default:
                    return {
                        success: false,
                        strategy: 'NONE',
                        attempts: 0,
                        duration: performance.now() - startTime,
                        error
                    };
            }
            
        } catch (recoveryError) {
            return {
                success: false,
                strategy: 'FAILED',
                attempts,
                duration: performance.now() - startTime,
                error: AppError.fromError(recoveryError as Error)
            };
        }
    }
    
    private async retryRecovery(error: AppError): Promise<RecoveryResult> {
        // Simple retry recovery - just mark as recoverable
        return {
            success: error.canRetry(),
            strategy: 'RETRY',
            attempts: 1,
            duration: 0
        };
    }
    
    private async fallbackRecovery(error: AppError): Promise<RecoveryResult> {
        // Fallback recovery - application-specific logic would go here
        return {
            success: true,
            strategy: 'FALLBACK',
            attempts: 1,
            duration: 0
        };
    }
    
    private async reconnectRecovery(error: AppError): Promise<RecoveryResult> {
        // Reconnection recovery - would trigger reconnection logic
        return {
            success: false, // Not implemented yet
            strategy: 'RECONNECT',
            attempts: 1,
            duration: 0
        };
    }
    
    private async refreshRecovery(error: AppError): Promise<RecoveryResult> {
        // Refresh recovery - would trigger data refresh
        return {
            success: false, // Not implemented yet
            strategy: 'REFRESH',
            attempts: 1,
            duration: 0
        };
    }
    
    private queueForReporting(error: AppError): void {
        // Check throttling
        const now = Date.now();
        if (now - this.lastReportingTime < this.config.reportingThrottleMs) {
            return; // Throttled
        }
        
        this.reportingQueue.push(error);
        this.lastReportingTime = now;
        
        // Immediate report for critical errors
        if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.FATAL) {
            this.flushReportingQueue();
        }
    }
    
    private shouldNotifyUser(error: AppError): boolean {
        // Don't notify for low severity or debug errors
        if (error.severity === ErrorSeverity.TRACE || 
            error.severity === ErrorSeverity.DEBUG ||
            error.severity === ErrorSeverity.INFO) {
            return false;
        }
        
        // Don't notify for validation errors
        if (error.category === ErrorCategory.VALIDATION) {
            return false;
        }
        
        return true;
    }
    
    private notifyUser(error: AppError): void {
        // This would integrate with the UI notification system
        logger.info('User notification triggered', 'EnhancedErrorHandler.notifyUser', {
            errorCode: error.code,
            userMessage: error.userMessage,
            severity: error.severity
        });
    }
    
    private startBatchReporting(): void {
        this.reportingTimer = setInterval(() => {
            this.flushReportingQueue();
        }, this.config.batchReportingInterval);
    }
    
    private async flushReportingQueue(): Promise<void> {
        if (this.reportingQueue.length === 0) {
            return;
        }
        
        try {
            const errorsToReport = this.reportingQueue.splice(0, this.config.batchReportingSize);
            await batchReportErrors(errorsToReport);
            this.errorStats.reportedErrors += errorsToReport.length;
            
            logger.debug('Error batch reported', 'EnhancedErrorHandler.flushReportingQueue', {
                count: errorsToReport.length,
                remainingInQueue: this.reportingQueue.length
            });
            
        } catch (error) {
            logger.error('Failed to flush reporting queue', 'EnhancedErrorHandler.flushReportingQueue', error);
        }
    }
    
    private initializeRecoveryStrategies(): void {
        // Network recovery strategies
        this.registerRecoveryStrategy(ERROR_CODES.NET_CONNECTION_FAILED, async (error) => {
            // Would implement network reconnection logic
            return { success: false, strategy: 'NETWORK_RECONNECT', attempts: 1, duration: 0 };
        });
        
        // Wallet recovery strategies
        this.registerRecoveryStrategy(ERROR_CODES.WAL_NOT_INITIALIZED, async (error) => {
            // Would implement wallet re-initialization logic
            return { success: false, strategy: 'WALLET_REINIT', attempts: 1, duration: 0 };
        });
        
        // Add more recovery strategies as needed
    }
}

export default EnhancedErrorHandler;
