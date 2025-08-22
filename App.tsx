import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { InteractionManager, View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { enableScreens, enableFreeze } from 'react-native-screens';
import * as Sentry from '@sentry/react-native';
import * as ExpoCrypto from 'expo-crypto';

// Import web polyfills for Cardano compatibility
// Load web-only polyfills conditionally to avoid bundling Node polyfills on native
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./src/polyfills/web-polyfills');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./src/polyfills/mime-buffer-fix');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./src/polyfills/cardano-web-fix');
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@contexts/ToastContext';
import { NetworkService } from './src/services/NetworkService';
import { ConfigurationService } from './src/services/ConfigurationService';
import { WalletStateService } from './src/services/WalletStateService';

import { RootStackParamList } from './src/types/navigation';
import { ErrorHandler } from './src/services/ErrorHandler';
import { BiometricService } from './src/services/BiometricService';
import { environment } from './src/config/Environment';
import logger from './src/utils/Logger';
import DIInitializer from './src/core/di/DIInitializer';
import { DI, Services, DevTools } from './src/core/di';
import { preloadCriticalServices } from './src/utils/LazyLoader';
import { startGlobalMemoryMonitoring } from './src/utils/withMemoryOptimization';
import { setMemoryTracking } from './src/utils/MemoryOptimizer';

// =========================================================================
// LAZY LOADED SCREENS FOR BUNDLE OPTIMIZATION
// =========================================================================

import { createLazyScreen, preloadCriticalComponents } from './src/utils/DynamicImports';

// Primary screens (preloaded for better UX)
const WelcomeScreen = createLazyScreen(
  () => import('./src/screens/WelcomeScreen'),
  'WelcomeScreen',
  { preload: true, preloadDelay: 500 }
);

const SetupWalletScreen = createLazyScreen(
  () => import('./src/screens/SetupWalletScreen'),
  'SetupWalletScreen',
  { preload: true, preloadDelay: 1000 }
);

const WalletHomeScreen = createLazyScreen(
  () => import('./src/screens/WalletHomeScreen'),
  'WalletHomeScreen',
  { preload: true, preloadDelay: 0 } // Highest priority
);

// Secondary screens (lazy loaded on demand)
const SendTransactionScreen = createLazyScreen(
  () => import('./src/screens/SendTransactionScreen'),
  'SendTransactionScreen'
);

const ReceiveScreen = createLazyScreen(
  () => import('./src/screens/ReceiveScreen'),
  'ReceiveScreen'
);

const TransactionHistoryScreen = createLazyScreen(
  () => import('./src/screens/TransactionHistoryScreen'),
  'TransactionHistoryScreen'
);

const SettingsScreen = createLazyScreen(
  () => import('./src/screens/SettingsScreen'),
  'SettingsScreen'
);

// Advanced screens (loaded only when needed)
const BackupWalletScreen = createLazyScreen(
  () => import('./src/screens/BackupWalletScreen'),
  'BackupWalletScreen'
);

const RestoreWalletScreen = createLazyScreen(
  () => import('./src/screens/RestoreWalletScreen'),
  'RestoreWalletScreen'
);

const OfflineTransactionScreen = createLazyScreen(
  () => import('./src/screens/OfflineTransactionScreen'),
  'OfflineTransactionScreen'
);

const MultiSignatureScreen = createLazyScreen(
  () => import('./src/screens/MultiSignatureScreen'),
  'MultiSignatureScreen'
);

const NFTGalleryScreen = createLazyScreen(
  () => import('./src/screens/NFTGalleryScreen'),
  'NFTGalleryScreen'
);

const DeFiStakingScreen = createLazyScreen(
  () => import('./src/screens/DeFiStakingScreen'),
  'DeFiStakingScreen'
);

const PortfolioAnalyticsScreen = createLazyScreen(
  () => import('./src/screens/PortfolioAnalyticsScreen'),
  'PortfolioAnalyticsScreen'
);

const SubmitResultScreen = createLazyScreen(
  () => import('./src/screens/SubmitResultScreen'),
  'SubmitResultScreen'
);

const GuardianRecoveryScreen = createLazyScreen(
  () => import('./src/screens/GuardianRecoveryScreen'),
  'GuardianRecoveryScreen'
);

const NameServiceManagerScreen = createLazyScreen(
  () => import('./src/screens/NameServiceManagerScreen'),
  'NameServiceManagerScreen'
);

const TransformedMnemonicScreen = createLazyScreen(
  () => import('./src/screens/TransformedMnemonicScreen'),
  'TransformedMnemonicScreen'
);

// Main navigation (lazy loaded)
const MainTabs = createLazyScreen(
  () => import('./src/navigation/MainTabs'),
  'MainTabs',
  { preload: true, preloadDelay: 1500 }
);

const Stack = createStackNavigator<RootStackParamList>();

// Optimize RN navigation memory/CPU usage
enableScreens(true);
enableFreeze(true);

// Sentry init with comprehensive security configuration
if (environment.get('ENABLE_SENTRY')) {
  const sentryDsn = environment.get('SENTRY_DSN');
  if (sentryDsn) {
    try {
      Sentry.init({
        dsn: sentryDsn,
        tracesSampleRate: environment.isDevelopment() ? 0 : 0.1,
        enableAutoSessionTracking: true,
        debug: environment.isDevelopment(),
        environment: environment.get('ENVIRONMENT'),
        release: `${environment.get('APP_NAME')}@${environment.get('APP_VERSION')}`,
        dist: environment.get('BUILD_NUMBER'),
        beforeSend: (event) => {
          // Remove all sensitive data from events
          if (event.user) {
            delete event.user.ip_address;
            delete event.user.email;
            delete event.user.username;
          }
          
          // Remove sensitive data from breadcrumbs
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
              if (breadcrumb.data) {
                // Remove any data that might contain secrets or PII
                const sanitizedData = { ...breadcrumb.data };
                delete sanitizedData.password;
                delete sanitizedData.mnemonic;
                delete sanitizedData.privateKey;
                delete sanitizedData.address;
                delete sanitizedData.email;
                breadcrumb.data = sanitizedData;
              }
              return breadcrumb;
            });
          }
          
          // Remove sensitive context data
          if (event.contexts) {
            delete event.contexts.device;
            delete event.contexts.os;
          }
          
          return event;
        },
        integrations: [
          // ReactNativeTracing integration for performance monitoring
          // new Sentry.ReactNativeTracing({
          //   tracingOrigins: ['localhost', /^https:\/\/api\.blockfrost\.io\/api/],
          //   enableNativeFramesTracking: !environment.isDevelopment(),
          // }),
        ],
      });
      
      logger.info('Sentry initialized successfully', 'App.sentryInit', { 
        environment: environment.get('ENVIRONMENT'),
        version: environment.get('APP_VERSION')
      });
    } catch (error) {
      logger.error('Failed to initialize Sentry', 'App.sentryInit', error);
    }
  } else {
    logger.warn('Sentry enabled but DSN not configured', 'App.sentryInit');
  }
} else {
  logger.debug('Sentry disabled via environment configuration', 'App.sentryInit');
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('App Error Boundary caught an error', 'ErrorBoundary', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (Platform.OS === 'web') {
        return (
          <View style={styles.centeredContainer}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.paragraph}>Error: {this.state.error?.message}</Text>
            <TouchableOpacity onPress={() => (window as any).location?.reload?.()} style={styles.button}>
              <Text style={styles.buttonText}>Reload Page</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.paragraph}>Please restart the app.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400: Inter_400Regular,
    Inter_500: Inter_500Medium,
    Inter_600: Inter_600SemiBold,
    Inter_700: Inter_700Bold,
  });

  useEffect(() => {
    if (__DEV__) logger.debug('App component mounted', 'App.useEffect');
    // Ensure Buffer polyfill is present on native (Expo Go on Android may miss it)
    try {
      const g: any = global as any;
      if (typeof g.Buffer === 'undefined') {
        g.Buffer = require('buffer').Buffer;
      }
      // Ensure crypto.getRandomValues exists (used by bip39/@noble)
      if (!g.crypto) g.crypto = {} as any;
      if (typeof g.crypto.getRandomValues !== 'function') {
        g.crypto.getRandomValues = (typedArray: Uint8Array) => {
          const bytes: Uint8Array = ExpoCrypto.getRandomBytes(typedArray.length);
          typedArray.set(bytes);
          return typedArray;
        };
      }
    } catch {}
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      if (__DEV__) logger.debug('Initializing app...', 'App.initializeApp');
      
      // 1. Initialize Dependency Injection System FIRST
      if (__DEV__) logger.debug('Initializing DI container...', 'App.initializeApp');
      
      try {
        const diResult = await DIInitializer.safeInitialize();
        
        if (!diResult.success) {
          logger.error('DI initialization failed, using fallback services', 'App.initializeApp', { error: diResult.error });
        } else {
          if (diResult.fallbackMode) {
            logger.warn('DI initialized in fallback mode', 'App.initializeApp');
          } else {
            logger.info('DI system initialized successfully', 'App.initializeApp', {
              serviceCount: DI.serviceCount
            });
            
            // Log DI diagnostics in development
            if (__DEV__) {
              const diagnostics = DevTools.getDiagnostics();
              logger.debug('DI diagnostics', 'App.initializeApp', diagnostics);
            }
          }
        }
      } catch (diError) {
        logger.error('DI initialization completely failed, using legacy services', 'App.initializeApp', diError);
      }
      
      // 2. Initialize critical services (DI or fallback)
      if (DI.isInitialized) {
        // Use DI services where possible
        try {
          const errorHandler = Services.errorHandler;
          const config = Services.config;
          const network = Services.network;
          
          // Initialize services that need explicit initialization
          if (config && typeof (config as any).initialize === 'function') {
            await (config as any).initialize();
          }
          if (network && typeof (network as any).initialize === 'function') {
            await (network as any).initialize();
          }
          
          if (__DEV__) logger.debug('DI services initialized', 'App.initializeApp', {
            errorHandler: !!errorHandler,
            config: !!config,
            network: !!network
          });
          
          // 3. Start background preloading of critical services
          if (__DEV__) logger.debug('Starting background service preload...', 'App.initializeApp');
          preloadCriticalServices().catch(error => {
            logger.warn('Background service preload failed', 'App.initializeApp', error);
          });
          
          // 4. Initialize memory monitoring
          if (__DEV__) logger.debug('Starting memory monitoring...', 'App.initializeApp');
          setMemoryTracking(__DEV__); // Enable memory tracking in development
          const stopMemoryMonitoring = startGlobalMemoryMonitoring(30000); // Monitor every 30 seconds
          
          // Store cleanup function globally for app termination
          (global as any).__memoryMonitoringCleanup = stopMemoryMonitoring;
          
          // 5. Preload critical components for better UX and bundle optimization
          if (__DEV__) logger.debug('Preloading critical components...', 'App.initializeApp');
          preloadCriticalComponents();
          
        } catch (diServiceError) {
          logger.warn('DI service initialization failed, using fallback', 'App.initializeApp', diServiceError);
          // Fall through to legacy initialization
        }
      }
      
      // Legacy service initialization (fallback or if DI failed)
      if (!DI.isInitialized) {
        logger.debug('Using legacy service initialization', 'App.initializeApp');
        
        // Initialize error handler
        ErrorHandler.getInstance();
        
        // Initialize configuration, network and wallet state in parallel
        await Promise.allSettled([
          ConfigurationService.getInstance().initialize(),
          NetworkService.getInstance().initialize(),
          WalletStateService.getInstance().initialize(),
        ]);
      }

      // 3. Persist Blockfrost API key from Expo extra to both networks if provided
      try {
        const extra: any = (require('expo-constants') as any)?.default?.expoConfig?.extra || (require('expo-constants') as any)?.default?.manifest?.extra || {};
        const bfKey: string | undefined = extra?.blockfrostApiKey;
        if (bfKey) {
          let cfg: any;
          if (DI.isInitialized) {
            try {
              cfg = Services.config;
            } catch {
              cfg = ConfigurationService.getInstance();
            }
          } else {
            cfg = ConfigurationService.getInstance();
          }
          
          if (cfg && typeof cfg.setApiKey === 'function') {
            await cfg.setApiKey('blockfrost', 'testnet', bfKey);
            await cfg.setApiKey('blockfrost', 'mainnet', bfKey);
            if (__DEV__) logger.debug('Applied Blockfrost API key from Expo extra', 'App.initializeApp');
          }
        }
      } catch (bfError) {
        logger.warn('Failed to apply Blockfrost API key', 'App.initializeApp', bfError);
      }

      // 4. Defer biometric probing until after interactions to avoid blocking first paint
      InteractionManager.runAfterInteractions(async () => {
        try {
          let biometricService: any;
          if (DI.isInitialized) {
            try {
              biometricService = Services.biometric;
            } catch {
              biometricService = BiometricService.getInstance();
            }
          } else {
            biometricService = BiometricService.getInstance();
          }
          
          if (biometricService && typeof biometricService.checkBiometricSupport === 'function') {
            const biometric = await biometricService.checkBiometricSupport();
            if (__DEV__ && biometric.isAvailable) {
              logger.debug('Biometric available', 'App.initializeApp', { type: biometric.type });
            }
          }
        } catch (bioError) {
          logger.warn('Biometric initialization failed', 'App.initializeApp', bioError);
        }
      });
      
      if (__DEV__) logger.debug('App initialization completed', 'App.initializeApp', {
        diInitialized: DI.isInitialized,
        serviceCount: DI.isInitialized ? DI.serviceCount : 'N/A'
      });
      setIsInitialized(true);
    } catch (error) {
      logger.error('App initialization failed', 'App.initializeApp', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      // Continue even if initialization failed
      setIsInitialized(true);
    }
  };

  if (error) {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>Initialization Error</Text>
          <Text style={styles.paragraph}>{error}</Text>
          <TouchableOpacity onPress={() => (window as any).location?.reload?.()} style={styles.button}>
            <Text style={styles.buttonText}>Reload Page</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Initialization Error</Text>
        <Text style={styles.paragraph}>{error}</Text>
      </View>
    );
  }

  if (!isInitialized || !fontsLoaded) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Loading...</Text>
        <Text style={styles.paragraph}>Initializing Cardano Wallet...</Text>
      </View>
    );
  }

  if (__DEV__) console.log('Rendering main app...');

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="Welcome"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="SetupWallet" component={SetupWalletScreen} />
              <Stack.Screen name="WalletHome" component={MainTabs as any} />
              <Stack.Screen name="SendTransaction" component={SendTransactionScreen} />
              <Stack.Screen name="ReceiveScreen" component={ReceiveScreen} />
              <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="BackupWallet" component={BackupWalletScreen} />
              <Stack.Screen name="RestoreWallet" component={RestoreWalletScreen} />
              <Stack.Screen name="TransformedMnemonic" component={TransformedMnemonicScreen} />
              <Stack.Screen name="OfflineTransaction" component={OfflineTransactionScreen} />
              <Stack.Screen name="MultiSignature" component={MultiSignatureScreen} />
              <Stack.Screen name="NFTGallery" component={NFTGalleryScreen} />
              <Stack.Screen name="DeFiStaking" component={DeFiStakingScreen} />
              <Stack.Screen name="PortfolioAnalytics" component={PortfolioAnalyticsScreen} />
              <Stack.Screen name="SubmitResult" component={SubmitResultScreen} />
              <Stack.Screen name="GuardianRecovery" component={GuardianRecoveryScreen} />
              <Stack.Screen name="NameServiceManager" component={NameServiceManagerScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0b0f2a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff',
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 12,
    color: '#ddd',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#7b5cff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#0b0f2a',
    fontWeight: 'bold',
  },
});


