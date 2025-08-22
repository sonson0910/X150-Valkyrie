import { Alert, AlertButton } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventBus } from './EventBus';
import { GlobalErrorHandler, AppError as StandardizedAppError, ErrorUtils, ERROR_CODES } from '../core/errors';
import logger from '../utils/Logger';

export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTHENTICATION = 'AUTHENTICATION',
    TRANSACTION = 'TRANSACTION',
    WALLET = 'WALLET',
    CRYPTO = 'CRYPTO',
    STORAGE = 'STORAGE',
    BLUETOOTH = 'BLUETOOTH',
    BIOMETRIC = 'BIOMETRIC',
    UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

// Legacy error interface for backward compatibility
export interface LegacyAppError {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    code?: string;
    details?: any;
    timestamp: Date;
    userId?: string;
    context?: string;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLog: LegacyAppError[] = [];
    private isProduction: boolean = false; // Configure based on environment
    private enhancedHandler: any; // Will be initialized lazily

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Initialize enhanced error handler integration
     */
    private getEnhancedHandler() {
        if (!this.enhancedHandler) {
            this.enhancedHandler = GlobalErrorHandler.getInstance();
        }
        return this.enhancedHandler;
    }

    /**
     * Xử lý lỗi với logging và user feedback
     * Enhanced with standardized error handling
     */
    async handleError(
        error: Error | string | StandardizedAppError,
        context?: string,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        type: ErrorType = ErrorType.UNKNOWN
    ): Promise<void> {
        try {
            // Create legacy error for backward compatibility
            const legacyError: LegacyAppError = {
                type,
                severity,
                message: typeof error === 'string' ? error : error.message,
                code: typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
                details: typeof error === 'object' ? error : undefined,
                timestamp: new Date(),
                context
            };

            // Handle with legacy system first for backward compatibility
            this.logError(legacyError);
            this.showUserFeedback(legacyError);

            // Convert to standardized error and handle with enhanced system
            let standardizedError: StandardizedAppError;
            
            if (error instanceof StandardizedAppError) {
                standardizedError = error;
            } else {
                // Map legacy error types to standardized error codes
                const errorCode = this.mapLegacyToStandardizedCode(type);
                const errorContext = {
                    service: 'ErrorHandler',
                    method: 'handleError',
                    legacyType: type,
                    legacySeverity: severity,
                    context: context
                };
                
                if (typeof error === 'string') {
                    standardizedError = new StandardizedAppError(errorCode, error, errorContext);
                } else {
                    standardizedError = StandardizedAppError.fromError(error, errorCode, errorContext);
                }
            }

            // Handle with enhanced error handler
            const enhancedHandler = this.getEnhancedHandler();
            await enhancedHandler.handle(standardizedError, { 
                legacyHandled: true,
                service: 'ErrorHandler'
            }, {
                suppressUserNotification: true // Already handled by legacy system
            });

            logger.debug('Error handled with both legacy and enhanced systems', 'ErrorHandler.handleError', {
                legacyType: type,
                standardizedCode: standardizedError.code,
                severity: severity
            });

        } catch (handlingError) {
            // If enhanced handling fails, continue with legacy system only
            logger.warn('Enhanced error handling failed, using legacy only', 'ErrorHandler.handleError', handlingError);
            
            const fallbackError: LegacyAppError = {
                type,
                severity,
                message: typeof error === 'string' ? error : error.message,
                code: typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
                details: typeof error === 'object' ? error : undefined,
                timestamp: new Date(),
                context
            };
            
            this.logError(fallbackError);
            if (this.isProduction) {
                this.sendToMonitoring(fallbackError);
            }
            this.showUserFeedback(fallbackError);
        }
    }

    /**
     * Map legacy error types to standardized error codes
     */
    private mapLegacyToStandardizedCode(type: ErrorType): string {
        switch (type) {
            case ErrorType.NETWORK:
                return ERROR_CODES.NET_CONNECTION_FAILED;
            case ErrorType.AUTHENTICATION:
                return ERROR_CODES.AUTH_INVALID_CREDENTIALS;
            case ErrorType.TRANSACTION:
                return ERROR_CODES.TXN_BUILD_FAILED;
            case ErrorType.WALLET:
                return ERROR_CODES.WAL_NOT_INITIALIZED;
            case ErrorType.CRYPTO:
                return ERROR_CODES.CRY_ENCRYPTION_FAILED;
            case ErrorType.STORAGE:
                return ERROR_CODES.STG_READ_FAILED;
            case ErrorType.BLUETOOTH:
                return ERROR_CODES.BLE_CONNECTION_FAILED;
            case ErrorType.BIOMETRIC:
                return ERROR_CODES.AUTH_BIOMETRIC_FAILED;
            case ErrorType.UNKNOWN:
            default:
                return ERROR_CODES.SYS_INITIALIZATION_FAILED;
        }
    }

    /**
     * Enhanced error handling methods for direct standardized error handling
     */
    async handleStandardizedError(error: StandardizedAppError): Promise<void> {
        const enhancedHandler = this.getEnhancedHandler();
        await enhancedHandler.handle(error, { service: 'ErrorHandler' });
    }

    /**
     * Create and handle standardized errors with convenient methods
     */
    async handleNetworkError(message: string, context?: any): Promise<void> {
        const error = ErrorUtils.createNetworkError(ERROR_CODES.NET_CONNECTION_FAILED, message, context);
        await this.handleStandardizedError(error);
    }

    async handleWalletError(message: string, context?: any): Promise<void> {
        const error = ErrorUtils.createWalletError(ERROR_CODES.WAL_NOT_INITIALIZED, message, context);
        await this.handleStandardizedError(error);
    }

    async handleTransactionError(message: string, context?: any): Promise<void> {
        const error = ErrorUtils.createTransactionError(ERROR_CODES.TXN_BUILD_FAILED, message, context);
        await this.handleStandardizedError(error);
    }

    async handleBluetoothError(message: string, context?: any): Promise<void> {
        const error = ErrorUtils.createBluetoothError(ERROR_CODES.BLE_CONNECTION_FAILED, message, context);
        await this.handleStandardizedError(error);
    }

    /**
     * Get error statistics from enhanced handler
     */
    getEnhancedStatistics() {
        const enhancedHandler = this.getEnhancedHandler();
        return enhancedHandler.getStats();
    }

    /**
     * Get recent errors from enhanced handler
     */
    getRecentEnhancedErrors(count?: number) {
        const enhancedHandler = this.getEnhancedHandler();
        return enhancedHandler.getRecent(count);
    }

    /**
     * Log error vào local storage và console
     */
    private logError(error: LegacyAppError): void {
        // Add to memory log
        this.errorLog.push(error);

        // Keep only last 100 errors
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-100);
        }

        // Log with enhanced logger
        logger.error(`[${error.type}] ${error.severity}: ${error.message}`, 'ErrorHandler.logError', {
            context: error.context,
            details: error.details,
            timestamp: error.timestamp.toISOString(),
            code: error.code
        });

        // Save to AsyncStorage for debugging
        this.saveErrorLog();
    }

    /**
     * Gửi error đến monitoring service (Sentry)
     */
    private async sendToMonitoring(error: LegacyAppError): Promise<void> {
        try {
            const dsn = (process.env as any)?.SENTRY_DSN;
            if (!dsn || !this.isProduction) return;
            try {
                const Sentry = require('@sentry/react-native');
                if (!Sentry?._valkyrieInited) {
                    Sentry.init({
                        dsn,
                        environment: 'production',
                        enableAutoSessionTracking: true,
                        tracesSampleRate: 0.1,
                        debug: false,
                        beforeSend: (event: any) => {
                            if (event.user) {
                                delete event.user.ip_address;
                                delete event.user.email;
                            }
                            return event;
                        }
                    });
                    Sentry._valkyrieInited = true;
                }
                Sentry.captureMessage(`[${error.type}] ${error.message}`);
            } catch (sentryError) {
                logger.warn('Failed to initialize Sentry', 'ErrorHandler.sendToMonitoring', sentryError);
            }
        } catch (monitoringError) {
            logger.error('Failed to send error to monitoring', 'ErrorHandler.sendToMonitoring', monitoringError);
        }
    }

    /**
     * Hiển thị feedback cho user dựa trên severity
     */
    private showUserFeedback(error: LegacyAppError): void {
        switch (error.severity) {
            case ErrorSeverity.LOW:
                // Silent handling for low severity errors
                break;

            case ErrorSeverity.MEDIUM:
                // Show toast or subtle notification
                this.showToast(error.message);
                break;

            case ErrorSeverity.HIGH:
                // Show alert with retry option
                this.showAlert(error.message, true);
                break;

            case ErrorSeverity.CRITICAL:
                // Show critical error alert with app restart option
                this.showCriticalError(error.message);
                break;
        }
    }

    /**
 * Hiển thị toast notification
 */
    private showToast(message: string): void {
        // Emit event để ToastContext có thể hiển thị toast
        eventBus.emit('show-toast', { message, type: 'error' });
        console.log('Toast event emitted:', message);
    }

    /**
     * Hiển thị alert với tùy chọn retry
     */
    private showAlert(message: string, showRetry: boolean = false): void {
        const buttons: AlertButton[] = [
            { text: 'OK', style: 'default' }
        ];

        if (showRetry) {
            buttons.push({ text: 'Retry', style: 'default' });
        }

        Alert.alert('Error', message, buttons);
    }

    /**
     * Hiển thị critical error với tùy chọn restart
     */
    private showCriticalError(message: string): void {
        Alert.alert(
            'Critical Error',
            message,
            [
                { text: 'Restart App', style: 'destructive' },
                { text: 'Continue', style: 'default' }
            ]
        );
    }

    /**
     * Lấy error log
     */
    getErrorLog(): LegacyAppError[] {
        return [...this.errorLog];
    }

    /**
 * Clear error log
 */
    clearErrorLog(): void {
        this.errorLog = [];
        this.saveErrorLog();
    }

    /**
     * Set production mode
     */
    setProductionMode(enabled: boolean): void {
        this.isProduction = enabled;
        console.log(`ErrorHandler production mode: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get production mode status
     */
    isProductionMode(): boolean {
        return this.isProduction;
    }

    /**
 * Lưu error log vào storage
 */
    private async saveErrorLog(): Promise<void> {
        try {
            await AsyncStorage.setItem('error_log', JSON.stringify(this.errorLog));
        } catch (error) {
            console.error('Failed to save error log:', error);
        }
    }

    /**
     * Append audit record for quick-pay/NFC operations
     */
    async appendAudit(event: string, details?: any): Promise<void> {
        try {
            const key = 'audit_log_v1';
            const existing = await AsyncStorage.getItem(key);
            const arr = existing ? JSON.parse(existing) : [];
            arr.push({ event, details, at: new Date().toISOString() });
            if (arr.length > 500) arr.splice(0, arr.length - 500);
            await AsyncStorage.setItem(key, JSON.stringify(arr));
        } catch {}
    }

    /**
     * Tạo network error
     */
    static createNetworkError(message: string, details?: any): LegacyAppError {
        return {
            type: ErrorType.NETWORK,
            severity: ErrorSeverity.MEDIUM,
            message,
            details,
            timestamp: new Date()
        };
    }

    /**
     * Tạo authentication error
     */
    static createAuthError(message: string, details?: any): LegacyAppError {
        return {
            type: ErrorType.AUTHENTICATION,
            severity: ErrorSeverity.HIGH,
            message,
            details,
            timestamp: new Date()
        };
    }

    /**
     * Tạo transaction error
     */
    static createTransactionError(message: string, details?: any): LegacyAppError {
        return {
            type: ErrorType.TRANSACTION,
            severity: ErrorSeverity.HIGH,
            message,
            details,
            timestamp: new Date()
        };
    }

    /**
     * Tạo crypto error
     */
    static createCryptoError(message: string, details?: any): LegacyAppError {
        return {
            type: ErrorType.CRYPTO,
            severity: ErrorSeverity.CRITICAL,
            message,
            details,
            timestamp: new Date()
        };
    }
}
