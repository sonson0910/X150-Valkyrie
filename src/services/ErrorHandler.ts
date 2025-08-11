import { Alert, AlertButton } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventBus } from './EventBus';

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

export interface AppError {
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
    private errorLog: AppError[] = [];
    private isProduction: boolean = false; // Configure based on environment

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Xử lý lỗi với logging và user feedback
     */
    handleError(
        error: Error | string,
        context?: string,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        type: ErrorType = ErrorType.UNKNOWN
    ): void {
        const appError: AppError = {
            type,
            severity,
            message: typeof error === 'string' ? error : error.message,
            code: typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
            details: typeof error === 'object' ? error : undefined,
            timestamp: new Date(),
            context
        };

        // Log error
        this.logError(appError);

        // Send to monitoring service in production
        if (this.isProduction) {
            this.sendToMonitoring(appError);
        }

        // Show user feedback based on severity
        this.showUserFeedback(appError);
    }

    /**
     * Log error vào local storage và console
     */
    private logError(error: AppError): void {
        // Add to memory log
        this.errorLog.push(error);

        // Keep only last 100 errors
        if (this.errorLog.length > 100) {
            this.errorLog = this.errorLog.slice(-100);
        }

        // Console log in development
        if (!this.isProduction) {
            console.error(`[${error.type}] ${error.severity}: ${error.message}`, {
                context: error.context,
                details: error.details,
                timestamp: error.timestamp
            });
        }

        // Save to AsyncStorage for debugging
        this.saveErrorLog();
    }

    /**
     * Gửi error đến monitoring service (Sentry)
     */
    private async sendToMonitoring(error: AppError): Promise<void> {
        try {
            // Enable Sentry integration
            try {
                const Sentry = require('@sentry/react-native');
                Sentry.init({
                    dsn: process.env.SENTRY_DSN || 'https://your-sentry-dsn-here.sentry.io/project-id',
                    environment: 'production',
                    enableAutoSessionTracking: true,
                    debug: false,
                    beforeSend: (event: any) => {
                        // Filter out sensitive information
                        if (event.user) {
                            delete event.user.ip_address;
                            delete event.user.email;
                        }
                        return event;
                    }
                });

                console.log('Production mode - Sentry integration enabled');
            } catch (sentryError) {
                console.warn('Failed to initialize Sentry:', sentryError);
            }
        } catch (monitoringError) {
            console.error('Failed to send error to monitoring:', monitoringError);
        }
    }

    /**
     * Hiển thị feedback cho user dựa trên severity
     */
    private showUserFeedback(error: AppError): void {
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
    getErrorLog(): AppError[] {
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
     * Tạo network error
     */
    static createNetworkError(message: string, details?: any): AppError {
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
    static createAuthError(message: string, details?: any): AppError {
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
    static createTransactionError(message: string, details?: any): AppError {
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
    static createCryptoError(message: string, details?: any): AppError {
        return {
            type: ErrorType.CRYPTO,
            severity: ErrorSeverity.CRITICAL,
            message,
            details,
            timestamp: new Date()
        };
    }
}
