/**
 * CONFIG_CONSTANTS - Centralized configuration constants
 * 
 * Contains all hardcoded configuration values, timeouts, limits,
 * and operational parameters used throughout the application.
 */

// =========================================================================
// NETWORK & API CONFIGURATION
// =========================================================================

export const NETWORK_CONSTANTS = {
    // API Timeouts (milliseconds)
    API_TIMEOUT: 10000,           // 10 seconds
    QUICK_API_TIMEOUT: 5000,      // 5 seconds
    LONG_API_TIMEOUT: 30000,      // 30 seconds
    
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,            // 1 second
    EXPONENTIAL_BACKOFF: 2,       // Multiplier
    
    // Connection limits
    MAX_CONCURRENT_REQUESTS: 5,
    CONNECTION_POOL_SIZE: 10,
    
    // Rate limiting
    RATE_LIMIT_REQUESTS: 100,     // per minute
    RATE_LIMIT_WINDOW: 60000,     // 1 minute
} as const;

// =========================================================================
// BLUETOOTH CONFIGURATION
// =========================================================================

export const BLUETOOTH_CONSTANTS = {
    // Discovery & scanning
    DISCOVERY_TIMEOUT: 30000,     // 30 seconds
    SCAN_INTERVAL: 2000,          // 2 seconds
    
    // Connection parameters
    CONNECTION_TIMEOUT: 15000,    // 15 seconds
    DISCONNECTION_TIMEOUT: 5000,  // 5 seconds
    
    // Data transfer
    MTU_SIZE: 512,                // Maximum Transmission Unit
    FRAME_SIZE: 256,              // Data frame size
    ACK_TIMEOUT: 3000,            // 3 seconds
    
    // Session management
    MAX_SESSIONS: 5,
    SESSION_CLEANUP_INTERVAL: 300000, // 5 minutes
    
    // Progress monitoring
    PROGRESS_UPDATE_INTERVAL: 500,    // 0.5 seconds
    PROGRESS_TIMEOUT: 30000,          // 30 seconds
} as const;

// =========================================================================
// USER INTERFACE CONFIGURATION
// =========================================================================

export const UI_CONSTANTS = {
    // Animation durations (milliseconds)
    FAST_ANIMATION: 200,
    NORMAL_ANIMATION: 300,
    SLOW_ANIMATION: 500,
    
    // Loading & feedback
    LOADING_DELAY: 1000,          // Show loading after 1s
    SUCCESS_TOAST_DURATION: 3000, // 3 seconds
    ERROR_TOAST_DURATION: 5000,   // 5 seconds
    
    // Auto-refresh intervals
    BALANCE_REFRESH_INTERVAL: 30000,    // 30 seconds
    TRANSACTION_REFRESH_INTERVAL: 15000, // 15 seconds
    PORTFOLIO_REFRESH_INTERVAL: 60000,   // 1 minute
    
    // Pagination
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100,
    
    // QR Code
    QR_CODE_SIZE: 256,
    QR_ERROR_CORRECTION: 'M',
} as const;

// =========================================================================
// STORAGE & CACHING
// =========================================================================

export const STORAGE_CONSTANTS = {
    // Cache durations (milliseconds)
    SHORT_CACHE_TTL: 5 * 60 * 1000,      // 5 minutes
    MEDIUM_CACHE_TTL: 30 * 60 * 1000,    // 30 minutes
    LONG_CACHE_TTL: 2 * 60 * 60 * 1000,  // 2 hours
    
    // Storage limits
    MAX_CACHE_SIZE: 50 * 1024 * 1024,    // 50 MB
    MAX_LOG_ENTRIES: 1000,
    MAX_TRANSACTION_HISTORY: 500,
    
    // Cleanup intervals
    CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    LOG_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    
    // Backup configuration
    AUTO_BACKUP_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
    MAX_BACKUP_FILES: 5,
} as const;

// =========================================================================
// PORTFOLIO & ANALYTICS
// =========================================================================

export const PORTFOLIO_CONSTANTS = {
    // Price update intervals
    PRICE_UPDATE_INTERVAL: 60000,        // 1 minute
    PRICE_HISTORY_INTERVAL: 300000,      // 5 minutes
    
    // Analytics periods
    ANALYTICS_SHORT_PERIOD: 7 * 24 * 60 * 60 * 1000,   // 7 days
    ANALYTICS_MEDIUM_PERIOD: 30 * 24 * 60 * 60 * 1000,  // 30 days
    ANALYTICS_LONG_PERIOD: 365 * 24 * 60 * 60 * 1000,   // 1 year
    
    // Risk assessment
    VOLATILITY_WINDOW: 30,               // 30 days
    CORRELATION_WINDOW: 90,              // 90 days
    
    // Asset limits
    MAX_TRACKED_ASSETS: 100,
    MAX_NFT_COLLECTIONS: 50,
    MAX_STAKING_POOLS: 20,
} as const;

// =========================================================================
// TRANSACTION LIMITS
// =========================================================================

export const TRANSACTION_LIMITS = {
    // Amount limits (in lovelace)
    MIN_TRANSACTION_AMOUNT: 1000000,     // 1 ADA
    MAX_TRANSACTION_AMOUNT: 1000000000000, // 1M ADA
    
    // Quick Pay limits
    QUICK_PAY_DAILY_LIMIT: 100000000,    // 100 ADA
    QUICK_PAY_PER_TX_LIMIT: 10000000,    // 10 ADA
    
    // Multi-signature
    MIN_MULTISIG_SIGNERS: 2,
    MAX_MULTISIG_SIGNERS: 15,
    
    // Batch transactions
    MAX_BATCH_SIZE: 10,
    BATCH_TIMEOUT: 30000,                // 30 seconds
} as const;

// =========================================================================
// BIOMETRIC & SECURITY
// =========================================================================

export const BIOMETRIC_CONSTANTS = {
    // Authentication timeouts
    BIOMETRIC_TIMEOUT: 30000,           // 30 seconds
    BIOMETRIC_RETRY_DELAY: 1000,        // 1 second
    
    // Quick Pay security
    QUICK_PAY_RESET_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    IDLE_LOCK_TIMEOUT: 5 * 60 * 1000,   // 5 minutes
    
    // Security levels
    MAX_FAILED_ATTEMPTS: 3,
    LOCKOUT_DURATION: 15 * 60 * 1000,   // 15 minutes
    
    // Whitelist limits
    MAX_WHITELISTED_ADDRESSES: 20,
    WHITELIST_CLEANUP_INTERVAL: 30 * 24 * 60 * 60 * 1000, // 30 days
} as const;

// =========================================================================
// NFT & DEFI CONFIGURATION
// =========================================================================

export const NFT_CONSTANTS = {
    // Metadata limits
    MAX_METADATA_SIZE: 64 * 1024,       // 64 KB
    MAX_ATTRIBUTE_COUNT: 50,
    
    // Collection limits
    MAX_COLLECTION_SIZE: 10000,
    
    // History periods
    NFT_HISTORY_PERIOD: 30 * 24 * 60 * 60 * 1000, // 30 days
    
    // File size limits
    MAX_IMAGE_SIZE: 10 * 1024 * 1024,   // 10 MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024,  // 100 MB
} as const;

export const DEFI_CONSTANTS = {
    // Staking parameters
    MIN_DELEGATION_AMOUNT: 10000000,    // 10 ADA
    EPOCH_DURATION: 5 * 24 * 60 * 60 * 1000, // 5 days
    
    // Pool limits
    MAX_POOL_SEARCH_RESULTS: 1000,
    
    // Voting parameters
    MIN_VOTING_POWER: 1000000,          // 1 ADA
    VOTING_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
    
    // Liquidity pools
    MIN_LIQUIDITY_AMOUNT: 5000000,      // 5 ADA
    SLIPPAGE_TOLERANCE: 5,               // 5%
} as const;

// =========================================================================
// ERROR & MONITORING
// =========================================================================

export const MONITORING_CONSTANTS = {
    // Error tracking
    MAX_ERROR_LOG_SIZE: 1000,
    ERROR_REPORT_INTERVAL: 60000,       // 1 minute
    
    // Performance monitoring
    PERFORMANCE_SAMPLE_RATE: 0.1,       // 10%
    SLOW_QUERY_THRESHOLD: 5000,         // 5 seconds
    
    // Health checks
    HEALTH_CHECK_INTERVAL: 30000,       // 30 seconds
    SERVICE_TIMEOUT_THRESHOLD: 10000,   // 10 seconds
    
    // Metrics retention
    METRICS_RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// =========================================================================
// DEVELOPMENT & TESTING
// =========================================================================

export const DEV_CONSTANTS = {
    // Mock delays (development only)
    MOCK_API_DELAY: 1000,              // 1 second
    MOCK_TRANSACTION_DELAY: 2000,      // 2 seconds
    
    // Test data limits
    MAX_TEST_TRANSACTIONS: 100,
    MAX_TEST_ACCOUNTS: 10,
    
    // Debug intervals
    DEBUG_LOG_INTERVAL: 5000,          // 5 seconds
    MEMORY_DEBUG_INTERVAL: 30000,      // 30 seconds
} as const;

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Get timeout value based on operation type
 */
export const getTimeout = (operation: 'api' | 'quick' | 'long' | 'bluetooth' | 'biometric'): number => {
    switch (operation) {
        case 'api': return NETWORK_CONSTANTS.API_TIMEOUT;
        case 'quick': return NETWORK_CONSTANTS.QUICK_API_TIMEOUT;
        case 'long': return NETWORK_CONSTANTS.LONG_API_TIMEOUT;
        case 'bluetooth': return BLUETOOTH_CONSTANTS.CONNECTION_TIMEOUT;
        case 'biometric': return BIOMETRIC_CONSTANTS.BIOMETRIC_TIMEOUT;
        default: return NETWORK_CONSTANTS.API_TIMEOUT;
    }
};

/**
 * Get cache TTL based on data type
 */
export const getCacheTTL = (dataType: 'short' | 'medium' | 'long'): number => {
    switch (dataType) {
        case 'short': return STORAGE_CONSTANTS.SHORT_CACHE_TTL;
        case 'medium': return STORAGE_CONSTANTS.MEDIUM_CACHE_TTL;
        case 'long': return STORAGE_CONSTANTS.LONG_CACHE_TTL;
        default: return STORAGE_CONSTANTS.MEDIUM_CACHE_TTL;
    }
};

/**
 * Check if amount is within transaction limits
 */
export const isValidTransactionAmount = (amount: number): boolean => {
    return amount >= TRANSACTION_LIMITS.MIN_TRANSACTION_AMOUNT && 
           amount <= TRANSACTION_LIMITS.MAX_TRANSACTION_AMOUNT;
};

/**
 * Format time duration in milliseconds to human readable
 */
export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};

