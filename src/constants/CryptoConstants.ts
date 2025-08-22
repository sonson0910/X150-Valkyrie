/**
 * CRYPTO_CONSTANTS - Centralized cryptographic constants for Cardano wallet
 * 
 * Contains all hardcoded cryptographic parameters, derivation paths,
 * and security-related constants used throughout the application.
 */

// =========================================================================
// CARDANO BIP44 DERIVATION PATHS
// =========================================================================

export const CARDANO_DERIVATION = {
    // BIP44 Constants
    PURPOSE: 1852,      // Purpose for multi-account hierarchy (CIP-1852)
    COIN_TYPE: 1815,    // Coin type for Cardano (registered in SLIP-0044)
    
    // Hardened derivation marker
    HARDENED_OFFSET: 0x80000000,
    
    // Account chain indices
    EXTERNAL_CHAIN: 0,  // Receiving addresses
    INTERNAL_CHAIN: 1,  // Change addresses
    STAKING_CHAIN: 2,   // Staking key derivation
    
    // Default indices
    FIRST_ACCOUNT: 0,
    FIRST_ADDRESS: 0,
    STAKING_KEY_INDEX: 0,
} as const;

// =========================================================================
// MNEMONIC & KEY GENERATION
// =========================================================================

export const MNEMONIC_CONSTANTS = {
    // Entropy bit lengths (BIP39)
    ENTROPY_12_WORDS: 128,  // 12 words
    ENTROPY_24_WORDS: 256,  // 24 words
    
    // Word counts
    WORDS_12: 12,
    WORDS_24: 24,
    WORDS_36: 36,  // Transformed mnemonic
    
    // Validation
    MIN_WORDS: 12,
    MAX_WORDS: 24,
    TRANSFORMED_WORDS: 36,
} as const;

// =========================================================================
// ENCRYPTION & HASHING
// =========================================================================

export const ENCRYPTION_CONSTANTS = {
    // AES Parameters
    AES_KEY_SIZE: 256,     // AES-256
    AES_BLOCK_SIZE: 16,    // 128 bits
    
    // Salt sizes
    SALT_SIZE: 128,        // bits
    SALT_BYTES: 16,        // bytes
    
    // Key derivation
    PBKDF2_ITERATIONS: 10000,  // Standard iterations
    KEY_BYTES: 32,             // 256 bits / 8
    
    // IV/Nonce sizes
    IV_SIZE: 12,          // GCM IV size
    TAG_SIZE: 16,         // GCM tag size
} as const;

// =========================================================================
// CARDANO TRANSACTION FEES
// =========================================================================

export const CARDANO_FEES = {
    // Linear fee parameters (Cardano protocol)
    MIN_FEE_A: 44,         // Coefficient a in fee calculation
    MIN_FEE_B: 155381,     // Coefficient b in fee calculation
    
    // Pool deposits (in lovelace)
    POOL_DEPOSIT: 500000000,    // 500 ADA
    KEY_DEPOSIT: 2000000,       // 2 ADA
    
    // Standard transaction fees
    STANDARD_TX_FEE: 200000,    // 0.2 ADA in lovelace
    DELEGATION_FEE: 200000,     // 0.2 ADA in lovelace
    
    // Minimum ADA amounts
    MIN_UTXO: 1000000,         // 1 ADA minimum
    MIN_CHANGE: 1000000,       // 1 ADA minimum change
} as const;

// =========================================================================
// SIGNATURE & VERIFICATION
// =========================================================================

export const SIGNATURE_CONSTANTS = {
    // Ed25519 signature sizes
    PRIVATE_KEY_SIZE: 32,      // bytes
    PUBLIC_KEY_SIZE: 32,       // bytes
    SIGNATURE_SIZE: 64,        // bytes
    
    // Hash sizes
    BLAKE2B_224_SIZE: 28,      // bytes
    BLAKE2B_256_SIZE: 32,      // bytes
    
    // Address sizes
    SHELLEY_ADDRESS_SIZE: 57,  // bytes
    BYRON_ADDRESS_MAX: 83,     // bytes
} as const;

// =========================================================================
// CERTIFICATE FINGERPRINTS (SHA256)
// =========================================================================

export const CERTIFICATE_CONSTANTS = {
    // SHA256 fingerprint format
    FINGERPRINT_PREFIX: 'sha256/',
    FINGERPRINT_LENGTH: 44,    // Base64 encoded SHA256
    
    // Certificate validity periods (milliseconds)
    CERT_VALIDITY_PERIOD: 365 * 24 * 60 * 60 * 1000,  // 1 year
    CERT_GRACE_PERIOD: 24 * 60 * 60 * 1000,           // 1 day
    
    // Update intervals
    CERT_UPDATE_INTERVAL: 24 * 60 * 60 * 1000,        // Daily
} as const;

// =========================================================================
// SECURITY LIMITS
// =========================================================================

export const SECURITY_LIMITS = {
    // Memory cleanup
    MAX_SENSITIVE_DATA_AGE: 5 * 60 * 1000,    // 5 minutes
    MEMORY_CLEANUP_INTERVAL: 60 * 1000,        // 1 minute
    
    // Key exchange cache
    KEY_EXCHANGE_TTL: 60 * 60 * 1000,         // 1 hour
    
    // Authentication
    MAX_AUTH_ATTEMPTS: 3,
    AUTH_LOCKOUT_TIME: 15 * 60 * 1000,        // 15 minutes
    
    // Session timeouts
    SESSION_TIMEOUT: 30 * 60 * 1000,          // 30 minutes
    IDLE_TIMEOUT: 10 * 60 * 1000,             // 10 minutes
} as const;

// =========================================================================
// CRYPTOGRAPHIC ALGORITHMS
// =========================================================================

export const CRYPTO_ALGORITHMS = {
    // Symmetric encryption
    AES_GCM: 'aes-256-gcm',
    AES_CBC: 'aes-256-cbc',
    
    // Key derivation
    PBKDF2: 'pbkdf2',
    SCRYPT: 'scrypt',
    
    // Hashing
    SHA256: 'sha256',
    BLAKE2B: 'blake2b',
    
    // Asymmetric
    ED25519: 'ed25519',
    ECDH: 'ecdh',
} as const;

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Apply hardened derivation to index
 */
export const hardenIndex = (index: number): number => {
    return CARDANO_DERIVATION.HARDENED_OFFSET + index;
};

/**
 * Build Cardano derivation path string
 */
export const buildDerivationPath = (
    purpose: number = CARDANO_DERIVATION.PURPOSE,
    coinType: number = CARDANO_DERIVATION.COIN_TYPE,
    account: number = CARDANO_DERIVATION.FIRST_ACCOUNT,
    chain?: number,
    addressIndex?: number
): string => {
    let path = `m/${purpose}'/${coinType}'/${account}'`;
    
    if (chain !== undefined) {
        path += `/${chain}`;
        
        if (addressIndex !== undefined) {
            path += `/${addressIndex}`;
        }
    }
    
    return path;
};

/**
 * Convert milliseconds to human readable duration
 */
export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
};

