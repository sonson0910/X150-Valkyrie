/**
 * Environment configuration with secure defaults
 */

export interface EnvironmentConfig {
  // App Info
  APP_NAME: string;
  APP_VERSION: string;
  BUILD_NUMBER: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';

  // API Configuration
  BLOCKFROST_API_KEY?: string;
  BLOCKFROST_BASE_URL: string;
  COINGECKO_API_KEY?: string;
  
  // Security
  SENTRY_DSN?: string;
  ENABLE_SENTRY: boolean;
  ENABLE_CERTIFICATE_PINNING: boolean;
  
  // Crypto Constants
  PBKDF2_ITERATIONS: number;
  AES_KEY_SIZE: number;
  SALT_SIZE: number;
  
  // Biometric & Quick Pay
  DEFAULT_QUICK_PAY_LIMIT: string; // lovelace
  DEFAULT_DAILY_CAP: string; // lovelace
  BIOMETRIC_TIMEOUT: number; // ms
  IDLE_TIMEOUT: number; // ms
  
  // Network & Performance
  API_TIMEOUT: number; // ms
  MAX_RETRY_ATTEMPTS: number;
  RETRY_DELAY: number; // ms
  CACHE_TTL: number; // ms
  
  // Development
  ENABLE_DEV_LOGS: boolean;
  ENABLE_MOCK_SERVICES: boolean;
  ENABLE_PERFORMANCE_MONITORING: boolean;
}

class Environment {
  private static instance: Environment;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment();
    }
    return Environment.instance;
  }

  private loadConfiguration(): EnvironmentConfig {
    // Get environment variables (works with Expo)
    const env = process.env;
    const isDev = __DEV__;
    const isProd = env.NODE_ENV === 'production';

    return {
      // App Info
      APP_NAME: env.EXPO_PUBLIC_APP_NAME || 'Valkyrie Cardano Wallet',
      APP_VERSION: env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
      BUILD_NUMBER: env.EXPO_PUBLIC_BUILD_NUMBER || '1',
      ENVIRONMENT: isProd ? 'production' : isDev ? 'development' : 'staging',

      // API Configuration  
      BLOCKFROST_API_KEY: env.EXPO_PUBLIC_BLOCKFROST_API_KEY,
      BLOCKFROST_BASE_URL: env.EXPO_PUBLIC_BLOCKFROST_BASE_URL || 'https://cardano-testnet.blockfrost.io/api/v0',
      COINGECKO_API_KEY: env.EXPO_PUBLIC_COINGECKO_API_KEY,

      // Security
      SENTRY_DSN: env.EXPO_PUBLIC_SENTRY_DSN,
      ENABLE_SENTRY: env.EXPO_PUBLIC_ENABLE_SENTRY === 'true' || isProd,
      ENABLE_CERTIFICATE_PINNING: env.EXPO_PUBLIC_ENABLE_CERT_PINNING === 'true' || isProd,

      // Crypto Constants
      PBKDF2_ITERATIONS: parseInt(env.EXPO_PUBLIC_PBKDF2_ITERATIONS || '100000'),
      AES_KEY_SIZE: parseInt(env.EXPO_PUBLIC_AES_KEY_SIZE || '256'),
      SALT_SIZE: parseInt(env.EXPO_PUBLIC_SALT_SIZE || '128'),

      // Biometric & Quick Pay
      DEFAULT_QUICK_PAY_LIMIT: env.EXPO_PUBLIC_DEFAULT_QUICK_PAY_LIMIT || '10000000', // 10 ADA
      DEFAULT_DAILY_CAP: env.EXPO_PUBLIC_DEFAULT_DAILY_CAP || '50000000', // 50 ADA  
      BIOMETRIC_TIMEOUT: parseInt(env.EXPO_PUBLIC_BIOMETRIC_TIMEOUT || '30000'), // 30s
      IDLE_TIMEOUT: parseInt(env.EXPO_PUBLIC_IDLE_TIMEOUT || '120000'), // 2 min

      // Network & Performance
      API_TIMEOUT: parseInt(env.EXPO_PUBLIC_API_TIMEOUT || '10000'), // 10s
      MAX_RETRY_ATTEMPTS: parseInt(env.EXPO_PUBLIC_MAX_RETRY_ATTEMPTS || '3'),
      RETRY_DELAY: parseInt(env.EXPO_PUBLIC_RETRY_DELAY || '1000'), // 1s
      CACHE_TTL: parseInt(env.EXPO_PUBLIC_CACHE_TTL || '300000'), // 5 min

      // Development
      ENABLE_DEV_LOGS: env.EXPO_PUBLIC_ENABLE_DEV_LOGS === 'true' || isDev,
      ENABLE_MOCK_SERVICES: env.EXPO_PUBLIC_ENABLE_MOCK_SERVICES === 'true' || isDev,
      ENABLE_PERFORMANCE_MONITORING: env.EXPO_PUBLIC_ENABLE_PERF_MONITORING === 'true' || isProd,
    };
  }

  get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }

  getAll(): EnvironmentConfig {
    return { ...this.config };
  }

  isDevelopment(): boolean {
    return this.config.ENVIRONMENT === 'development';
  }

  isProduction(): boolean {
    return this.config.ENVIRONMENT === 'production';
  }

  isStaging(): boolean {
    return this.config.ENVIRONMENT === 'staging';
  }

  // Security helpers
  requireApiKey(service: 'blockfrost' | 'coingecko'): string {
    const key = service === 'blockfrost' 
      ? this.config.BLOCKFROST_API_KEY 
      : this.config.COINGECKO_API_KEY;
      
    if (!key) {
      throw new Error(`${service.toUpperCase()}_API_KEY is required but not configured`);
    }
    
    return key;
  }

  // Validation
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Critical configurations for production
    if (this.isProduction()) {
      if (!this.config.BLOCKFROST_API_KEY) {
        errors.push('BLOCKFROST_API_KEY is required in production');
      }
      if (!this.config.SENTRY_DSN) {
        errors.push('SENTRY_DSN is required in production');
      }
    }

    // Security validations
    if (this.config.PBKDF2_ITERATIONS < 10000) {
      errors.push('PBKDF2_ITERATIONS should be at least 10,000 for security');
    }

    if (this.config.AES_KEY_SIZE !== 128 && this.config.AES_KEY_SIZE !== 256) {
      errors.push('AES_KEY_SIZE must be 128 or 256');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Debug info (safe for logging)
  getDebugInfo(): object {
    return {
      environment: this.config.ENVIRONMENT,
      appVersion: this.config.APP_VERSION,
      buildNumber: this.config.BUILD_NUMBER,
      hasBlockfrostKey: !!this.config.BLOCKFROST_API_KEY,
      hasSentryDsn: !!this.config.SENTRY_DSN,
      enableSentry: this.config.ENABLE_SENTRY,
      enableCertPinning: this.config.ENABLE_CERTIFICATE_PINNING,
      // Never expose actual API keys or sensitive data
    };
  }
}

// Singleton export
export const environment = Environment.getInstance();
export default environment;

// Convenience exports for common values
export const ENV = environment.getAll();
export const IS_DEV = environment.isDevelopment();
export const IS_PROD = environment.isProduction();

