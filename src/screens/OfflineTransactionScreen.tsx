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
import { CYBERPUNK_COLORS } from '../constants/index';
import { OfflineTransactionService } from '../services/OfflineTransactionService';
import { BluetoothTransferService } from '../services/BluetoothTransferService';
import { SecureTransferService } from '../services/SecureTransferService';
import QRCode from 'react-native-qrcode-svg';
import QRCodeScanner from '../components/QRCodeScanner';
import { CardanoWalletService } from '../services/CardanoWalletService';
import { useToast } from '../contexts/ToastContext';

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
  const [qrPages, setQrPages] = useState<string[]>([]);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [scanPages, setScanPages] = useState<string[]>([]);

  const offlineService = OfflineTransactionService.getInstance();
  const bluetoothService = BluetoothTransferService.getInstance();
  const secureTransfer = SecureTransferService.getInstance();
  const toast = useToast();

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

  const handleShowQRForLatest = async () => {
    try {
      const latest = offlineService.getOfflineQueue().find(tx => tx.signedTx);
      if (!latest) {
        Alert.alert('QR Export', 'No offline signed transactions.');
        return;
      }
      const sessionId = `qr_${Date.now()}`;
      setQrSessionId(sessionId);
      const key = new Uint8Array(32); // For demo; in prod use ECDH shared key
      const pages = await secureTransfer.buildQrPages(
        sessionId,
        new TextEncoder().encode(JSON.stringify({ signedTx: latest.signedTx, id: latest.id })),
        key,
        true
      );
      setQrPages(pages);
      Alert.alert('QR Export', `Generated ${pages.length} QR pages.`);
    } catch (e) {
      Alert.alert('QR Error', 'Failed to generate QR pages.');
    }
  };

  const handleStartScan = () => {
    setScanPages([]);
    setScanMode(true);
  };

  const handleScanQrData = async (data: string) => {
    try {
      if (!data.startsWith('VQR:')) return Alert.alert('Invalid QR', 'Not a Valkyrie QR frame.');
      setScanPages(prev => [...prev, data]);
      // Simple heuristic: attempt parse when >=3 frames or when user taps Close later
      if (scanPages.length + 1 >= 3) {
        const key = new Uint8Array(32); // In prod derive via ECDH/session
        const plaintext = await secureTransfer.parseQrPages([...scanPages, data], key, true);
        const parsed = JSON.parse(new TextDecoder().decode(plaintext));
        if (parsed?.signedTx) {
          setScanMode(false);
          // Submit immediately
          const wallet = CardanoWalletService.getInstance();
          try {
            const txHash = await wallet.submitTransaction(parsed.signedTx);
            toast.showToast(`Submitted: ${txHash}`, 'success');
            const network = wallet.getCurrentNetwork().name as 'mainnet' | 'testnet';
            navigation.navigate('SubmitResult', { txHash, network });
          } catch (e) {
            toast.showToast('Submit failed', 'error');
          }
        } else {
          toast.showToast('Invalid payload', 'error');
        }
      }
    } catch (e) {
      toast.showToast('Failed to parse QR frames', 'error');
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

          <TouchableOpacity style={[styles.scanButton, { marginTop: 12 }]} onPress={handleStartScan}>
            <Text style={styles.scanButtonText}>Scan QR (Import)</Text>
          </TouchableOpacity>
          {scanMode && (
            <View style={{ marginTop: 12 }}>
              <QRCodeScanner onScan={handleScanQrData} onClose={() => setScanMode(false)} />
            </View>
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

          {offlineQueue.length > 0 && (
            <TouchableOpacity style={[styles.syncButton, { marginTop: 12 }]} onPress={handleShowQRForLatest}>
              <Text style={styles.syncButtonText}>Show QR for Latest</Text>
            </TouchableOpacity>
          )}
          {qrPages.length > 0 && (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: CYBERPUNK_COLORS.text, marginBottom: 8 }}>QR Pages ({qrPages.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {qrPages.map((p, i) => (
                  <View key={`qr_${i}`} style={{ marginRight: 12, alignItems: 'center' }}>
                    <QRCode value={p} size={140} backgroundColor="transparent" color={CYBERPUNK_COLORS.text} />
                    <Text style={{ color: CYBERPUNK_COLORS.textSecondary, marginTop: 6 }}>Page {i + 1}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
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

const OfflineTransactionItem: React.FC<{ transaction: any }> = ({ transaction }) => {
  const ttl: number | undefined = transaction?.metadata?.ttl;
  const [isExpired, setIsExpired] = React.useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!ttl) { setIsExpired(false); return; }
        // Use require to avoid TS dynamic import target
        const apiModule = require('../services/CardanoAPIService');
        const api = apiModule.CardanoAPIService.getInstance();
        const latest = await api.getLatestBlock();
        const currentSlot = latest.slot || 0;
        if (!cancelled) setIsExpired(currentSlot > ttl);
      } catch {
        if (!cancelled) setIsExpired(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ttl]);
  const retryTx = async (tx: any) => {
    try {
      const service = OfflineTransactionService.getInstance();
      await service.retryTransaction(tx.id);
      Alert.alert('Retry', 'Transaction marked for retry.');
    } catch {
      Alert.alert('Retry', 'Failed to mark transaction for retry.');
    }
  };

  const cancelTx = async (tx: any) => {
    try {
      const service = OfflineTransactionService.getInstance();
      await service.removeFromOfflineQueue(tx.id);
      Alert.alert('Cancel', 'Transaction removed from queue.');
    } catch {
      Alert.alert('Cancel', 'Failed to remove transaction.');
    }
  };

  return (
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
        <Text style={styles.transactionStatus}>{transaction.status}{isExpired ? ' (expired)' : ''}</Text>
      </View>
      <Text style={styles.transactionTime}>
        {new Date(transaction.timestamp).toLocaleDateString()}
      </Text>
      <View style={{ marginLeft: 10 }}>
        <TouchableOpacity style={[styles.payButton, { backgroundColor: CYBERPUNK_COLORS.accent, marginBottom: 6 }]} onPress={() => retryTx(transaction)}>
          <Text style={styles.payButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.payButton, { backgroundColor: CYBERPUNK_COLORS.error }]} onPress={() => cancelTx(transaction)}>
          <Text style={styles.payButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
