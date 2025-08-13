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
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';
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
      const latest = offlineService.getOfflineQueue().find(tx => !!tx.signedTx);
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
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Container>
          {/* Bluetooth Status */}
          <Card style={styles.statusCard}>
            <AppText variant="h3" style={styles.statusTitle}>Bluetooth Status</AppText>
            <View style={styles.statusRow}>
              <AppText color={tokens.palette.textSecondary}>Enabled:</AppText>
              <AppText color={isBluetoothEnabled ? tokens.palette.success : tokens.palette.danger}>{isBluetoothEnabled ? 'Yes' : 'No'}</AppText>
            </View>
          </Card>

          {/* Merchant Mode */}
          <Card>
            <AppText variant="h3" style={styles.cardTitle}>Merchant Mode</AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.cardDescription}>Accept payments from customers via Bluetooth when offline</AppText>
            <View style={styles.switchRow}>
              <AppText>Enable Merchant Mode</AppText>
              <Switch value={isMerchantMode} onValueChange={handleToggleMerchantMode} trackColor={{ false: tokens.palette.border, true: tokens.palette.primary }} thumbColor={tokens.palette.text} />
            </View>
            {isMerchantMode && (
              <View style={styles.merchantInfo}>
                <AppText color={tokens.palette.success}>🟢 Broadcasting as merchant - Customers can now send payments</AppText>
              </View>
            )}
          </Card>

          {/* Nearby Merchants */}
          <Card>
            <View style={styles.cardHeader}>
              <AppText variant="h3" style={styles.cardTitle}>Nearby Merchants</AppText>
              <AppButton title={isScanning ? 'Scanning...' : 'Scan'} onPress={handleScanMerchants} disabled={isScanning} style={{ width: 120 }} />
            </View>
            {nearbyMerchants.length > 0 ? (
              nearbyMerchants.map((merchant) => (
                <MerchantItem key={merchant.id} merchant={merchant} />
              ))
            ) : (
              <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.emptyText}>No merchants found nearby</AppText>
            )}
            <AppButton title="Scan QR (Import)" variant="secondary" onPress={handleStartScan} style={{ marginTop: 12 }} />
            {scanMode && (
              <View style={{ marginTop: 12 }}>
                <QRCodeScanner onScan={handleScanQrData} onClose={() => setScanMode(false)} />
              </View>
            )}
          </Card>

          {/* Offline Queue */}
          <Card>
            <View style={styles.cardHeader}>
              <AppText variant="h3" style={styles.cardTitle}>Offline Queue ({offlineQueue.length})</AppText>
              <AppButton title="Sync" variant="secondary" onPress={handleSyncOfflineTransactions} style={{ width: 120 }} />
            </View>
            {offlineQueue.length > 0 ? (
              offlineQueue.map((tx) => (
                <OfflineTransactionItem key={tx.id} transaction={tx} />
              ))
            ) : (
              <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.emptyText}>No offline transactions</AppText>
            )}
            {offlineQueue.length > 0 && (
              <AppButton title="Show QR for Latest" onPress={handleShowQRForLatest} style={{ marginTop: 12 }} />
            )}
            {qrPages.length > 0 && (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <AppText variant="body2" color={tokens.palette.textSecondary} style={{ marginBottom: 8 }}>QR Pages ({qrPages.length})</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {qrPages.map((p, i) => (
                    <View key={`qr_${i}`} style={{ marginRight: 12, alignItems: 'center' }}>
                      <QRCode value={p} size={140} backgroundColor="transparent" color={tokens.palette.text} />
                      <AppText variant="caption" color={tokens.palette.textSecondary} style={{ marginTop: 6 }}>Page {i + 1}</AppText>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </Card>
        </Container>
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
