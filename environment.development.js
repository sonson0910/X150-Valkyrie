/**
 * Development environment configuration
 */

module.exports = {
  ENVIRONMENT: 'development',
  
  // API Configuration
  BLOCKFROST_PROJECT_ID: 'preprod_development_key_here',
  BLOCKFROST_BASE_URL: 'https://cardano-preprod.blockfrost.io/api/v0',
  
  // Network Configuration
  CARDANO_NETWORK: 'preprod',
  NETWORK_ID: 0,
  
  // Security Configuration
  PBKDF2_ITERATIONS: 10000, // Lower for development
  AES_KEY_LENGTH: 32,
  
  // Feature Flags
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_NFC: false, // Disabled in development
  ENABLE_BLUETOOTH: false, // Disabled in development
  ENABLE_ANALYTICS: false, // Disabled in development
  ENABLE_CRASH_REPORTING: false,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: false,
  
  // Logging Configuration
  LOG_LEVEL: 'debug',
  ENABLE_CONSOLE_LOGS: true,
  ENABLE_FILE_LOGS: false,
  
  // Cache Configuration
  CACHE_TTL_DEFAULT: 300000, // 5 minutes
  CACHE_TTL_PRICES: 60000, // 1 minute
  CACHE_TTL_TRANSACTIONS: 30000, // 30 seconds
  
  // Development Tools
  ENABLE_FLIPPER: true,
  ENABLE_DEV_MENU: true,
  ENABLE_REMOTE_DEBUGGING: true,
  
  // Test Configuration
  MOCK_API_RESPONSES: false,
  MOCK_BIOMETRIC_AUTH: false,
  SKIP_ONBOARDING: false,
  
  // Sentry Configuration (disabled in development)
  SENTRY_DSN: '',
  SENTRY_ENVIRONMENT: 'development',
  SENTRY_ENABLED: false,
  
  // Analytics Configuration (disabled in development)
  MIXPANEL_PROJECT_TOKEN: '',
  GOOGLE_ANALYTICS_ID: '',
  FIREBASE_CONFIG: {},
  
  // Version and Build Information
  APP_VERSION: '1.0.0',
  BUILD_NUMBER: '1',
  BUILD_VARIANT: 'development',
  
  // URLs and Endpoints
  TERMS_OF_SERVICE_URL: 'https://dev.valkyrie-wallet.com/terms',
  PRIVACY_POLICY_URL: 'https://dev.valkyrie-wallet.com/privacy',
  SUPPORT_URL: 'https://dev.valkyrie-wallet.com/support',
  
  // Wallet Configuration
  DEFAULT_ACCOUNT_NAME: 'Main Account',
  MAX_ACCOUNTS: 10,
  ADDRESS_GAP_LIMIT: 20,
  
  // Transaction Configuration
  DEFAULT_TX_FEE: 200000, // 0.2 ADA in lovelace
  MAX_TX_SIZE: 16384, // 16KB
  MIN_UTXO_VALUE: 1000000, // 1 ADA in lovelace
  
  // Staking Configuration
  MIN_STAKE_AMOUNT: 10000000, // 10 ADA in lovelace
  STAKE_POOL_ID: 'pool1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
  
  // DeFi Configuration
  ENABLE_DEFI_FEATURES: true,
  SUPPORTED_DEX_PROTOCOLS: ['sundaeswap', 'minswap'],
  
  // NFT Configuration
  ENABLE_NFT_FEATURES: true,
  NFT_METADATA_SERVER: 'https://dev-nft-metadata.valkyrie-wallet.com',
  
  // Sync Configuration
  SYNC_INTERVAL: 30000, // 30 seconds
  BACKGROUND_SYNC_INTERVAL: 300000, // 5 minutes
  
  // Rate Limiting
  API_RATE_LIMIT: 100, // requests per minute
  API_RATE_WINDOW: 60000, // 1 minute
  
  // Timeouts
  API_TIMEOUT: 30000, // 30 seconds
  TRANSACTION_TIMEOUT: 120000, // 2 minutes
  SYNC_TIMEOUT: 60000, // 1 minute
  
  // Offline Configuration
  OFFLINE_MODE_ENABLED: true,
  OFFLINE_QUEUE_SIZE: 100,
  OFFLINE_RETRY_ATTEMPTS: 3,
  
  // Internationalization
  DEFAULT_LANGUAGE: 'en',
  SUPPORTED_LANGUAGES: ['en', 'vi'],
  
  // Theme Configuration
  DEFAULT_THEME: 'dark',
  ENABLE_THEME_SWITCHING: true,
  
  // Backup Configuration
  BACKUP_REMINDER_INTERVAL: 604800000, // 7 days
  AUTO_BACKUP_ENABLED: false,
  
  // Security Warnings
  WARN_ON_SCREENSHOT: true,
  WARN_ON_ROOT_DEVICE: false, // Disabled in development
  BLOCK_ON_JAILBREAK: false, // Disabled in development
  
  // Developer Settings
  ENABLE_EXPERIMENTAL_FEATURES: true,
  SHOW_DEBUG_INFO: true,
  ENABLE_PERFORMANCE_OVERLAY: false
};

