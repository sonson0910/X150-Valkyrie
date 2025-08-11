import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';

// Import web polyfills for Cardano compatibility
import './src/polyfills/web-polyfills';
import './src/polyfills/mime-buffer-fix';
import './src/polyfills/cardano-web-fix';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@contexts/ToastContext';

import { RootStackParamList } from './src/types/navigation';
import { ErrorHandler } from './src/services/ErrorHandler';
import { BiometricService } from './src/services/BiometricService';

// Import screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import SetupWalletScreen from './src/screens/SetupWalletScreen';
import WalletHomeScreen from './src/screens/WalletHomeScreen';
import SendTransactionScreen from './src/screens/SendTransactionScreen';
import ReceiveScreen from './src/screens/ReceiveScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BackupWalletScreen from './src/screens/BackupWalletScreen';
import RestoreWalletScreen from './src/screens/RestoreWalletScreen';
import OfflineTransactionScreen from './src/screens/OfflineTransactionScreen';
import MultiSignatureScreen from './src/screens/MultiSignatureScreen';
import NFTGalleryScreen from './src/screens/NFTGalleryScreen';
import DeFiStakingScreen from './src/screens/DeFiStakingScreen';
import PortfolioAnalyticsScreen from './src/screens/PortfolioAnalyticsScreen';
import SubmitResultScreen from './src/screens/SubmitResultScreen';
import GuardianRecoveryScreen from './src/screens/GuardianRecoveryScreen';
import NameServiceManagerScreen from './src/screens/NameServiceManagerScreen';

const Stack = createStackNavigator<RootStackParamList>();

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
    console.error('App Error Boundary caught an error:', error, errorInfo);
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

  useEffect(() => {
    console.log('App component mounted');
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing app...');
      
      // Initialize error handler
      const errorHandler = ErrorHandler.getInstance();
      console.log('Error handler initialized');
      
      // Initialize biometric service
      const biometricService = BiometricService.getInstance();
      const biometric = await biometricService.checkBiometricSupport();
      
      if (biometric.isAvailable) {
        console.log('Biometric available:', biometric.type);
      }
      
      console.log('App initialization completed');
      setIsInitialized(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      // Continue without biometric
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

  if (!isInitialized) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Loading...</Text>
        <Text style={styles.paragraph}>Initializing Cardano Wallet...</Text>
      </View>
    );
  }

  console.log('Rendering main app...');

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
              <Stack.Screen name="WalletHome" component={WalletHomeScreen} />
              <Stack.Screen name="SendTransaction" component={SendTransactionScreen} />
              <Stack.Screen name="ReceiveScreen" component={ReceiveScreen} />
              <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="BackupWallet" component={BackupWalletScreen} />
              <Stack.Screen name="RestoreWallet" component={RestoreWalletScreen} />
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


