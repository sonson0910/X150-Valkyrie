// Copy this file to .env in your project root and fill in your values
// Or configure these as environment variables in your Expo development build

// ==============================================
// IMPORTANT: NEVER COMMIT REAL API KEYS TO GIT
// ==============================================

// App Configuration
export const ENV_EXAMPLE = {
  // Basic app info
  EXPO_PUBLIC_APP_NAME: "Valkyrie Cardano Wallet",
  EXPO_PUBLIC_APP_VERSION: "1.0.0", 
  EXPO_PUBLIC_BUILD_NUMBER: "1",

  // ==============================================
  // API KEYS & ENDPOINTS (REQUIRED)
  // ==============================================
  
  // Blockfrost API - Get your free key from: https://blockfrost.io/
  EXPO_PUBLIC_BLOCKFROST_API_KEY: "your_blockfrost_api_key_here",
  EXPO_PUBLIC_BLOCKFROST_BASE_URL: "https://cardano-testnet.blockfrost.io/api/v0",

  // CoinGecko API (Optional) - For price data
  EXPO_PUBLIC_COINGECKO_API_KEY: "your_coingecko_api_key_here", 

  // ==============================================
  // MONITORING & ANALYTICS
  // ==============================================
  
  // Sentry DSN (Optional) - For error tracking
  EXPO_PUBLIC_SENTRY_DSN: "your_sentry_dsn_here",
  EXPO_PUBLIC_ENABLE_SENTRY: "true",

  // ==============================================
  // SECURITY SETTINGS
  // ==============================================
  
  // Certificate Pinning (Enable in production)
  EXPO_PUBLIC_ENABLE_CERT_PINNING: "false",

  // Cryptographic Settings
  EXPO_PUBLIC_PBKDF2_ITERATIONS: "100000",
  EXPO_PUBLIC_AES_KEY_SIZE: "256", 
  EXPO_PUBLIC_SALT_SIZE: "128",

  // ==============================================
  // BIOMETRIC & QUICK PAY
  // ==============================================
  
  // Quick Pay Limits (in lovelace - 1 ADA = 1,000,000 lovelace)
  EXPO_PUBLIC_DEFAULT_QUICK_PAY_LIMIT: "10000000",  // 10 ADA
  EXPO_PUBLIC_DEFAULT_DAILY_CAP: "50000000",        // 50 ADA

  // Timeouts (in milliseconds)
  EXPO_PUBLIC_BIOMETRIC_TIMEOUT: "30000",           // 30 seconds
  EXPO_PUBLIC_IDLE_TIMEOUT: "120000",               // 2 minutes

  // ==============================================
  // NETWORK & PERFORMANCE
  // ==============================================
  
  // API Configuration
  EXPO_PUBLIC_API_TIMEOUT: "10000",                 // 10 seconds
  EXPO_PUBLIC_MAX_RETRY_ATTEMPTS: "3",
  EXPO_PUBLIC_RETRY_DELAY: "1000",                  // 1 second
  EXPO_PUBLIC_CACHE_TTL: "300000",                  // 5 minutes

  // ==============================================
  // DEVELOPMENT SETTINGS
  // ==============================================
  
  // Development Features
  EXPO_PUBLIC_ENABLE_DEV_LOGS: "true",
  EXPO_PUBLIC_ENABLE_MOCK_SERVICES: "true",
  EXPO_PUBLIC_ENABLE_PERF_MONITORING: "false",
};

// ==============================================
// SETUP INSTRUCTIONS
// ==============================================

console.log(`
🚀 VALKYRIE WALLET ENVIRONMENT SETUP

1. SETUP BLOCKFROST API:
   • Go to https://blockfrost.io/
   • Create free account
   • Get API key for testnet
   • Set EXPO_PUBLIC_BLOCKFROST_API_KEY

2. CONFIGURE SECURITY:
   • For production: Enable certificate pinning
   • Set strong PBKDF2 iterations (100k+)
   • Configure biometric timeouts

3. OPTIONAL INTEGRATIONS:
   • Sentry for error tracking
   • CoinGecko for price data
   • Performance monitoring

4. FOR PRODUCTION:
   • Use mainnet Blockfrost API key
   • Enable certificate pinning
   • Set strong security defaults
   • Enable monitoring

🔐 SECURITY NOTES:
   • Never commit .env file to Git
   • Use different keys for dev/staging/prod
   • Set conservative quick pay limits
   • Enable certificate pinning in production

📚 Documentation:
   See IMPROVEMENTS.md for detailed setup guide
`);

// Sample usage in your code:
// import { environment } from './src/config/Environment';
// const apiKey = environment.get('BLOCKFROST_API_KEY');

