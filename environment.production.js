/**
 * Production environment configuration
 */

module.exports = {
  ENVIRONMENT: 'production',
  
  // API Configuration
  BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PRODUCTION_PROJECT_ID,
  BLOCKFROST_BASE_URL: 'https://cardano-mainnet.blockfrost.io/api/v0',
  
  // Network Configuration
  CARDANO_NETWORK: 'mainnet',
  NETWORK_ID: 1,
  
  // Security Configuration (Maximum security for production)
  PBKDF2_ITERATIONS: 200000, // High security
  AES_KEY_LENGTH: 32,
  
  // Feature Flags
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_NFC: true,
  ENABLE_BLUETOOTH: true,
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: true,
  
  // Logging Configuration (Minimal in production)
  LOG_LEVEL: 'error',
  ENABLE_CONSOLE_LOGS: false,
  ENABLE_FILE_LOGS: true,
  MAX_LOG_FILE_SIZE: 10485760, // 10MB
  MAX_LOG_FILES: 5,
  
  // Cache Configuration
  CACHE_TTL_DEFAULT: 900000, // 15 minutes
  CACHE_TTL_PRICES: 300000, // 5 minutes
  CACHE_TTL_TRANSACTIONS: 300000, // 5 minutes
  
  // Development Tools (all disabled in production)
  ENABLE_FLIPPER: false,
  ENABLE_DEV_MENU: false,
  ENABLE_REMOTE_DEBUGGING: false,
  
  // Test Configuration (all disabled in production)
  MOCK_API_RESPONSES: false,
  MOCK_BIOMETRIC_AUTH: false,
  SKIP_ONBOARDING: false,
  
  // Sentry Configuration
  SENTRY_DSN: process.env.SENTRY_DSN_PRODUCTION,
  SENTRY_ENVIRONMENT: 'production',
  SENTRY_ENABLED: true,
  SENTRY_SAMPLE_RATE: 0.1, // 10% sampling in production
  SENTRY_TRACES_SAMPLE_RATE: 0.1, // 10% performance monitoring
  SENTRY_BEFORE_SEND: true, // Enable data scrubbing
  
  // Analytics Configuration
  MIXPANEL_PROJECT_TOKEN: process.env.MIXPANEL_PRODUCTION_TOKEN,
  GOOGLE_ANALYTICS_ID: process.env.GA_PRODUCTION_ID,
  FIREBASE_CONFIG: {
    apiKey: process.env.FIREBASE_PRODUCTION_API_KEY,
    authDomain: process.env.FIREBASE_PRODUCTION_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PRODUCTION_PROJECT_ID,
    storageBucket: process.env.FIREBASE_PRODUCTION_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_PRODUCTION_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_PRODUCTION_APP_ID,
    measurementId: process.env.FIREBASE_PRODUCTION_MEASUREMENT_ID
  },
  
  // Version and Build Information
  APP_VERSION: process.env.APP_VERSION,
  BUILD_NUMBER: process.env.BUILD_NUMBER,
  BUILD_VARIANT: 'production',
  GIT_COMMIT_HASH: process.env.GIT_COMMIT_HASH,
  BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
  
  // URLs and Endpoints
  TERMS_OF_SERVICE_URL: 'https://valkyrie-wallet.com/terms',
  PRIVACY_POLICY_URL: 'https://valkyrie-wallet.com/privacy',
  SUPPORT_URL: 'https://valkyrie-wallet.com/support',
  API_BASE_URL: 'https://api.valkyrie-wallet.com',
  CDN_BASE_URL: 'https://cdn.valkyrie-wallet.com',
  
  // Wallet Configuration
  DEFAULT_ACCOUNT_NAME: 'Account 1',
  MAX_ACCOUNTS: 20, // Higher limit for production
  ADDRESS_GAP_LIMIT: 20,
  
  // Transaction Configuration
  DEFAULT_TX_FEE: 200000, // 0.2 ADA in lovelace
  MAX_TX_SIZE: 16384, // 16KB
  MIN_UTXO_VALUE: 1000000, // 1 ADA in lovelace
  MAX_TX_FEE: 5000000, // 5 ADA maximum fee
  
  // Staking Configuration
  MIN_STAKE_AMOUNT: 10000000, // 10 ADA in lovelace
  STAKE_POOL_ID: process.env.PRODUCTION_STAKE_POOL_ID,
  RECOMMENDED_STAKE_POOLS: process.env.RECOMMENDED_STAKE_POOLS?.split(',') || [],
  
  // DeFi Configuration
  ENABLE_DEFI_FEATURES: true,
  SUPPORTED_DEX_PROTOCOLS: ['sundaeswap', 'minswap', 'wingriders', 'muesliswap'],
  SLIPPAGE_TOLERANCE: 0.02, // 2%
  
  // NFT Configuration
  ENABLE_NFT_FEATURES: true,
  NFT_METADATA_SERVER: 'https://nft-metadata.valkyrie-wallet.com',
  IPFS_GATEWAYS: [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ],
  
  // Sync Configuration
  SYNC_INTERVAL: 120000, // 2 minutes
  BACKGROUND_SYNC_INTERVAL: 600000, // 10 minutes
  FORCE_SYNC_ON_FOREGROUND: true,
  
  // Rate Limiting (Conservative for production)
  API_RATE_LIMIT: 300, // requests per minute
  API_RATE_WINDOW: 60000, // 1 minute
  API_BURST_LIMIT: 50, // burst requests
  
  // Timeouts
  API_TIMEOUT: 45000, // 45 seconds
  TRANSACTION_TIMEOUT: 180000, // 3 minutes
  SYNC_TIMEOUT: 120000, // 2 minutes
  BIOMETRIC_TIMEOUT: 30000, // 30 seconds
  
  // Offline Configuration
  OFFLINE_MODE_ENABLED: true,
  OFFLINE_QUEUE_SIZE: 500,
  OFFLINE_RETRY_ATTEMPTS: 5,
  OFFLINE_DATA_RETENTION_DAYS: 30,
  
  // Internationalization
  DEFAULT_LANGUAGE: 'en',
  SUPPORTED_LANGUAGES: ['en', 'vi'],
  AUTO_DETECT_LANGUAGE: true,
  
  // Theme Configuration
  DEFAULT_THEME: 'dark',
  ENABLE_THEME_SWITCHING: true,
  
  // Backup Configuration
  BACKUP_REMINDER_INTERVAL: 604800000, // 7 days
  AUTO_BACKUP_ENABLED: true,
  BACKUP_ENCRYPTION_ENABLED: true,
  
  // Security Configuration (Maximum security)
  WARN_ON_SCREENSHOT: true,
  WARN_ON_ROOT_DEVICE: true,
  BLOCK_ON_JAILBREAK: true, // Block on production
  REQUIRE_BIOMETRIC_FOR_TRANSACTIONS: true,
  SESSION_TIMEOUT: 900000, // 15 minutes
  AUTO_LOCK_TIMEOUT: 300000, // 5 minutes
  
  // Certificate Pinning (Mandatory in production)
  ENABLE_CERTIFICATE_PINNING: true,
  PINNED_CERTIFICATES: [
    process.env.BLOCKFROST_CERT_SHA256,
    process.env.API_CERT_SHA256,
    process.env.CDN_CERT_SHA256
  ],
  
  // Anti-Tampering
  ENABLE_ROOT_DETECTION: true,
  ENABLE_DEBUGGER_DETECTION: true,
  ENABLE_EMULATOR_DETECTION: true,
  OBFUSCATION_ENABLED: true,
  
  // Monitoring and Health Checks
  HEALTH_CHECK_INTERVAL: 180000, // 3 minutes
  PERFORMANCE_METRICS_ENABLED: true,
  ERROR_BOUNDARY_ENABLED: true,
  MEMORY_WARNING_THRESHOLD: 50 * 1024 * 1024, // 50MB
  
  // Business Logic
  ENABLE_AB_TESTING: true,
  AB_TESTING_CONFIG: {
    provider: 'firebase',
    sampleRate: 0.05 // 5% of users
  },
  
  // Push Notifications
  ENABLE_PUSH_NOTIFICATIONS: true,
  FCM_SERVER_KEY: process.env.FCM_PRODUCTION_SERVER_KEY,
  NOTIFICATION_CATEGORIES: ['transactions', 'staking', 'security', 'updates'],
  
  // Database Configuration
  DATABASE_URL: process.env.PRODUCTION_DATABASE_URL,
  DATABASE_POOL_SIZE: 20,
  DATABASE_TIMEOUT: 30000,
  REDIS_URL: process.env.PRODUCTION_REDIS_URL,
  REDIS_CLUSTER_ENABLED: true,
  
  // CDN and Assets
  ENABLE_CDN: true,
  ASSET_CDN_URL: 'https://assets.valkyrie-wallet.com',
  CACHE_CONTROL_MAX_AGE: 86400, // 24 hours
  
  // External Services
  COINGECKO_API_KEY: process.env.COINGECKO_PRODUCTION_API_KEY,
  COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY,
  IPFS_GATEWAY: 'https://ipfs.valkyrie-wallet.com',
  
  // Developer Settings (all disabled in production)
  ENABLE_EXPERIMENTAL_FEATURES: false,
  SHOW_DEBUG_INFO: false,
  ENABLE_PERFORMANCE_OVERLAY: false,
  
  // Compliance and Legal
  GDPR_COMPLIANCE_ENABLED: true,
  CCPA_COMPLIANCE_ENABLED: true,
  DATA_RETENTION_DAYS: 2555, // 7 years
  ANONYMIZE_USER_DATA: true,
  ENABLE_DATA_EXPORT: true,
  ENABLE_DATA_DELETION: true,
  
  // Update Configuration
  ENABLE_AUTO_UPDATES: true,
  FORCE_UPDATE_VERSION: process.env.FORCE_UPDATE_VERSION,
  UPDATE_CHECK_INTERVAL: 86400000, // 24 hours
  
  // Crisis Management
  KILL_SWITCH_ENABLED: true,
  MAINTENANCE_MODE_ENABLED: false,
  FEATURE_KILL_SWITCHES: {
    transactions: false,
    staking: false,
    defi: false,
    nft: false
  },
  
  // Performance Optimizations
  ENABLE_IMAGE_COMPRESSION: true,
  ENABLE_REQUEST_COMPRESSION: true,
  ENABLE_RESPONSE_CACHING: true,
  BUNDLE_SPLITTING_ENABLED: true,
  
  // Audit and Compliance
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_RETENTION_DAYS: 2555, // 7 years
  PCI_COMPLIANCE_MODE: true,
  SOC2_COMPLIANCE_MODE: true
};

