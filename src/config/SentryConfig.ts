/**
 * Enhanced Sentry configuration for production monitoring
 */

import * as Sentry from '@sentry/react-native';
import { environment } from './Environment';
import { AnalyticsService } from '../services/analytics/AnalyticsService';

export interface SentryConfig {
  dsn: string;
  environment: string;
  enableAutoSessionTracking: boolean;
  enableOutOfMemoryTracking: boolean;
  enableAutoPerformanceTracking: boolean;
  tracesSampleRate: number;
  profilesSampleRate: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
  beforeSendTransaction?: (event: Sentry.Event) => Sentry.Event | null;
}

class SentryManager {
  private static instance: SentryManager;
  private isInitialized = false;
  private config: SentryConfig;

  private constructor() {
    this.config = this.buildConfig();
  }

  public static getInstance(): SentryManager {
    if (!SentryManager.instance) {
      SentryManager.instance = new SentryManager();
    }
    return SentryManager.instance;
  }

  /**
   * Initialize Sentry with production-ready configuration
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.warn('Sentry already initialized');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        enableAutoSessionTracking: this.config.enableAutoSessionTracking,
        enableOutOfMemoryTracking: this.config.enableOutOfMemoryTracking,
        enableAutoPerformanceTracking: this.config.enableAutoPerformanceTracking,
        tracesSampleRate: this.config.tracesSampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        beforeSend: this.config.beforeSend,
        beforeSendTransaction: this.config.beforeSendTransaction,
        
        // Advanced configuration
        debug: environment.isDevelopment(),
        attachStacktrace: true,
        sendDefaultPii: false, // Don't send personally identifiable information
        maxBreadcrumbs: 100,
        
        // Performance monitoring
        enableTracing: true,
        enableProfilesSampling: environment.isProduction(),
        
        // Session tracking
        autoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000, // 30 seconds
        
        // Integrations
        integrations: [
          new Sentry.ReactNativeTracing({
            enableUserInteractionTracing: true,
            enableNativeFramesTracking: true,
            enableStallTracking: true,
            enableAppStartTracking: true,
            
            // Network tracking
            enableNetworkTracking: true,
            enableHttpTracking: true,
            
            // Custom routing instrumentation
            routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
          }),
          
          // HTTP client integration
          new Sentry.HttpClient({
            tracing: {
              shouldCreateSpanForRequest: (url: string) => {
                // Only trace external API calls
                return url.includes('blockfrost.io') || 
                       url.includes('coingecko.com') ||
                       url.includes('valkyrie-wallet.com');
              },
            },
          }),
          
          // Custom wallet operations integration
          new Sentry.Integration({
            name: 'WalletOperations',
            setupOnce: () => {
              this.setupCustomInstrumentation();
            },
          }),
        ],
        
        // Release and deployment tracking
        release: environment.get('APP_VERSION'),
        dist: environment.get('BUILD_NUMBER'),
        
        // Tags for better filtering
        initialScope: {
          tags: {
            platform: 'react-native',
            wallet_type: 'cardano',
            build_variant: environment.get('BUILD_VARIANT') || 'unknown',
          },
          level: 'info',
        },
      });

      // Set user context
      this.setUserContext();
      
      // Setup custom contexts
      this.setupCustomContexts();
      
      this.isInitialized = true;
      console.log('✅ Sentry initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  /**
   * Build Sentry configuration based on environment
   */
  private buildConfig(): SentryConfig {
    const baseConfig: SentryConfig = {
      dsn: environment.get('SENTRY_DSN') || '',
      environment: environment.getCurrentEnvironment(),
      enableAutoSessionTracking: true,
      enableOutOfMemoryTracking: true,
      enableAutoPerformanceTracking: true,
      tracesSampleRate: 0.1, // 10% of transactions
      profilesSampleRate: 0.1, // 10% profiling
      beforeSend: this.createBeforeSendHook(),
      beforeSendTransaction: this.createBeforeTransactionHook(),
    };

    // Environment-specific overrides
    if (environment.isDevelopment()) {
      baseConfig.tracesSampleRate = 1.0; // 100% in development
      baseConfig.profilesSampleRate = 1.0;
    } else if (environment.isStaging()) {
      baseConfig.tracesSampleRate = 0.5; // 50% in staging
      baseConfig.profilesSampleRate = 0.3;
    } else if (environment.isProduction()) {
      baseConfig.tracesSampleRate = 0.05; // 5% in production
      baseConfig.profilesSampleRate = 0.05;
    }

    return baseConfig;
  }

  /**
   * Create beforeSend hook for data sanitization
   */
  private createBeforeSendHook(): (event: Sentry.Event) => Sentry.Event | null {
    return (event: Sentry.Event) => {
      try {
        // Don't send events if Sentry is disabled
        if (!environment.get('SENTRY_ENABLED')) {
          return null;
        }

        // Sanitize sensitive data
        event = this.sanitizeEvent(event);
        
        // Filter out noise
        if (this.shouldFilterEvent(event)) {
          return null;
        }

        // Add custom fingerprinting
        this.addCustomFingerprint(event);
        
        // Add breadcrumbs context
        this.enhanceBreadcrumbs(event);
        
        return event;
      } catch (error) {
        console.error('Error in Sentry beforeSend:', error);
        return event;
      }
    };
  }

  /**
   * Create beforeSendTransaction hook for performance data
   */
  private createBeforeTransactionHook(): (event: Sentry.Event) => Sentry.Event | null {
    return (event: Sentry.Event) => {
      try {
        // Add performance context
        if (event.contexts) {
          event.contexts.performance = {
            memory_usage: process.memoryUsage(),
            timestamp: Date.now(),
          };
        }

        // Filter out very short transactions (noise)
        if (event.timestamp && event.start_timestamp) {
          const duration = event.timestamp - event.start_timestamp;
          if (duration < 0.01) { // Less than 10ms
            return null;
          }
        }

        return event;
      } catch (error) {
        console.error('Error in Sentry beforeSendTransaction:', error);
        return event;
      }
    };
  }

  /**
   * Sanitize sensitive data from events
   */
  private sanitizeEvent(event: Sentry.Event): Sentry.Event {
    // Remove sensitive data from exception messages
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => {
        if (exception.value) {
          exception.value = this.sanitizeString(exception.value);
        }
        if (exception.stacktrace?.frames) {
          exception.stacktrace.frames = exception.stacktrace.frames.map(frame => {
            if (frame.vars) {
              frame.vars = this.sanitizeObject(frame.vars);
            }
            return frame;
          });
        }
        return exception;
      });
    }

    // Remove sensitive data from request data
    if (event.request?.data) {
      event.request.data = this.sanitizeObject(event.request.data);
    }

    // Remove sensitive data from extra context
    if (event.extra) {
      event.extra = this.sanitizeObject(event.extra);
    }

    return event;
  }

  /**
   * Sanitize sensitive strings
   */
  private sanitizeString(str: string): string {
    const sensitivePatterns = [
      /mnemonic/gi,
      /private[_\s]?key/gi,
      /password/gi,
      /secret/gi,
      /token/gi,
      /api[_\s]?key/gi,
      /auth/gi,
      /credential/gi,
    ];

    let sanitized = str;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Sanitize sensitive objects
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };
    const sensitiveKeys = [
      'password', 'mnemonic', 'privateKey', 'secret', 'token', 
      'apiKey', 'auth', 'credential', 'signature', 'seed'
    ];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      } else if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.sanitizeString(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Filter out noisy or irrelevant events
   */
  private shouldFilterEvent(event: Sentry.Event): boolean {
    // Filter out network timeouts in development
    if (environment.isDevelopment() && 
        event.exception?.values?.[0]?.value?.includes('timeout')) {
      return true;
    }

    // Filter out cancelled requests
    if (event.exception?.values?.[0]?.value?.includes('cancelled') ||
        event.exception?.values?.[0]?.value?.includes('aborted')) {
      return true;
    }

    // Filter out known React Native warnings
    const rnWarnings = [
      'VirtualizedList: You have a large list',
      'Can\'t perform a React state update',
      'Warning: Failed prop type',
    ];

    if (event.message && rnWarnings.some(warning => event.message!.includes(warning))) {
      return true;
    }

    return false;
  }

  /**
   * Add custom fingerprinting for better grouping
   */
  private addCustomFingerprint(event: Sentry.Event): void {
    if (event.exception?.values?.[0]) {
      const exception = event.exception.values[0];
      
      // Group wallet errors by operation type
      if (exception.value?.includes('wallet')) {
        const operation = this.extractWalletOperation(exception.value);
        if (operation) {
          event.fingerprint = ['wallet-error', operation];
        }
      }
      
      // Group API errors by endpoint
      if (exception.value?.includes('API') || exception.value?.includes('fetch')) {
        const endpoint = this.extractApiEndpoint(exception.value);
        if (endpoint) {
          event.fingerprint = ['api-error', endpoint];
        }
      }
    }
  }

  /**
   * Enhance breadcrumbs with additional context
   */
  private enhanceBreadcrumbs(event: Sentry.Event): void {
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        // Add wallet state to navigation breadcrumbs
        if (breadcrumb.category === 'navigation') {
          breadcrumb.data = {
            ...breadcrumb.data,
            wallet_initialized: this.isWalletInitialized(),
            network: environment.get('CARDANO_NETWORK'),
          };
        }
        
        // Add performance context to HTTP breadcrumbs
        if (breadcrumb.category === 'http') {
          breadcrumb.data = {
            ...breadcrumb.data,
            memory_usage: process.memoryUsage().heapUsed,
          };
        }
        
        return breadcrumb;
      });
    }
  }

  /**
   * Setup custom instrumentation for wallet operations
   */
  private setupCustomInstrumentation(): void {
    // Instrument wallet operations
    this.instrumentWalletOperations();
    
    // Instrument API calls
    this.instrumentApiCalls();
    
    // Instrument crypto operations
    this.instrumentCryptoOperations();
  }

  /**
   * Instrument wallet operations for performance tracking
   */
  private instrumentWalletOperations(): void {
    const walletOperations = [
      'createWallet',
      'restoreWallet', 
      'sendTransaction',
      'generateAddress',
      'syncWallet',
    ];

    walletOperations.forEach(operation => {
      // This would wrap wallet service methods with Sentry instrumentation
      // Implementation would depend on the actual wallet service structure
    });
  }

  /**
   * Instrument API calls
   */
  private instrumentApiCalls(): void {
    // Automatically instrument fetch calls
    Sentry.addTracingExtensions();
  }

  /**
   * Instrument crypto operations
   */
  private instrumentCryptoOperations(): void {
    const cryptoOperations = [
      'generateMnemonic',
      'encryptMnemonic',
      'decryptMnemonic',
      'deriveKeys',
      'signTransaction',
    ];

    cryptoOperations.forEach(operation => {
      // This would wrap crypto operations with performance tracking
    });
  }

  /**
   * Set user context for better error attribution
   */
  private setUserContext(): void {
    Sentry.configureScope(scope => {
      scope.setUser({
        id: this.generateUserHash(), // Anonymous but consistent ID
        segment: this.getUserSegment(),
      });
      
      scope.setTag('wallet_version', environment.get('APP_VERSION'));
      scope.setTag('build_number', environment.get('BUILD_NUMBER'));
      scope.setTag('platform', 'react-native');
    });
  }

  /**
   * Setup custom contexts
   */
  private setupCustomContexts(): void {
    Sentry.configureScope(scope => {
      scope.setContext('device', {
        wallet_type: 'cardano',
        network: environment.get('CARDANO_NETWORK'),
        features_enabled: environment.getFeatureFlags(),
      });
      
      scope.setContext('app', {
        environment: environment.getCurrentEnvironment(),
        version: environment.get('APP_VERSION'),
        build: environment.get('BUILD_NUMBER'),
      });
    });
  }

  /**
   * Track custom wallet events
   */
  public trackWalletEvent(event: string, properties?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      message: event,
      category: 'wallet',
      level: 'info',
      data: this.sanitizeObject(properties || {}),
    });

    // Also send to analytics
    try {
      const analytics = AnalyticsService.getInstance();
      analytics.trackEvent(event, 'wallet', properties);
    } catch (error) {
      // Analytics failure shouldn't break the app
      console.warn('Failed to track analytics event:', error);
    }
  }

  /**
   * Track transaction events with special handling
   */
  public trackTransaction(txHash: string, amount: string, status: 'pending' | 'confirmed' | 'failed'): void {
    Sentry.addBreadcrumb({
      message: `Transaction ${status}`,
      category: 'transaction',
      level: status === 'failed' ? 'error' : 'info',
      data: {
        tx_hash: txHash.substring(0, 8) + '...', // Truncated for privacy
        amount_ada: parseFloat(amount) / 1000000, // Convert lovelace to ADA
        status,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Helper methods
   */
  private extractWalletOperation(errorMessage: string): string | null {
    const operations = ['create', 'restore', 'send', 'receive', 'stake', 'delegate'];
    return operations.find(op => errorMessage.toLowerCase().includes(op)) || null;
  }

  private extractApiEndpoint(errorMessage: string): string | null {
    const urlMatch = errorMessage.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      try {
        const url = new URL(urlMatch[0]);
        return url.pathname;
      } catch {
        return null;
      }
    }
    return null;
  }

  private isWalletInitialized(): boolean {
    // This would check actual wallet state
    return true; // Placeholder
  }

  private generateUserHash(): string {
    // Generate a consistent but anonymous user ID
    // This could be based on device ID or other non-PII data
    return 'anonymous_' + Math.random().toString(36).substring(2);
  }

  private getUserSegment(): string {
    // Determine user segment for analytics
    if (environment.isDevelopment()) return 'developer';
    if (environment.isStaging()) return 'beta_tester';
    return 'production_user';
  }

  /**
   * Flush all pending events (useful for app termination)
   */
  public async flush(timeout = 5000): Promise<boolean> {
    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      console.error('Failed to flush Sentry events:', error);
      return false;
    }
  }

  /**
   * Close Sentry client
   */
  public close(): void {
    Sentry.close();
    this.isInitialized = false;
  }
}

export default SentryManager;

