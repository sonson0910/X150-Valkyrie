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

export const BLUETOOTH_CONSTANTS = {
    SERVICE_UUID: 'valkyrie-cardano-wallet',
    TX_CHARACTERISTIC_UUID: 'tx-transfer',
    DISCOVERY_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 10000,
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
} as const;
