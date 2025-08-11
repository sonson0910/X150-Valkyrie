import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '@constants/index';
import { Transaction, TransactionStatus } from '../types/wallet';
import { CardanoAPIService } from '@services/CardanoAPIService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { 
  CyberpunkCard, 
  TransactionSkeleton,
  CyberpunkModal,
  CyberpunkButton 
} from '@components/index';

type TransactionHistoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TransactionHistory'>;

interface Props {
  navigation: TransactionHistoryScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const TransactionHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received' | 'pending'>('all');

  // Mock transaction data
  const mockTransactions: Transaction[] = [
    {
      id: 'tx_1',
      hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
      amount: '25500000',
      fee: '200000',
      from: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      to: 'addr1qy3fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      status: TransactionStatus.CONFIRMED,
      timestamp: new Date('2024-01-15T10:30:00Z'),
      isOffline: false
    },
    {
      id: 'tx_2',
      hash: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1',
      amount: '5000000',
      fee: '180000',
      from: 'addr1qy3fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      to: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      status: TransactionStatus.CONFIRMED,
      timestamp: new Date('2024-01-14T15:45:00Z'),
      isOffline: false
    },
    {
      id: 'tx_3',
      amount: '12750000',
      fee: '220000',
      from: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      to: 'addr1qz4fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      status: TransactionStatus.QUEUED,
      timestamp: new Date('2024-01-13T20:15:00Z'),
      isOffline: true
    },
    {
      id: 'tx_4',
      hash: 'd4e5f6789012345678901234567890123456789012345678901234567890a1b2c3',
      amount: '100000000',
      fee: '250000',
      from: 'addr1qw1fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      to: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      status: TransactionStatus.CONFIRMED,
      timestamp: new Date('2024-01-12T08:00:00Z'),
      isOffline: false
    },
    {
      id: 'tx_5',
      amount: '3200000',
      fee: '170000',
      from: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      to: 'addr1qv5fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs',
      status: TransactionStatus.PENDING,
      timestamp: new Date('2024-01-11T14:22:00Z'),
      isOffline: false
    }
  ];

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadTransactions();
    setIsRefreshing(false);
  };

  const getFilteredTransactions = () => {
    const userAddress = 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs';
    
    return transactions.filter((tx: Transaction) => {
      switch (filter) {
        case 'sent':
          return tx.from === userAddress;
        case 'received':
          return tx.to === userAddress;
        case 'pending':
          return tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.QUEUED;
        default:
          return true;
      }
    });
  };

  const handleTransactionPress = async (transaction: Transaction) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTransaction(transaction);
  };

  const closeTransactionModal = () => {
    setSelectedTransaction(null);
  };

  // Open transaction in blockchain explorer
  const openTransactionInExplorer = async (txHash?: string) => {
    if (!txHash) {
      Alert.alert('Error', 'Transaction hash not available');
      return;
    }

    try {
      // Determine network and open appropriate explorer
      const network = await getCurrentNetwork();
      const explorerUrl = getExplorerUrl(txHash, network);
      
      // Open URL in device browser
      Linking.openURL(explorerUrl);
    } catch (error) {
      console.error('Failed to open explorer:', error);
      Alert.alert('Error', 'Failed to open blockchain explorer');
    }
  };

  // Get current network from wallet state
  const getCurrentNetwork = async (): Promise<string> => {
    try {
      // Get from wallet state management
      const storedNetwork = await AsyncStorage.getItem('current_network');
      if (storedNetwork) {
        return storedNetwork;
      }
      
      // Get network from Cardano API service
      try {
        const cardanoAPI = CardanoAPIService.getInstance();
        const network = cardanoAPI.getNetwork();
        return network;
      } catch (apiError) {
        console.warn('Failed to get network from API, using mainnet:', apiError);
      }
      
      // Fallback to mainnet
      return 'mainnet';
    } catch (error) {
      console.warn('Failed to get network, using mainnet:', error);
      return 'mainnet';
    }
  };

  // Get explorer URL for transaction
  const getExplorerUrl = (txHash: string, network: string): string => {
    const baseUrl = network === 'mainnet' 
      ? 'https://explorer.cardano.org'
      : 'https://explorer.cardano-testnet.io';
    
    return `${baseUrl}/en/transaction?id=${txHash}`;
  };

  const getTransactionType = (transaction: Transaction): 'sent' | 'received' => {
    const userAddress = 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs';
    return transaction.from === userAddress ? 'sent' : 'received';
  };

  const formatAmount = (amount: string): string => {
    return (parseInt(amount) / 1000000).toFixed(2);
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const type = getTransactionType(item);
    const amountADA = formatAmount(item.amount);
    
    return (
      <TouchableOpacity onPress={() => handleTransactionPress(item)}>
        <CyberpunkCard style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <View style={styles.transactionIcon}>
              <Text style={styles.transactionIconText}>
                {type === 'received' ? '📥' : 
                 item.isOffline ? '🔄' : '📤'}
              </Text>
            </View>
            
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionType}>
                {type === 'received' ? 'Received' : 'Sent'}
                {item.isOffline && ' (Offline)'}
              </Text>
              <Text style={styles.transactionAddress}>
                {type === 'received' ? `From: ${formatAddress(item.from)}` : `To: ${formatAddress(item.to)}`}
              </Text>
              <Text style={styles.transactionTime}>
                {item.timestamp.toLocaleDateString()} {item.timestamp.toLocaleTimeString()}
              </Text>
            </View>
            
            <View style={styles.transactionAmount}>
              <Text style={[
                styles.transactionAmountText,
                { color: type === 'received' ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.text }
              ]}>
                {type === 'received' ? '+' : '-'}{amountADA} ADA
              </Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) }
              ]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
          </View>
          
          {item.hash && (
            <View style={styles.transactionFooter}>
              <Text style={styles.hashLabel}>Hash:</Text>
              <Text style={styles.hashText}>{formatAddress(item.hash)}</Text>
            </View>
          )}
        </CyberpunkCard>
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status: TransactionStatus): string => {
    switch (status) {
      case TransactionStatus.CONFIRMED:
        return CYBERPUNK_COLORS.success;
      case TransactionStatus.PENDING:
      case TransactionStatus.QUEUED:
        return CYBERPUNK_COLORS.warning;
      case TransactionStatus.FAILED:
        return CYBERPUNK_COLORS.error;
      default:
        return CYBERPUNK_COLORS.border;
    }
  };

  const renderFilterButton = (filterType: typeof filter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonActive
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderTransactionDetails = () => {
    if (!selectedTransaction) return null;

    const type = getTransactionType(selectedTransaction);
    const amountADA = formatAmount(selectedTransaction.amount);
    const feeADA = formatAmount(selectedTransaction.fee);

    return (
      <CyberpunkModal
        visible={!!selectedTransaction}
        onClose={closeTransactionModal}
        title="Transaction Details"
      >
        <View style={styles.modalContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>
              {type === 'received' ? 'Received' : 'Sent'}
              {selectedTransaction.isOffline && ' (Offline)'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount:</Text>
            <Text style={[
              styles.detailValue,
              styles.amountValue,
              { color: type === 'received' ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.text }
            ]}>
              {type === 'received' ? '+' : '-'}{amountADA} ADA
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fee:</Text>
            <Text style={styles.detailValue}>{feeADA} ADA</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(selectedTransaction.status) }
            ]}>
              <Text style={styles.statusText}>{selectedTransaction.status}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>
              {selectedTransaction.timestamp.toLocaleDateString()} {selectedTransaction.timestamp.toLocaleTimeString()}
            </Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>From Address:</Text>
            <Text style={styles.addressText}>{selectedTransaction.from}</Text>
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>To Address:</Text>
            <Text style={styles.addressText}>{selectedTransaction.to}</Text>
          </View>

          {selectedTransaction.hash && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Transaction Hash:</Text>
              <Text style={styles.addressText}>{selectedTransaction.hash}</Text>
            </View>
          )}

          <CyberpunkButton
            title="View on Explorer"
            onPress={() => {
              // Open transaction in blockchain explorer
              openTransactionInExplorer(selectedTransaction?.hash);
              closeTransactionModal();
            }}
            variant="outline"
            style={styles.explorerButton}
          />
        </View>
      </CyberpunkModal>
    );
  };

  const filteredTransactions = getFilteredTransactions();

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('received', 'Received')}
        {renderFilterButton('sent', 'Sent')}
        {renderFilterButton('pending', 'Pending')}
      </View>

      {/* Transaction List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <TransactionSkeleton />
          <TransactionSkeleton />
          <TransactionSkeleton />
          <TransactionSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={({ item }: { item: Transaction }) => renderTransactionItem({ item })}
          keyExtractor={(item: Transaction) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={CYBERPUNK_COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' 
                  ? 'Your transactions will appear here' 
                  : `No ${filter} transactions found`}
              </Text>
            </View>
          }
        />
      )}

      {renderTransactionDetails()}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    borderColor: CYBERPUNK_COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: CYBERPUNK_COLORS.background,
  },
  loadingContainer: {
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionCard: {
    marginBottom: 12,
    padding: 0,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  transactionAddress: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 2,
  },
  transactionTime: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.background,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  transactionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: CYBERPUNK_COLORS.border,
    marginTop: 8,
    paddingTop: 12,
  },
  hashLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginRight: 8,
  },
  hashText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    opacity: 0.7,
  },
  modalContent: {
    paddingVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addressText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  explorerButton: {
    marginTop: 16,
  },
});

export default TransactionHistoryScreen;
