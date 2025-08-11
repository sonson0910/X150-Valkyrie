import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '@constants/index';
import { OfflineTransactionService } from '@services/OfflineTransactionService';
import { BluetoothTransferService } from '@services/BluetoothTransferService';

type OfflineTransactionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OfflineTransaction'>;

interface Props {
  navigation: OfflineTransactionScreenNavigationProp;
}

const OfflineTransactionScreen: React.FC<Props> = ({ navigation }) => {
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [isMerchantMode, setIsMerchantMode] = useState(false);
  const [nearbyMerchants, setNearbyMerchants] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const offlineService = OfflineTransactionService.getInstance();
  const bluetoothService = BluetoothTransferService.getInstance();

  useEffect(() => {
    loadOfflineQueue();
    checkBluetoothStatus();
  }, []);

  const loadOfflineQueue = () => {
    const queue = offlineService.getOfflineQueue();
    setOfflineQueue(queue);
  };

  const checkBluetoothStatus = async () => {
    const status = await bluetoothService.checkBluetoothStatus();
    setIsBluetoothEnabled(status.isEnabled);
  };

  const handleToggleMerchantMode = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isMerchantMode) {
        await bluetoothService.stopMerchantMode();
        setIsMerchantMode(false);
      } else {
        const success = await bluetoothService.startMerchantMode({
          name: 'Valkyrie Merchant',
          address: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs'
        });

        if (success) {
          setIsMerchantMode(true);
          Alert.alert('Merchant Mode', 'Now accepting transactions via Bluetooth');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle merchant mode');
    }
  };

  const handleScanMerchants = async () => {
    try {
      setIsScanning(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const merchants = await bluetoothService.scanForMerchants();
      setNearbyMerchants(merchants);

      if (merchants.length === 0) {
        Alert.alert('No Merchants Found', 'No nearby merchants accepting payments');
      }
    } catch (error) {
      Alert.alert('Scan Failed', 'Could not scan for merchants');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSyncOfflineTransactions = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const result = await offlineService.syncOfflineTransactions(true);
      
      if (result.success) {
        Alert.alert('Sync Complete', `${result.synced} transactions synced successfully`);
        loadOfflineQueue();
      } else {
        Alert.alert('Sync Failed', `${result.failed} transactions failed to sync`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sync transactions');
    }
  };

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bluetooth Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Bluetooth Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Enabled:</Text>
            <Text style={[styles.statusValue, { color: isBluetoothEnabled ? CYBERPUNK_COLORS.success : CYBERPUNK_COLORS.error }]}>
              {isBluetoothEnabled ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        {/* Merchant Mode */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Merchant Mode</Text>
          <Text style={styles.cardDescription}>
            Accept payments from customers via Bluetooth when offline
          </Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable Merchant Mode</Text>
            <Switch
              value={isMerchantMode}
              onValueChange={handleToggleMerchantMode}
              trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
              thumbColor={CYBERPUNK_COLORS.text}
            />
          </View>

          {isMerchantMode && (
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantInfoText}>
                🟢 Broadcasting as merchant - Customers can now send payments
              </Text>
            </View>
          )}
        </View>

        {/* Nearby Merchants */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Nearby Merchants</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScanMerchants}
              disabled={isScanning}
            >
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan'}
              </Text>
            </TouchableOpacity>
          </View>

          {nearbyMerchants.length > 0 ? (
            nearbyMerchants.map((merchant) => (
              <MerchantItem key={merchant.id} merchant={merchant} />
            ))
          ) : (
            <Text style={styles.emptyText}>No merchants found nearby</Text>
          )}
        </View>

        {/* Offline Queue */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Offline Queue ({offlineQueue.length})</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSyncOfflineTransactions}
            >
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          </View>

          {offlineQueue.length > 0 ? (
            offlineQueue.map((tx) => (
              <OfflineTransactionItem key={tx.id} transaction={tx} />
            ))
          ) : (
            <Text style={styles.emptyText}>No offline transactions</Text>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const MerchantItem: React.FC<{ merchant: any }> = ({ merchant }) => (
  <TouchableOpacity style={styles.merchantItem}>
    <View style={styles.merchantIcon}>
      <Text style={styles.merchantIconText}>🏪</Text>
    </View>
    <View style={styles.merchantDetails}>
      <Text style={styles.merchantName}>{merchant.name}</Text>
      <Text style={styles.merchantDistance}>{merchant.distance}m away</Text>
      {merchant.acceptedAmount && (
        <Text style={styles.merchantAmount}>Accepting: {merchant.acceptedAmount} ADA</Text>
      )}
    </View>
    <TouchableOpacity style={styles.payButton}>
      <Text style={styles.payButtonText}>Pay</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);

const OfflineTransactionItem: React.FC<{ transaction: any }> = ({ transaction }) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionIcon}>
      <Text style={styles.transactionIconText}>
        {transaction.status === 'queued' ? '⏳' : 
         transaction.status === 'failed' ? '❌' : '✅'}
      </Text>
    </View>
    <View style={styles.transactionDetails}>
      <Text style={styles.transactionAmount}>{transaction.amount} ADA</Text>
      <Text style={styles.transactionAddress}>{transaction.to}</Text>
      <Text style={styles.transactionStatus}>{transaction.status}</Text>
    </View>
    <Text style={styles.transactionTime}>
      {new Date(transaction.timestamp).toLocaleDateString()}
    </Text>
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
  statusCard: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
  },
  merchantInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: CYBERPUNK_COLORS.success + '20',
    borderRadius: 8,
  },
  merchantInfoText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.success,
  },
  scanButton: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanButtonText: {
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: CYBERPUNK_COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  merchantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  merchantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CYBERPUNK_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantIconText: {
    fontSize: 20,
  },
  merchantDetails: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  merchantDistance: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  merchantAmount: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
  },
  payButton: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  payButtonText: {
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
    fontSize: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CYBERPUNK_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 16,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionAmount: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  transactionAddress: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  transactionStatus: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    textTransform: 'capitalize',
  },
  transactionTime: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
});

export default OfflineTransactionScreen;
