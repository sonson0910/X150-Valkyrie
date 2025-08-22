import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAsyncEffect, useSafeState, useMemoryCleanup } from '../utils/MemoryOptimizer';
import { withScreenMemoryOptimization } from '../utils/withMemoryOptimization';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { GradientButton } from '../components/ui/GradientButton';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import { tokens } from '../theme/tokens';
import { 
  BalanceSkeleton, 
  QuickActionsSkeleton, 
  TransactionSkeleton 
} from '../components/index';
import { WalletDataService, TransactionData } from '../services/WalletDataService';
import { CardanoAPIService } from '../services/CardanoAPIService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletStateService } from '../services/WalletStateService';

type WalletHomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WalletHome'>;

interface Props {
  navigation: WalletHomeScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const WalletHomeScreen: React.FC<Props> = ({ navigation }) => {
  // Memory-optimized state with safe setters
  const [balance, setBalance, isMounted] = useSafeState('0', 'WalletHomeScreen');
  const [isRefreshing, setIsRefreshing] = useSafeState(false, 'WalletHomeScreen');
  const [isLoading, setIsLoading] = useSafeState(true, 'WalletHomeScreen');
  const [isLoadingTransactions, setIsLoadingTransactions] = useSafeState(false, 'WalletHomeScreen');
  const [recentTransactions, setRecentTransactions] = useSafeState<TransactionData[]>([], 'WalletHomeScreen');
  
  // Memory cleanup utilities
  const { addSubscription, isMounted: isComponentMounted } = useMemoryCleanup('WalletHomeScreen');

  // Get current wallet address from wallet state
  const getCurrentWalletAddress = async (): Promise<string> => {
    try {
      const state = WalletStateService.getInstance();
      if (!state.getCurrentAddress()) await state.initialize();
      const addr = state.getCurrentAddress();
      if (addr) return addr;
    } catch {}
    try {
      const storedAddress = await AsyncStorage.getItem('current_wallet_address');
      if (storedAddress) return storedAddress;
    } catch {}
    return 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer';
  };

  // Memory-safe async effect
  useAsyncEffect(async () => {
    try {
      setIsLoading(true);
      
      // Use real wallet data service
      const walletDataService = WalletDataService.getInstance();
      const currentAddress = await getCurrentWalletAddress();
      
      // Only proceed if component is still mounted
      if (!isComponentMounted()) return;
      
      const [currentBalance, transactions] = await Promise.all([
        walletDataService.getRealBalance(currentAddress),
        walletDataService.getRealTransactionHistory(currentAddress, 10)
      ]);
      
      // Check again before setting state
      if (!isComponentMounted()) return;
      
      setBalance(currentBalance);
      setRecentTransactions(transactions);
      setIsLoading(false);
      
    } catch (error) {
      if (isComponentMounted()) {
        console.error('Failed to load wallet data:', error);
        setIsLoading(false);
      }
    }
  }, [], 'WalletHomeScreen');

  const onRefresh = async () => {
    try {
      setIsRefreshing(true);
      
      // Use real wallet data service for refresh
      const walletDataService = WalletDataService.getInstance();
      const currentAddress = await getCurrentWalletAddress();
      
      const [currentBalance, transactions] = await Promise.all([
        walletDataService.getRealBalance(currentAddress),
        walletDataService.getRealTransactionHistory(currentAddress, 10)
      ]);
      
      setBalance(currentBalance);
      setRecentTransactions(transactions);
      
      setIsRefreshing(false);
    } catch (error) {
      console.error('Failed to refresh wallet data:', error);
      setIsRefreshing(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch (action) {
      case 'send':
        navigation.navigate('SendTransaction' as any);
        break;
      case 'receive':
        navigation.navigate('ReceiveScreen' as any);
        break;
      case 'offline':
        navigation.navigate('OfflineTransaction' as any);
        break;
      case 'settings':
        navigation.navigate('Settings' as any);
        break;
    }
  };

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('SendTransaction' as any)}
        >
          <Text style={styles.quickActionIcon}>📤</Text>
          <Text style={styles.quickActionText}>Send</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('ReceiveScreen' as any)}
        >
          <Text style={styles.quickActionIcon}>📥</Text>
          <Text style={styles.quickActionText}>Receive</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('TransactionHistory')}
        >
          <Text style={styles.quickActionIcon}>📊</Text>
          <Text style={styles.quickActionText}>History</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('OfflineTransaction')}
        >
          <Text style={styles.quickActionIcon}>🔄</Text>
          <Text style={styles.quickActionText}>Offline</Text>
        </TouchableOpacity>
      </View>

      {/* Advanced Features */}
      <View style={styles.advancedFeaturesContainer}>
        <Text style={styles.sectionTitle}>Advanced Features</Text>
        
        <View style={styles.advancedFeaturesGrid}>
          <TouchableOpacity
            style={styles.advancedFeatureButton}
            onPress={() => navigation.navigate('MultiSignature')}
          >
            <Text style={styles.advancedFeatureIcon}>🔐</Text>
            <Text style={styles.advancedFeatureText}>Multi-Sig</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.advancedFeatureButton}
            onPress={() => navigation.navigate('NFTGallery')}
          >
            <Text style={styles.advancedFeatureIcon}>🖼️</Text>
            <Text style={styles.advancedFeatureText}>NFTs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.advancedFeatureButton}
            onPress={() => navigation.navigate('DeFiStaking')}
          >
            <Text style={styles.advancedFeatureIcon}>🏗️</Text>
            <Text style={styles.advancedFeatureText}>DeFi</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.advancedFeatureButton}
            onPress={() => navigation.navigate('PortfolioAnalytics')}
          >
            <Text style={styles.advancedFeatureIcon}>📈</Text>
            <Text style={styles.advancedFeatureText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={tokens.palette.primary} />}>        
        <Container padded={false}>
          {isLoading ? (
            <BalanceSkeleton />
          ) : (
            <Card glow style={{ marginBottom: tokens.spacing.xl }}>
              <Text style={{ color: tokens.palette.textSecondary, marginBottom: tokens.spacing.xs }}>Total Balance</Text>
              <Text style={{ color: tokens.palette.primary, fontSize: 36, fontWeight: '800', letterSpacing: 0.5 }}>{balance} ADA</Text>
              {/* Hide fiat estimate when network/API uncertain */}
              <View style={{ height: tokens.spacing.lg }} />
              <ResponsiveGrid>
                <GradientButton title="Send" onPress={() => navigation.navigate('SendTransaction' as any)} />
                <GradientButton title="Receive" colors={[tokens.palette.accent, tokens.palette.accentAlt]} onPress={() => navigation.navigate('ReceiveScreen' as any)} />
                <GradientButton title="Offline" colors={[tokens.palette.primaryAlt, tokens.palette.primary]} onPress={() => navigation.navigate('OfflineTransaction' as any)} />
                <GradientButton title="Settings" colors={[tokens.palette.surfaceAlt, tokens.palette.accent]} onPress={() => navigation.navigate('Settings' as any)} />
              </ResponsiveGrid>
            </Card>
          )}

          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {isLoading ? (
            <>
              <TransactionSkeleton />
              <TransactionSkeleton />
              <TransactionSkeleton />
            </>
          ) : (
            <>
              {recentTransactions.map((tx: TransactionData) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
              <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('TransactionHistory')}>
                <Text style={styles.viewAllText}>View All Transactions</Text>
              </TouchableOpacity>
            </>
          )}
        </Container>
      </ScrollView>
    </LinearGradient>
  );
};

const QuickActionButton: React.FC<{
  icon: string;
  title: string;
  onPress: () => void;
}> = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
    <View style={styles.quickActionIconContainer}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
    </View>
    <Text style={styles.quickActionTitle}>{title}</Text>
  </TouchableOpacity>
);

const TransactionItem: React.FC<{
  transaction: TransactionData;
}> = ({ transaction }) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionIcon}>
      <Text style={styles.transactionIconText}>
        {transaction.type === 'received' ? '📥' : 
         transaction.type === 'sent' ? '📤' : '🔄'}
      </Text>
    </View>
    
    <View style={styles.transactionDetails}>
      <Text style={styles.transactionAddress}>
        {transaction.from || transaction.to || 'Unknown Address'}
      </Text>
      <Text style={styles.transactionTimestamp}>
        {transaction.timestamp instanceof Date ? transaction.timestamp.toLocaleDateString() : String(transaction.timestamp)}
      </Text>
    </View>
    
    <View style={styles.transactionAmount}>
      <Text style={[
        styles.transactionAmountText,
        { color: transaction.type === 'received' ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.text }
      ]}>
        {transaction.type === 'received' ? '+' : '-'}{transaction.amount} ADA
      </Text>
      <View style={[
        styles.transactionStatus,
        { backgroundColor: transaction.status === 'confirmed' ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.warning }
      ]}>
        <Text style={styles.transactionStatusText}>{transaction.status}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  balanceLabel: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  quickActionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionTitle: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  transactionsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CYBERPUNK_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAddress: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionTimestamp: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transactionStatusText: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.background,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
  },
  quickActionsContainer: {
    marginBottom: 32,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActionText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  advancedFeaturesContainer: {
    marginTop: 24,
  },
  advancedFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  advancedFeatureButton: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  advancedFeatureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  advancedFeatureText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
});

// Export with memory optimization
export default withScreenMemoryOptimization(WalletHomeScreen, {
  componentName: 'WalletHomeScreen',
  enablePerformanceMonitoring: true,
  maxLifetimeWarning: 600000 // 10 minutes
});
