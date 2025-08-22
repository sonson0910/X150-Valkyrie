/**
 * Comprehensive Error Types and Codes for X150-Valkyrie
 * 
 * This module defines all error types, codes, and classifications
 * used throughout the application for consistent error handling.
 */

import logger from '../../utils/Logger';

// =============================================================================
// ERROR CATEGORIES
// =============================================================================

export enum ErrorCategory {
    // System-level errors
    SYSTEM = 'SYSTEM',
    NETWORK = 'NETWORK',
    STORAGE = 'STORAGE',
    CONFIGURATION = 'CONFIGURATION',
    
    // Security-related errors
    AUTHENTICATION = 'AUTHENTICATION',
    AUTHORIZATION = 'AUTHORIZATION',
    ENCRYPTION = 'ENCRYPTION',
    BIOMETRIC = 'BIOMETRIC',
    
    // Blockchain and wallet errors
    WALLET = 'WALLET',
    TRANSACTION = 'TRANSACTION',
    CARDANO = 'CARDANO',
    CRYPTO = 'CRYPTO',
    
    // Communication errors
    BLUETOOTH = 'BLUETOOTH',
    NFC = 'NFC',
    API = 'API',
    
    // Business logic errors
    VALIDATION = 'VALIDATION',
    BUSINESS_RULE = 'BUSINESS_RULE',
    USER_INPUT = 'USER_INPUT',
    
    // Service-specific errors
    PORTFOLIO = 'PORTFOLIO',
    NFT = 'NFT',
    DEFI = 'DEFI',
    MULTISIG = 'MULTISIG',
    
    // Recovery and backup errors
    RECOVERY = 'RECOVERY',
    BACKUP = 'BACKUP',
    MNEMONIC = 'MNEMONIC',
    
    // Unknown or unclassified
    UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
    TRACE = 'TRACE',       // Development debugging only
    DEBUG = 'DEBUG',       // Development information
    INFO = 'INFO',         // General information
    WARN = 'WARN',         // Warning conditions
    ERROR = 'ERROR',       // Error conditions
    FATAL = 'FATAL',       // Fatal errors that may crash
    CRITICAL = 'CRITICAL'  // Critical business errors
}

export enum ErrorRecoveryStrategy {
    NONE = 'NONE',                    // No recovery possible
    RETRY = 'RETRY',                  // Can retry the operation
    FALLBACK = 'FALLBACK',            // Use fallback mechanism
    USER_ACTION = 'USER_ACTION',      // Requires user intervention
    RESTART = 'RESTART',              // Requires app restart
    RECONNECT = 'RECONNECT',          // Requires reconnection
    REFRESH = 'REFRESH',              // Refresh data/state
    IGNORE = 'IGNORE'                 // Can be safely ignored
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES = {
    // System Errors (SYS_*)
    SYS_INITIALIZATION_FAILED: 'SYS_001',
    SYS_SERVICE_UNAVAILABLE: 'SYS_002',
    SYS_MEMORY_ALLOCATION_FAILED: 'SYS_003',
    SYS_CONFIGURATION_INVALID: 'SYS_004',
    SYS_DEPENDENCY_INJECTION_FAILED: 'SYS_005',
    SYS_ENVIRONMENT_INVALID: 'SYS_006',
    
    // Network Errors (NET_*)
    NET_CONNECTION_FAILED: 'NET_001',
    NET_TIMEOUT: 'NET_002',
    NET_DNS_RESOLUTION_FAILED: 'NET_003',
    NET_SSL_CERTIFICATE_INVALID: 'NET_004',
    NET_RATE_LIMITED: 'NET_005',
    NET_OFFLINE: 'NET_006',
    NET_PROXY_ERROR: 'NET_007',
    
    // Storage Errors (STG_*)
    STG_READ_FAILED: 'STG_001',
    STG_WRITE_FAILED: 'STG_002',
    STG_DELETE_FAILED: 'STG_003',
    STG_QUOTA_EXCEEDED: 'STG_004',
    STG_PERMISSION_DENIED: 'STG_005',
    STG_CORRUPTION_DETECTED: 'STG_006',
    STG_ENCRYPTION_FAILED: 'STG_007',
    
    // Authentication Errors (AUTH_*)
    AUTH_INVALID_CREDENTIALS: 'AUTH_001',
    AUTH_SESSION_EXPIRED: 'AUTH_002',
    AUTH_TOKEN_INVALID: 'AUTH_003',
    AUTH_BIOMETRIC_UNAVAILABLE: 'AUTH_004',
    AUTH_BIOMETRIC_CHANGED: 'AUTH_005',
    AUTH_BIOMETRIC_FAILED: 'AUTH_006',
    AUTH_PIN_INVALID: 'AUTH_007',
    AUTH_ACCOUNT_LOCKED: 'AUTH_008',
    
    // Wallet Errors (WAL_*)
    WAL_NOT_INITIALIZED: 'WAL_001',
    WAL_INVALID_MNEMONIC: 'WAL_002',
    WAL_INVALID_ADDRESS: 'WAL_003',
    WAL_INSUFFICIENT_FUNDS: 'WAL_004',
    WAL_INVALID_AMOUNT: 'WAL_005',
    WAL_KEY_DERIVATION_FAILED: 'WAL_006',
    WAL_SIGNATURE_FAILED: 'WAL_007',
    WAL_BACKUP_FAILED: 'WAL_008',
    WAL_RESTORE_FAILED: 'WAL_009',
    WAL_CORRUPTION_DETECTED: 'WAL_010',
    
    // Transaction Errors (TXN_*)
    TXN_INVALID_RECIPIENT: 'TXN_001',
    TXN_INVALID_AMOUNT: 'TXN_002',
    TXN_INSUFFICIENT_FEES: 'TXN_003',
    TXN_UTXO_NOT_FOUND: 'TXN_004',
    TXN_BUILD_FAILED: 'TXN_005',
    TXN_SIGN_FAILED: 'TXN_006',
    TXN_SUBMIT_FAILED: 'TXN_007',
    TXN_CONFIRMATION_TIMEOUT: 'TXN_008',
    TXN_REJECTED_BY_NETWORK: 'TXN_009',
    TXN_DOUBLE_SPEND: 'TXN_010',
    
    // Cardano-specific Errors (ADA_*)
    ADA_NODE_UNAVAILABLE: 'ADA_001',
    ADA_SYNC_FAILED: 'ADA_002',
    ADA_INVALID_PROTOCOL_PARAMS: 'ADA_003',
    ADA_EPOCH_BOUNDARY_ERROR: 'ADA_004',
    ADA_STAKE_POOL_ERROR: 'ADA_005',
    ADA_METADATA_INVALID: 'ADA_006',
    ADA_SCRIPT_EXECUTION_FAILED: 'ADA_007',
    
    // Cryptographic Errors (CRY_*)
    CRY_KEY_GENERATION_FAILED: 'CRY_001',
    CRY_ENCRYPTION_FAILED: 'CRY_002',
    CRY_DECRYPTION_FAILED: 'CRY_003',
    CRY_HASH_COMPUTATION_FAILED: 'CRY_004',
    CRY_SIGNATURE_VERIFICATION_FAILED: 'CRY_005',
    CRY_RANDOM_GENERATION_FAILED: 'CRY_006',
    CRY_INVALID_KEY_FORMAT: 'CRY_007',
    CRY_ALGORITHM_NOT_SUPPORTED: 'CRY_008',
    
    // Bluetooth Errors (BLE_*)
    BLE_NOT_SUPPORTED: 'BLE_001',
    BLE_NOT_ENABLED: 'BLE_002',
    BLE_PERMISSION_DENIED: 'BLE_003',
    BLE_DEVICE_NOT_FOUND: 'BLE_004',
    BLE_CONNECTION_FAILED: 'BLE_005',
    BLE_CONNECTION_LOST: 'BLE_006',
    BLE_PAIRING_FAILED: 'BLE_007',
    BLE_DATA_TRANSFER_FAILED: 'BLE_008',
    BLE_ENCRYPTION_FAILED: 'BLE_009',
    BLE_PROTOCOL_ERROR: 'BLE_010',
    
    // API Errors (API_*)
    API_INVALID_REQUEST: 'API_001',
    API_INVALID_RESPONSE: 'API_002',
    API_RATE_LIMITED: 'API_003',
    API_SERVICE_UNAVAILABLE: 'API_004',
    API_AUTHENTICATION_FAILED: 'API_005',
    API_QUOTA_EXCEEDED: 'API_006',
    API_VERSION_DEPRECATED: 'API_007',
    API_PARSE_ERROR: 'API_008',
    
    // Validation Errors (VAL_*)
    VAL_REQUIRED_FIELD_MISSING: 'VAL_001',
    VAL_INVALID_FORMAT: 'VAL_002',
    VAL_VALUE_OUT_OF_RANGE: 'VAL_003',
    VAL_INVALID_LENGTH: 'VAL_004',
    VAL_INVALID_CHARACTER: 'VAL_005',
    VAL_CHECKSUM_MISMATCH: 'VAL_006',
    VAL_DUPLICATE_VALUE: 'VAL_007',
    
    // Business Rule Errors (BIZ_*)
    BIZ_OPERATION_NOT_ALLOWED: 'BIZ_001',
    BIZ_INSUFFICIENT_BALANCE: 'BIZ_002',
    BIZ_DAILY_LIMIT_EXCEEDED: 'BIZ_003',
    BIZ_TRANSACTION_LIMIT_EXCEEDED: 'BIZ_004',
    BIZ_ACCOUNT_SUSPENDED: 'BIZ_005',
    BIZ_FEATURE_DISABLED: 'BIZ_006',
    BIZ_MAINTENANCE_MODE: 'BIZ_007',
    
    // Recovery Errors (REC_*)
    REC_GUARDIAN_NOT_AVAILABLE: 'REC_001',
    REC_INSUFFICIENT_SIGNATURES: 'REC_002',
    REC_RECOVERY_PHRASE_INVALID: 'REC_003',
    REC_BACKUP_CORRUPTED: 'REC_004',
    REC_RECOVERY_EXPIRED: 'REC_005',
    REC_VERIFICATION_FAILED: 'REC_006',
    
    // Portfolio Errors (POR_*)
    POR_DATA_UNAVAILABLE: 'POR_001',
    POR_PRICE_FEED_FAILED: 'POR_002',
    POR_CALCULATION_ERROR: 'POR_003',
    POR_ANALYTICS_FAILED: 'POR_004',
    POR_SYNC_FAILED: 'POR_005'
} as const;

// =============================================================================
// ERROR METADATA
// =============================================================================

export interface ErrorMetadata {
    code: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    recovery: ErrorRecoveryStrategy;
    userMessage: string;
    technicalMessage: string;
    documentation?: string;
    retryable: boolean;
    reportable: boolean;
}

/**
 * Error metadata registry
 */
export const ERROR_METADATA: { [key: string]: ErrorMetadata } = {
    // System Errors
    [ERROR_CODES.SYS_INITIALIZATION_FAILED]: {
        code: ERROR_CODES.SYS_INITIALIZATION_FAILED,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.FATAL,
        recovery: ErrorRecoveryStrategy.RESTART,
        userMessage: 'App initialization failed. Please restart the application.',
        technicalMessage: 'System initialization failed during startup',
        retryable: true,
        reportable: true
    },
    
    [ERROR_CODES.SYS_DEPENDENCY_INJECTION_FAILED]: {
        code: ERROR_CODES.SYS_DEPENDENCY_INJECTION_FAILED,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.FATAL,
        recovery: ErrorRecoveryStrategy.FALLBACK,
        userMessage: 'Service initialization failed. Some features may be unavailable.',
        technicalMessage: 'Dependency injection container failed to initialize',
        retryable: true,
        reportable: true
    },
    
    // Network Errors
    [ERROR_CODES.NET_CONNECTION_FAILED]: {
        code: ERROR_CODES.NET_CONNECTION_FAILED,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.RETRY,
        userMessage: 'Connection failed. Please check your internet connection.',
        technicalMessage: 'Network connection could not be established',
        retryable: true,
        reportable: false
    },
    
    [ERROR_CODES.NET_OFFLINE]: {
        code: ERROR_CODES.NET_OFFLINE,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.WARN,
        recovery: ErrorRecoveryStrategy.FALLBACK,
        userMessage: 'You are offline. Some features may be limited.',
        technicalMessage: 'Device is in offline mode',
        retryable: false,
        reportable: false
    },
    
    // Authentication Errors
    [ERROR_CODES.AUTH_BIOMETRIC_UNAVAILABLE]: {
        code: ERROR_CODES.AUTH_BIOMETRIC_UNAVAILABLE,
        category: ErrorCategory.BIOMETRIC,
        severity: ErrorSeverity.WARN,
        recovery: ErrorRecoveryStrategy.FALLBACK,
        userMessage: 'Biometric authentication is not available. Please use PIN instead.',
        technicalMessage: 'Biometric authentication hardware not available',
        retryable: false,
        reportable: false
    },
    
    [ERROR_CODES.AUTH_BIOMETRIC_FAILED]: {
        code: ERROR_CODES.AUTH_BIOMETRIC_FAILED,
        category: ErrorCategory.BIOMETRIC,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.RETRY,
        userMessage: 'Biometric authentication failed. Please try again.',
        technicalMessage: 'Biometric authentication verification failed',
        retryable: true,
        reportable: false
    },
    
    // Wallet Errors
    [ERROR_CODES.WAL_INSUFFICIENT_FUNDS]: {
        code: ERROR_CODES.WAL_INSUFFICIENT_FUNDS,
        category: ErrorCategory.WALLET,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.USER_ACTION,
        userMessage: 'Insufficient funds for this transaction.',
        technicalMessage: 'Wallet balance insufficient for requested operation',
        retryable: false,
        reportable: false
    },
    
    [ERROR_CODES.WAL_INVALID_MNEMONIC]: {
        code: ERROR_CODES.WAL_INVALID_MNEMONIC,
        category: ErrorCategory.MNEMONIC,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.USER_ACTION,
        userMessage: 'Invalid recovery phrase. Please check and try again.',
        technicalMessage: 'Mnemonic phrase validation failed',
        retryable: false,
        reportable: false
    },
    
    // Transaction Errors
    [ERROR_CODES.TXN_INSUFFICIENT_FEES]: {
        code: ERROR_CODES.TXN_INSUFFICIENT_FEES,
        category: ErrorCategory.TRANSACTION,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.USER_ACTION,
        userMessage: 'Insufficient funds to cover transaction fees.',
        technicalMessage: 'Transaction fees exceed available balance',
        retryable: false,
        reportable: false
    },
    
    [ERROR_CODES.TXN_SUBMIT_FAILED]: {
        code: ERROR_CODES.TXN_SUBMIT_FAILED,
        category: ErrorCategory.TRANSACTION,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.RETRY,
        userMessage: 'Transaction failed to submit. Please try again.',
        technicalMessage: 'Transaction submission to network failed',
        retryable: true,
        reportable: true
    },
    
    // Bluetooth Errors
    [ERROR_CODES.BLE_CONNECTION_FAILED]: {
        code: ERROR_CODES.BLE_CONNECTION_FAILED,
        category: ErrorCategory.BLUETOOTH,
        severity: ErrorSeverity.ERROR,
        recovery: ErrorRecoveryStrategy.RETRY,
        userMessage: 'Bluetooth connection failed. Please try again.',
        technicalMessage: 'BLE device connection could not be established',
        retryable: true,
        reportable: false
    },
    
    [ERROR_CODES.BLE_NOT_ENABLED]: {
        code: ERROR_CODES.BLE_NOT_ENABLED,
        category: ErrorCategory.BLUETOOTH,
        severity: ErrorSeverity.WARN,
        recovery: ErrorRecoveryStrategy.USER_ACTION,
        userMessage: 'Please enable Bluetooth to use this feature.',
        technicalMessage: 'Bluetooth is disabled on device',
        retryable: false,
        reportable: false
    },
    
    // API Errors
    [ERROR_CODES.API_RATE_LIMITED]: {
        code: ERROR_CODES.API_RATE_LIMITED,
        category: ErrorCategory.API,
        severity: ErrorSeverity.WARN,
        recovery: ErrorRecoveryStrategy.RETRY,
        userMessage: 'Request limit reached. Please wait a moment before trying again.',
        technicalMessage: 'API rate limit exceeded',
        retryable: true,
        reportable: false
    }
};

// =============================================================================
// ERROR UTILITIES
// =============================================================================

/**
 * Get error metadata by code
 */
export function getErrorMetadata(code: string): ErrorMetadata | null {
    return ERROR_METADATA[code] || null;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(code: string): boolean {
    const metadata = getErrorMetadata(code);
    return metadata?.retryable ?? false;
}

/**
 * Check if error should be reported
 */
export function isReportableError(code: string): boolean {
    const metadata = getErrorMetadata(code);
    return metadata?.reportable ?? true;
}

/**
 * Get user-friendly message for error code
 */
export function getUserMessage(code: string): string {
    const metadata = getErrorMetadata(code);
    return metadata?.userMessage ?? 'An unexpected error occurred. Please try again.';
}

/**
 * Get technical message for error code
 */
export function getTechnicalMessage(code: string): string {
    const metadata = getErrorMetadata(code);
    return metadata?.technicalMessage ?? 'Unknown error occurred';
}

/**
 * Get recovery strategy for error code
 */
export function getRecoveryStrategy(code: string): ErrorRecoveryStrategy {
    const metadata = getErrorMetadata(code);
    return metadata?.recovery ?? ErrorRecoveryStrategy.NONE;
}

/**
 * Create error code for category and number
 */
export function createErrorCode(category: string, number: number): string {
    return `${category}_${number.toString().padStart(3, '0')}`;
}

/**
 * Validate error code format
 */
export function isValidErrorCode(code: string): boolean {
    return /^[A-Z]{3}_\d{3}$/.test(code);
}

/**
 * Get all error codes for a category
 */
export function getErrorCodesForCategory(category: ErrorCategory): string[] {
    return Object.values(ERROR_CODES).filter(code => {
        const metadata = getErrorMetadata(code);
        return metadata?.category === category;
    });
}

/**
 * Get error statistics
 */
export function getErrorStatistics(): {
    totalCodes: number;
    categoryCounts: { [key in ErrorCategory]: number };
    severityCounts: { [key in ErrorSeverity]: number };
    retryableCounts: { retryable: number; nonRetryable: number };
} {
    const allCodes = Object.values(ERROR_CODES);
    const categoryCounts = {} as { [key in ErrorCategory]: number };
    const severityCounts = {} as { [key in ErrorSeverity]: number };
    let retryableCount = 0;
    let nonRetryableCount = 0;

    // Initialize counts
    Object.values(ErrorCategory).forEach(cat => categoryCounts[cat] = 0);
    Object.values(ErrorSeverity).forEach(sev => severityCounts[sev] = 0);

    // Count codes
    allCodes.forEach(code => {
        const metadata = getErrorMetadata(code);
        if (metadata) {
            categoryCounts[metadata.category]++;
            severityCounts[metadata.severity]++;
            if (metadata.retryable) {
                retryableCount++;
            } else {
                nonRetryableCount++;
            }
        }
    });

    return {
        totalCodes: allCodes.length,
        categoryCounts,
        severityCounts,
        retryableCounts: {
            retryable: retryableCount,
            nonRetryable: nonRetryableCount
        }
    };
}

export default {
    ErrorCategory,
    ErrorSeverity,
    ErrorRecoveryStrategy,
    ERROR_CODES,
    ERROR_METADATA,
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
};

