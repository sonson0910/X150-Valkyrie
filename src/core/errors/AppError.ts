/**
 * AppError - Standardized Error Class for X150-Valkyrie
 * 
 * This module provides a comprehensive error class that extends the native Error
 * with additional metadata, context, and standardized error handling capabilities.
 */

import { ErrorCategory, ErrorSeverity, ErrorRecoveryStrategy, ERROR_CODES, getErrorMetadata, getUserMessage, getTechnicalMessage, getRecoveryStrategy } from './ErrorTypes';
import logger from '../../utils/Logger';

/**
 * Enhanced error context interface
 */
export interface ErrorContext {
    // Service context
    service?: string;
    method?: string;
    operation?: string;
    
    // User context
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    
    // Request context
    requestId?: string;
    correlationId?: string;
    traceId?: string;
    
    // Business context
    walletId?: string;
    transactionId?: string;
    accountId?: string;
    
    // Technical context
    component?: string;
    version?: string;
    buildNumber?: string;
    
    // Additional metadata
    metadata?: { [key: string]: any };
    
    // Stack trace context
    stackTrace?: string;
    innerError?: Error;
    
    // Performance context
    duration?: number;
    memoryUsage?: number;
    
    // Network context
    endpoint?: string;
    httpStatus?: number;
    retryCount?: number;
}

/**
 * Error recovery information
 */
export interface ErrorRecoveryInfo {
    strategy: ErrorRecoveryStrategy;
    canRetry: boolean;
    maxRetries?: number;
    retryDelay?: number;
    fallbackAction?: string;
    userAction?: string;
    recoverySteps?: string[];
}

/**
 * Standardized Application Error Class
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly timestamp: Date;
    public readonly context: ErrorContext;
    public readonly recovery: ErrorRecoveryInfo;
    public readonly userMessage: string;
    public readonly technicalMessage: string;
    public readonly isReportable: boolean;
    
    // Error tracking
    public readonly errorId: string;
    public retryCount: number = 0;
    public wasReported: boolean = false;
    public wasHandled: boolean = false;
    
    constructor(
        code: string,
        message?: string,
        context: ErrorContext = {},
        innerError?: Error
    ) {
        // Get metadata for the error code
        const metadata = getErrorMetadata(code);
        
        // Use provided message or fall back to technical message from metadata
        const finalMessage = message || getTechnicalMessage(code);
        
        super(finalMessage);
        
        // Set error name and ensure proper prototype chain
        this.name = 'AppError';
        Object.setPrototypeOf(this, AppError.prototype);
        
        // Core error properties
        this.code = code;
        this.category = metadata?.category ?? ErrorCategory.UNKNOWN;
        this.severity = metadata?.severity ?? ErrorSeverity.ERROR;
        this.timestamp = new Date();
        this.errorId = this.generateErrorId();
        
        // Error context
        this.context = {
            ...context,
            stackTrace: this.stack,
            innerError: innerError
        };
        
        // Recovery information
        this.recovery = {
            strategy: getRecoveryStrategy(code),
            canRetry: metadata?.retryable ?? false,
            maxRetries: this.getMaxRetries(),
            retryDelay: this.getRetryDelay(),
            fallbackAction: this.getFallbackAction(),
            userAction: this.getUserAction(),
            recoverySteps: this.getRecoverySteps()
        };
        
        // User and technical messages
        this.userMessage = getUserMessage(code);
        this.technicalMessage = getTechnicalMessage(code);
        this.isReportable = metadata?.reportable ?? true;
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
        
        // Log error creation
        this.logCreation();
    }
    
    /**
     * Create error from existing error
     */
    static fromError(error: Error, code?: string, context: ErrorContext = {}): AppError {
        const errorCode = code || ERROR_CODES.SYS_INITIALIZATION_FAILED;
        const enhancedContext = {
            ...context,
            innerError: error,
            stackTrace: error.stack
        };
        
        return new AppError(errorCode, error.message, enhancedContext);
    }
    
    /**
     * Create network error
     */
    static network(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'network'
        });
    }
    
    /**
     * Create wallet error
     */
    static wallet(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'wallet'
        });
    }
    
    /**
     * Create transaction error
     */
    static transaction(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'transaction'
        });
    }
    
    /**
     * Create authentication error
     */
    static authentication(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'authentication'
        });
    }
    
    /**
     * Create Bluetooth error
     */
    static bluetooth(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'bluetooth'
        });
    }
    
    /**
     * Create API error
     */
    static api(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'api'
        });
    }
    
    /**
     * Create validation error
     */
    static validation(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'validation'
        });
    }
    
    /**
     * Create business rule error
     */
    static business(code: string, message?: string, context: ErrorContext = {}): AppError {
        return new AppError(code, message, {
            ...context,
            component: 'business'
        });
    }
    
    /**
     * Check if error can be retried
     */
    canRetry(): boolean {
        return this.recovery.canRetry && 
               (this.recovery.maxRetries === undefined || this.retryCount < this.recovery.maxRetries);
    }
    
    /**
     * Increment retry count
     */
    incrementRetry(): void {
        this.retryCount++;
    }
    
    /**
     * Mark as reported
     */
    markAsReported(): void {
        this.wasReported = true;
    }
    
    /**
     * Mark as handled
     */
    markAsHandled(): void {
        this.wasHandled = true;
    }
    
    /**
     * Get error summary for logging
     */
    toLogSummary(): object {
        return {
            errorId: this.errorId,
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            userMessage: this.userMessage,
            timestamp: this.timestamp.toISOString(),
            retryCount: this.retryCount,
            canRetry: this.canRetry(),
            service: this.context.service,
            method: this.context.method,
            userId: this.context.userId,
            correlationId: this.context.correlationId,
            duration: this.context.duration
        };
    }
    
    /**
     * Get detailed error information
     */
    toDetailedInfo(): object {
        return {
            // Core error info
            errorId: this.errorId,
            code: this.code,
            category: this.category,
            severity: this.severity,
            message: this.message,
            userMessage: this.userMessage,
            technicalMessage: this.technicalMessage,
            timestamp: this.timestamp.toISOString(),
            
            // Error state
            retryCount: this.retryCount,
            wasReported: this.wasReported,
            wasHandled: this.wasHandled,
            isReportable: this.isReportable,
            
            // Recovery info
            recovery: this.recovery,
            
            // Context (sanitized)
            context: this.getSanitizedContext(),
            
            // Stack trace (if available)
            stackTrace: this.stack
        };
    }
    
    /**
     * Serialize error for transport
     */
    toJSON(): object {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            category: this.category,
            severity: this.severity,
            timestamp: this.timestamp.toISOString(),
            errorId: this.errorId,
            retryCount: this.retryCount,
            context: this.getSanitizedContext()
        };
    }
    
    /**
     * Create a copy of this error with additional context
     */
    withContext(additionalContext: Partial<ErrorContext>): AppError {
        const newContext = { ...this.context, ...additionalContext };
        const newError = new AppError(this.code, this.message, newContext);
        newError.retryCount = this.retryCount;
        newError.wasReported = this.wasReported;
        newError.wasHandled = this.wasHandled;
        return newError;
    }
    
    /**
     * Create a copy with incremented retry count
     */
    withRetry(): AppError {
        const retryError = this.withContext({});
        retryError.retryCount = this.retryCount + 1;
        return retryError;
    }
    
    // Private helper methods
    
    private generateErrorId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `err_${timestamp}_${random}`;
    }
    
    private getMaxRetries(): number {
        switch (this.category) {
            case ErrorCategory.NETWORK:
                return 3;
            case ErrorCategory.API:
                return 2;
            case ErrorCategory.BLUETOOTH:
                return 2;
            case ErrorCategory.STORAGE:
                return 1;
            default:
                return 0;
        }
    }
    
    private getRetryDelay(): number {
        switch (this.category) {
            case ErrorCategory.NETWORK:
                return Math.min(1000 * Math.pow(2, this.retryCount), 10000); // Exponential backoff
            case ErrorCategory.API:
                return 2000 + (this.retryCount * 1000);
            case ErrorCategory.BLUETOOTH:
                return 1500;
            default:
                return 1000;
        }
    }
    
    private getFallbackAction(): string | undefined {
        switch (this.recovery.strategy) {
            case ErrorRecoveryStrategy.FALLBACK:
                return 'Use alternative method or cached data';
            case ErrorRecoveryStrategy.RECONNECT:
                return 'Attempt to reconnect to service';
            case ErrorRecoveryStrategy.REFRESH:
                return 'Refresh data from source';
            default:
                return undefined;
        }
    }
    
    private getUserAction(): string | undefined {
        switch (this.recovery.strategy) {
            case ErrorRecoveryStrategy.USER_ACTION:
                return 'User intervention required';
            case ErrorRecoveryStrategy.RESTART:
                return 'Restart application';
            default:
                return undefined;
        }
    }
    
    private getRecoverySteps(): string[] {
        const steps: string[] = [];
        
        switch (this.recovery.strategy) {
            case ErrorRecoveryStrategy.RETRY:
                steps.push('Wait for retry delay');
                steps.push('Retry the operation');
                break;
            case ErrorRecoveryStrategy.FALLBACK:
                steps.push('Switch to fallback mechanism');
                steps.push('Notify user of limited functionality');
                break;
            case ErrorRecoveryStrategy.USER_ACTION:
                steps.push('Display error message to user');
                steps.push('Provide guidance for resolution');
                break;
            case ErrorRecoveryStrategy.RECONNECT:
                steps.push('Close existing connections');
                steps.push('Re-establish connection');
                steps.push('Retry operation');
                break;
        }
        
        return steps;
    }
    
    private getSanitizedContext(): Partial<ErrorContext> {
        const sanitized = { ...this.context };
        
        // Remove sensitive information
        delete sanitized.userId;
        delete sanitized.sessionId;
        delete sanitized.deviceId;
        delete sanitized.walletId;
        delete sanitized.accountId;
        
        // Sanitize metadata
        if (sanitized.metadata) {
            const sanitizedMetadata = { ...sanitized.metadata };
            delete sanitizedMetadata.password;
            delete sanitizedMetadata.privateKey;
            delete sanitizedMetadata.mnemonic;
            delete sanitizedMetadata.seed;
            delete sanitizedMetadata.token;
            sanitized.metadata = sanitizedMetadata;
        }
        
        return sanitized;
    }
    
    private logCreation(): void {
        try {
            logger.debug(`AppError created: ${this.code}`, 'AppError.constructor', {
                errorId: this.errorId,
                code: this.code,
                category: this.category,
                severity: this.severity,
                service: this.context.service,
                method: this.context.method
            });
        } catch (error) {
            // Ignore logging errors during error creation
        }
    }
}

export default AppError;

