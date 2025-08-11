export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ErrorType {
    NETWORK = 'network',
    WALLET = 'wallet',
    AUTHENTICATION = 'authentication',
    TRANSACTION = 'transaction',
    API = 'api',
    STORAGE = 'storage',
    BLUETOOTH = 'bluetooth',
    BIOMETRIC = 'biometric',
    CRYPTO = 'crypto',
    VALIDATION = 'validation',
    UNKNOWN = 'unknown'
}

export interface AppError {
    message: string;
    type: ErrorType;
    severity: ErrorSeverity;
    context?: string;
    details?: any;
    code?: string;
    timestamp: Date;
    userId?: string;
}
