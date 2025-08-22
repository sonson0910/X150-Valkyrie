/**
 * Staging environment configuration
 */

module.exports = {
  ENVIRONMENT: 'staging',
  
  // API Configuration
  BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_STAGING_PROJECT_ID || 'staging_project_id_here',
  BLOCKFROST_BASE_URL: 'https://cardano-preprod.blockfrost.io/api/v0',
  
  // Network Configuration
  CARDANO_NETWORK: 'preprod',
  NETWORK_ID: 0,
  
  // Security Configuration
  PBKDF2_ITERATIONS: 100000, // Production-level security
  AES_KEY_LENGTH: 32,
  
  // Feature Flags
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_NFC: true,
  ENABLE_BLUETOOTH: true,
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: true,
  
  // Logging Configuration
  LOG_LEVEL: 'info',
  ENABLE_CONSOLE_LOGS: false,
  ENABLE_FILE_LOGS: true,
  
  // Cache Configuration
  CACHE_TTL_DEFAULT: 600000, // 10 minutes
  CACHE_TTL_PRICES: 300000, // 5 minutes
  CACHE_TTL_TRANSACTIONS: 60000, // 1 minute
  
  // Development Tools (disabled in staging)
  ENABLE_FLIPPER: false,
  ENABLE_DEV_MENU: false,
  ENABLE_REMOTE_DEBUGGING: false,
  
  // Test Configuration
  MOCK_API_RESPONSES: false,
  MOCK_BIOMETRIC_AUTH: false,
  SKIP_ONBOARDING: false,
  
  // Sentry Configuration
  SENTRY_DSN: process.env.SENTRY_DSN_STAGING || '',
  SENTRY_ENVIRONMENT: 'staging',
  SENTRY_ENABLED: true,
  SENTRY_SAMPLE_RATE: 0.5, // 50% sampling in staging
  SENTRY_TRACES_SAMPLE_RATE: 0.3, // 30% performance monitoring
  
  // Analytics Configuration
  MIXPANEL_PROJECT_TOKEN: process.env.MIXPANEL_STAGING_TOKEN || '',
  GOOGLE_ANALYTICS_ID: process.env.GA_STAGING_ID || '',
  FIREBASE_CONFIG: {
    apiKey: process.env.FIREBASE_STAGING_API_KEY || '',
    authDomain: process.env.FIREBASE_STAGING_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_STAGING_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STAGING_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_STAGING_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_STAGING_APP_ID || ''
  },
  
  // Version and Build Information
  APP_VERSION: process.env.APP_VERSION || '1.0.0',
  BUILD_NUMBER: process.env.BUILD_NUMBER || '1',
  BUILD_VARIANT: 'staging',
  
  // URLs and Endpoints
  TERMS_OF_SERVICE_URL: 'https://staging.valkyrie-wallet.com/terms',
  PRIVACY_POLICY_URL: 'https://staging.valkyrie-wallet.com/privacy',
  SUPPORT_URL: 'https://staging.valkyrie-wallet.com/support',
  
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
  STAKE_POOL_ID: process.env.STAGING_STAKE_POOL_ID || 'pool1staging...',
  
  // DeFi Configuration
  ENABLE_DEFI_FEATURES: true,
  SUPPORTED_DEX_PROTOCOLS: ['sundaeswap', 'minswap', 'wingriders'],
  
  // NFT Configuration
  ENABLE_NFT_FEATURES: true,
  NFT_METADATA_SERVER: 'https://staging-nft-metadata.valkyrie-wallet.com',
  
  // Sync Configuration
  SYNC_INTERVAL: 60000, // 1 minute
  BACKGROUND_SYNC_INTERVAL: 300000, // 5 minutes
  
  // Rate Limiting
  API_RATE_LIMIT: 500, // requests per minute
  API_RATE_WINDOW: 60000, // 1 minute
  
  // Timeouts
  API_TIMEOUT: 30000, // 30 seconds
  TRANSACTION_TIMEOUT: 120000, // 2 minutes
  SYNC_TIMEOUT: 60000, // 1 minute
  
  // Offline Configuration
  OFFLINE_MODE_ENABLED: true,
  OFFLINE_QUEUE_SIZE: 200,
  OFFLINE_RETRY_ATTEMPTS: 5,
  
  // Internationalization
  DEFAULT_LANGUAGE: 'en',
  SUPPORTED_LANGUAGES: ['en', 'vi'],
  
  // Theme Configuration
  DEFAULT_THEME: 'dark',
  ENABLE_THEME_SWITCHING: true,
  
  // Backup Configuration
  BACKUP_REMINDER_INTERVAL: 604800000, // 7 days
  AUTO_BACKUP_ENABLED: true,
  
  // Security Warnings
  WARN_ON_SCREENSHOT: true,
  WARN_ON_ROOT_DEVICE: true,
  BLOCK_ON_JAILBREAK: false, // Warning only in staging
  
  // Certificate Pinning
  ENABLE_CERTIFICATE_PINNING: true,
  PINNED_CERTIFICATES: [
    process.env.BLOCKFROST_CERT_SHA256 || '',
    process.env.BACKEND_CERT_SHA256 || ''
  ],
  
  // Monitoring and Health Checks
  HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
  PERFORMANCE_METRICS_ENABLED: true,
  ERROR_BOUNDARY_ENABLED: true,
  
  // A/B Testing
  ENABLE_AB_TESTING: true,
  AB_TESTING_CONFIG: {
    provider: 'internal',
    sampleRate: 0.1 // 10% of users
  },
  
  // Push Notifications
  ENABLE_PUSH_NOTIFICATIONS: true,
  FCM_SERVER_KEY: process.env.FCM_STAGING_SERVER_KEY || '',
  
  // Database Configuration
  DATABASE_URL: process.env.STAGING_DATABASE_URL || '',
  REDIS_URL: process.env.STAGING_REDIS_URL || '',
  
  // External Services
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
  IPFS_GATEWAY: 'https://staging-ipfs.valkyrie-wallet.com',
  
  // Developer Settings (disabled in staging)
  ENABLE_EXPERIMENTAL_FEATURES: false,
  SHOW_DEBUG_INFO: false,
  ENABLE_PERFORMANCE_OVERLAY: false,
  
  // QA and Testing
  ENABLE_E2E_TESTING: true,
  QA_MODE_ENABLED: true,
  AUTO_SCREENSHOT_ON_ERROR: true,
  
  // Compliance and Legal
  GDPR_COMPLIANCE_ENABLED: true,
  DATA_RETENTION_DAYS: 365,
  ANONYMIZE_USER_DATA: true
};

