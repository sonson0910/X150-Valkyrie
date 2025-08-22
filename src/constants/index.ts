// =========================================================================
// EXPORT CENTRALIZED CONSTANTS
// =========================================================================

// Export crypto constants
export {
    CARDANO_DERIVATION,
    MNEMONIC_CONSTANTS,
    ENCRYPTION_CONSTANTS,
    CARDANO_FEES,
    SIGNATURE_CONSTANTS,
    CERTIFICATE_CONSTANTS,
    SECURITY_LIMITS,
    CRYPTO_ALGORITHMS,
    hardenIndex,
    buildDerivationPath,
    formatDuration
} from './CryptoConstants';

// Export config constants (with CONFIG_BLUETOOTH_CONSTANTS renamed to avoid conflict)
export {
    NETWORK_CONSTANTS,
    BLUETOOTH_CONSTANTS as CONFIG_BLUETOOTH_CONSTANTS, 
    UI_CONSTANTS,
    STORAGE_CONSTANTS,
    PORTFOLIO_CONSTANTS,
    TRANSACTION_LIMITS,
    BIOMETRIC_CONSTANTS,
    NFT_CONSTANTS,
    DEFI_CONSTANTS,
    MONITORING_CONSTANTS,
    DEV_CONSTANTS,
    getTimeout,
    getCacheTTL,
    isValidTransactionAmount
} from './ConfigConstants';

// =========================================================================
// CARDANO NETWORK CONFIGURATION
// =========================================================================

export const CARDANO_NETWORKS = {
    MAINNET: {
        name: 'mainnet',
        protocolMagic: 764824073,
        networkId: 1,
    },
    TESTNET: {
        name: 'testnet',
        protocolMagic: 1097911063,
        networkId: 0,
    }
} as const;

export const SECURITY_CONSTANTS = {
    PBKDF2_ITERATIONS: 100000,
    KEY_SIZE: 256,
    IV_SIZE: 16,
    SALT_SIZE: 32,
    BIOMETRIC_TIMEOUT: 30000, // 30 seconds
    AUTO_LOCK_OPTIONS: [1, 5, 15, 30, 60], // minutes
} as const;

export const WALLET_CONSTANTS = {
    DERIVATION_PATH: "m/1852'/1815'/0'/0/0",
    ACCOUNT_GAP_LIMIT: 20,
    MAX_TX_SIZE: 16384,
    MIN_ADA: '1000000', // 1 ADA in lovelace
    DEFAULT_TX_FEE: '200000', // 0.2 ADA
} as const;

// Keep the original BLUETOOTH_CONSTANTS with progress monitoring
export const BLUETOOTH_CONSTANTS = {
    SERVICE_UUID: 'valkyrie-cardano-wallet',
    TX_CHARACTERISTIC_UUID: 'tx-transfer',
    DISCOVERY_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 10000,
    CHUNK_SIZE_BLE: 180,
    ACK_TIMEOUT_MS: 2000,
    RESEND_LIMIT: 3,
    PROTOCOL_VERSION: '1.0',
    // Progress monitoring
    PROGRESS_UPDATE_INTERVAL: 500,    // 0.5 seconds
    PROGRESS_TIMEOUT: 30000,          // 30 seconds
} as const;

export const CYBERPUNK_COLORS = {
    primary: '#00ff9f',
    secondary: '#ff0080',
    accent: '#0080ff',
    background: '#0a0e27',
    surface: '#1a1f3a',
    error: '#ff4444',
    warning: '#ffaa00',
    success: '#00ff9f',
    text: '#ffffff',
    textSecondary: '#cccccc',
    border: '#333366',
} as const;

export const STORAGE_KEYS = {
    ENCRYPTED_MNEMONIC: 'encrypted_mnemonic',
    WALLET_CONFIG: 'wallet_config',
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
    OFFLINE_QUEUE: 'offline_queue',
    BIOMETRIC_ENABLED: 'biometric_enabled',
    BIOMETRIC_CONFIG: 'biometric_config',
    OFFLINE_SIGNED_TX_PREFIX: 'offline_signed_tx_',
} as const;
