/**
 * Standardized Error Handling Module
 * 
 * This module provides a comprehensive error handling framework for the
 * X150-Valkyrie application, including standardized error types, handling
 * decorators, recovery mechanisms, and reporting utilities.
 */

// Core error types and definitions
export { ErrorCategory, ErrorSeverity, ErrorRecoveryStrategy, ERROR_CODES, ERROR_METADATA } from './ErrorTypes';
export { 
    getErrorMetadata, 
    isRetryableError, 
    isReportableError, 
    getUserMessage, 
    getTechnicalMessage, 
    getRecoveryStrategy,
    createErrorCode,
    isValidErrorCode,
    getErrorCodesForCategory,
    getErrorStatistics
} from './ErrorTypes';

// Enhanced error class
export { default as AppError } from './AppError';
export type { ErrorContext, ErrorRecoveryInfo } from './AppError';

// Error handling decorators and utilities
export {
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
} from './ErrorHandlers';
export type { ErrorHandlingConfig, ErrorAnalytics } from './ErrorHandlers';

// Enhanced error handler service
export { default as EnhancedErrorHandler } from './EnhancedErrorHandler';
export type { 
    ErrorHandlerConfig, 
    ErrorStatistics, 
    RecoveryResult 
} from './EnhancedErrorHandler';

// Convenience re-exports
import AppError from './AppError';
import { ERROR_CODES, ErrorCategory, ErrorSeverity } from './ErrorTypes';
import EnhancedErrorHandler from './EnhancedErrorHandler';
import {
    HandleErrors,
    HandleNetworkErrors,
    HandleWalletErrors,
    HandleTransactionErrors,
    HandleBluetoothErrors,
    HandleAPIErrors,
    HandleValidationErrors
} from './ErrorHandlers';

/**
 * Error handling utilities and shortcuts
 */
export const ErrorUtils = {
    // Error creation shortcuts
    createNetworkError: (code: string, message?: string, context?: any) => 
        AppError.network(code, message, context),
    
    createWalletError: (code: string, message?: string, context?: any) => 
        AppError.wallet(code, message, context),
    
    createTransactionError: (code: string, message?: string, context?: any) => 
        AppError.transaction(code, message, context),
    
    createAuthError: (code: string, message?: string, context?: any) => 
        AppError.authentication(code, message, context),
    
    createBluetoothError: (code: string, message?: string, context?: any) => 
        AppError.bluetooth(code, message, context),
    
    createAPIError: (code: string, message?: string, context?: any) => 
        AppError.api(code, message, context),
    
    createValidationError: (code: string, message?: string, context?: any) => 
        AppError.validation(code, message, context),
    
    createBusinessError: (code: string, message?: string, context?: any) => 
        AppError.business(code, message, context),
    
    // Common error codes shortcuts
    networkConnectionFailed: (message?: string, context?: any) => 
        AppError.network(ERROR_CODES.NET_CONNECTION_FAILED, message, context),
    
    walletNotInitialized: (message?: string, context?: any) => 
        AppError.wallet(ERROR_CODES.WAL_NOT_INITIALIZED, message, context),
    
    insufficientFunds: (message?: string, context?: any) => 
        AppError.wallet(ERROR_CODES.WAL_INSUFFICIENT_FUNDS, message, context),
    
    transactionFailed: (message?: string, context?: any) => 
        AppError.transaction(ERROR_CODES.TXN_SUBMIT_FAILED, message, context),
    
    bluetoothConnectionFailed: (message?: string, context?: any) => 
        AppError.bluetooth(ERROR_CODES.BLE_CONNECTION_FAILED, message, context),
    
    biometricUnavailable: (message?: string, context?: any) => 
        AppError.authentication(ERROR_CODES.AUTH_BIOMETRIC_UNAVAILABLE, message, context),
    
    invalidMnemonic: (message?: string, context?: any) => 
        AppError.wallet(ERROR_CODES.WAL_INVALID_MNEMONIC, message, context),
    
    // Error checking utilities
    isNetworkError: (error: Error | AppError) => 
        error instanceof AppError && error.category === ErrorCategory.NETWORK,
    
    isWalletError: (error: Error | AppError) => 
        error instanceof AppError && error.category === ErrorCategory.WALLET,
    
    isTransactionError: (error: Error | AppError) => 
        error instanceof AppError && error.category === ErrorCategory.TRANSACTION,
    
    isAuthError: (error: Error | AppError) => 
        error instanceof AppError && error.category === ErrorCategory.AUTHENTICATION,
    
    isBluetoothError: (error: Error | AppError) => 
        error instanceof AppError && error.category === ErrorCategory.BLUETOOTH,
    
    isCriticalError: (error: Error | AppError) => 
        error instanceof AppError && 
        (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.FATAL),
    
    isRetryableError: (error: Error | AppError) => 
        error instanceof AppError && error.canRetry()
};

/**
 * Error handling decorators collection
 */
export const ErrorDecorators = {
    HandleErrors,
    HandleNetworkErrors,
    HandleWalletErrors,
    HandleTransactionErrors,
    HandleBluetoothErrors,
    HandleAPIErrors,
    HandleValidationErrors
};

/**
 * Global error handler instance
 */
export const GlobalErrorHandler = {
    getInstance: () => EnhancedErrorHandler.getInstance(),
    
    // Quick access methods
    handle: async (error: Error | AppError, context?: any, options?: any) => {
        const handler = EnhancedErrorHandler.getInstance();
        return handler.handleError(error, context, options);
    },
    
    handleMultiple: async (errors: Array<Error | AppError>, context?: any) => {
        const handler = EnhancedErrorHandler.getInstance();
        return handler.handleErrors(errors, context);
    },
    
    getStats: () => {
        const handler = EnhancedErrorHandler.getInstance();
        return handler.getStatistics();
    },
    
    getHealth: () => {
        const handler = EnhancedErrorHandler.getInstance();
        return handler.getHealthStatus();
    },
    
    getRecent: (count?: number) => {
        const handler = EnhancedErrorHandler.getInstance();
        return handler.getRecentErrors(count);
    }
};

/**
 * Service-specific error handlers
 */
export const ServiceErrorHandlers = {
    // Wallet service errors
    wallet: {
        handleInitializationError: (error: Error, context?: any) =>
            ErrorUtils.createWalletError(ERROR_CODES.WAL_NOT_INITIALIZED, error.message, context),
        
        handleInsufficientFunds: (amount: string, balance: string, context?: any) =>
            ErrorUtils.createWalletError(ERROR_CODES.WAL_INSUFFICIENT_FUNDS, 
                `Insufficient funds: requested ${amount}, available ${balance}`, 
                { ...context, requestedAmount: amount, availableBalance: balance }),
        
        handleInvalidMnemonic: (context?: any) =>
            ErrorUtils.createWalletError(ERROR_CODES.WAL_INVALID_MNEMONIC, 
                'Invalid mnemonic phrase provided', context)
    },
    
    // Transaction errors
    transaction: {
        handleBuildError: (error: Error, context?: any) =>
            ErrorUtils.createTransactionError(ERROR_CODES.TXN_BUILD_FAILED, error.message, context),
        
        handleSubmissionError: (error: Error, context?: any) =>
            ErrorUtils.createTransactionError(ERROR_CODES.TXN_SUBMIT_FAILED, error.message, context),
        
        handleInsufficientFees: (required: string, available: string, context?: any) =>
            ErrorUtils.createTransactionError(ERROR_CODES.TXN_INSUFFICIENT_FEES,
                `Insufficient fees: required ${required}, available ${available}`,
                { ...context, requiredFees: required, availableFees: available })
    },
    
    // Network errors
    network: {
        handleConnectionError: (endpoint: string, error: Error, context?: any) =>
            ErrorUtils.createNetworkError(ERROR_CODES.NET_CONNECTION_FAILED,
                `Failed to connect to ${endpoint}: ${error.message}`,
                { ...context, endpoint, originalError: error.message }),
        
        handleTimeoutError: (endpoint: string, timeout: number, context?: any) =>
            ErrorUtils.createNetworkError(ERROR_CODES.NET_TIMEOUT,
                `Request to ${endpoint} timed out after ${timeout}ms`,
                { ...context, endpoint, timeout })
    },
    
    // Bluetooth errors
    bluetooth: {
        handleConnectionError: (deviceId: string, error: Error, context?: any) =>
            ErrorUtils.createBluetoothError(ERROR_CODES.BLE_CONNECTION_FAILED,
                `Failed to connect to device ${deviceId}: ${error.message}`,
                { ...context, deviceId, originalError: error.message }),
        
        handleNotEnabledError: (context?: any) =>
            ErrorUtils.createBluetoothError(ERROR_CODES.BLE_NOT_ENABLED,
                'Bluetooth is not enabled on this device', context)
    },
    
    // Authentication errors
    auth: {
        handleBiometricError: (error: Error, context?: any) =>
            ErrorUtils.createAuthError(ERROR_CODES.AUTH_BIOMETRIC_FAILED, error.message, context),
        
        handleBiometricUnavailable: (context?: any) =>
            ErrorUtils.createAuthError(ERROR_CODES.AUTH_BIOMETRIC_UNAVAILABLE,
                'Biometric authentication is not available', context)
    }
};

/**
 * Error boundary helpers for React components
 */
export const ErrorBoundaryHelpers = {
    createErrorBoundary: (fallbackComponent: any, onError?: (error: AppError) => void) => {
        // This would return a React Error Boundary component
        // Implementation would depend on React Native/React setup
        return null; // Placeholder
    },
    
    withErrorBoundary: (component: any, options?: any) => {
        // HOC for wrapping components with error boundary
        return component; // Placeholder
    }
};

// Default export for easy importing
export default {
    AppError,
    ErrorUtils,
    ErrorDecorators,
    GlobalErrorHandler,
    ServiceErrorHandlers,
    ErrorBoundaryHelpers,
    ERROR_CODES,
    ErrorCategory,
    ErrorSeverity
};

