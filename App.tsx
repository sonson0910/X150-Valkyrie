import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@contexts/ToastContext';

import { RootStackParamList } from './src/types/navigation';
import { ErrorHandler } from '@services/ErrorHandler';
import { BiometricService } from '@services/BiometricService';

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

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize error handler
      const errorHandler = ErrorHandler.getInstance();
      
      // Initialize biometric service
      const biometricService = BiometricService.getInstance();
      const biometric = await biometricService.checkBiometricSupport();
      
      if (biometric.isAvailable) {
        console.log('Biometric available:', biometric.type);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      // Continue without biometric
      setIsInitialized(true);
    }
  };

  if (!isInitialized) {
    return null; // Or a loading screen
  }

  return (
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
          </Stack.Navigator>
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}


