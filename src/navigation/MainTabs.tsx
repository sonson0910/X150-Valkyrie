import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, View } from 'react-native';

import WalletHomeScreen from '../screens/WalletHomeScreen';
import SendTransactionScreen from '../screens/SendTransactionScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import TransformedMnemonicScreen from '../screens/TransformedMnemonicScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { tokens } from '../theme/tokens';

type TabParamList = {
  WalletHome: undefined;
  SendTransaction: undefined;
  ReceiveScreen: undefined;
  TransactionHistory: undefined;
  TransformedMnemonic: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const iconMap: Record<keyof TabParamList, string> = {
  WalletHome: 'home-outline',
  SendTransaction: 'arrow-up-circle-outline',
  ReceiveScreen: 'arrow-down-circle-outline',
  TransactionHistory: 'time-outline',
  TransformedMnemonic: 'key-outline',
  Settings: 'settings-outline',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: tokens.palette.primary,
        tabBarInactiveTintColor: tokens.palette.textSecondary,
        tabBarIcon: ({ color, size }) => {
          const name = iconMap[route.name as keyof TabParamList];
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 24 : 16,
          height: 72,
          backgroundColor: tokens.palette.surfaceAlt + 'CC',
          borderTopWidth: 0,
          borderRadius: tokens.radii.xl,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: 'transparent' }} />,
      })}
    >
      <Tab.Screen name="WalletHome" component={WalletHomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="SendTransaction" component={SendTransactionScreen} options={{ title: 'Send' }} />
      <Tab.Screen name="ReceiveScreen" component={ReceiveScreen} options={{ title: 'Receive' }} />
      <Tab.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'History' }} />
      <Tab.Screen name="TransformedMnemonic" component={TransformedMnemonicScreen} options={{ title: '36 Words' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}


