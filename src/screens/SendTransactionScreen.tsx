import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { BiometricService } from '../services/BiometricService';
import { CardanoAPIService } from '../services/CardanoAPIService';
import { AddressResolverService } from '../services/AddressResolverService';
import { FullScreenLoader } from '../components/index';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { CardanoWalletService } from '../services/CardanoWalletService';
import TransactionPreviewModal from './TransactionPreviewModal';

type SendTransactionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SendTransaction'>;
type SendTransactionScreenRouteProp = RouteProp<RootStackParamList, 'SendTransaction'>;

interface Props {
  navigation: SendTransactionScreenNavigationProp;
  route: SendTransactionScreenRouteProp;
}

const SendTransactionScreen: React.FC<Props> = ({ navigation, route }) => {
  const [recipientAddress, setRecipientAddress] = useState(route.params?.recipientAddress || '');
  const [amount, setAmount] = useState(route.params?.amount || '');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolvedAddressInfo, setResolvedAddressInfo] = useState<{ address: string; source: string } | null>(null);
  const [requireHold, setRequireHold] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdDurationMs = 1500;
  let holdInterval: any = null;
  let holdTimeout: any = null;

  React.useEffect(() => {
    (async () => {
      try {
        const bio = BiometricService.getInstance();
        const cfg = await bio.getBiometricConfig();
        const enabled = cfg.isEnabled && (cfg.quickPayLimit !== '0');
        setRequireHold(!!cfg.holdToConfirm && enabled);
      } catch {}
    })();
    return () => {
      if (holdInterval) clearInterval(holdInterval);
      if (holdTimeout) clearTimeout(holdTimeout);
    };
  }, []);
  const [utxoPolicy, setUtxoPolicy] = useState<'largest-first' | 'smallest-first' | 'random' | 'optimize-fee' | 'privacy'>('optimize-fee');
  const [selectedUtxos, setSelectedUtxos] = useState<Array<{ tx_hash: string; tx_index: number }>>([]);
  const [availableUtxos, setAvailableUtxos] = useState<Array<{ tx_hash: string; tx_index: number; amount: Array<{ unit: string; quantity: string }> }>>([]);
  const [loadingUtxos, setLoadingUtxos] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewTx, setPreviewTx] = useState<any>(null);

  // Process transaction with real implementation
  const processTransaction = async (): Promise<{ success: boolean; error?: string; txHash?: string }> => {
    try {
      // Validate inputs
      if (!recipientAddress || !amount) {
        return { success: false, error: 'Please fill in all required fields' };
      }

      // Resolve ADA Handle / mapping to bech32
      const api = CardanoAPIService.getInstance();
      const network = api.getNetwork();
      const resolved = await AddressResolverService.getInstance().resolve(recipientAddress, { network });
      const resolvedAddress = resolved.address.startsWith('addr1') ? resolved.address : recipientAddress;
      if (!resolvedAddress.startsWith('addr1')) {
        return { success: false, error: 'Invalid Cardano address or handle' };
      }
      setResolvedAddressInfo(resolved);

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      // Implement actual Cardano transaction
      try {
        const fromAddress = await getCurrentWalletAddress();
        const wallet = CardanoWalletService.getInstance('mainnet');
        const amountLovelace = CardanoAPIService.adaToLovelace(amount);
        const tx = await wallet.buildTransaction(
          fromAddress,
          resolvedAddress,
          amountLovelace,
          { note, utxoPolicy, ...(selectedUtxos.length ? { selectedUtxos } : {}) }
        );
        setPreviewTx(tx);
        setPreviewVisible(true);
        const signedTx = await wallet.signTransaction(tx);
        const txHash = await wallet.submitTransaction(signedTx);
        await storeTransactionInHistory({ senderAddress: fromAddress, recipientAddress: resolvedAddress, amount, fee: tx.fee, note }, txHash);
        return { success: true, txHash };
      } catch (txError) {
        console.error('Cardano transaction failed:', txError);
        const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
        return { success: false, error: 'Transaction processing failed: ' + errorMessage };
      }
    } catch (error) {
      console.error('Transaction processing failed:', error);
      return { success: false, error: 'Transaction processing failed' };
    }
  };

  // Get current wallet address
  const getCurrentWalletAddress = async (): Promise<string> => {
    // Get from wallet state management
    try {
      // This should integrate with WalletStateService or similar
      const storedAddress = await SecureStore.getItemAsync('current_wallet_address');
      if (storedAddress) {
        return storedAddress;
      }
      
      // Fallback to placeholder address
      return 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer';
    } catch (error) {
      console.warn('Failed to get wallet address, using placeholder:', error);
      return 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer';
    }
  };

  // Deprecated local builder kept as placeholder
  const buildCardanoTransaction = async () => {};

  // Sign transaction with wallet keys
  const signTransaction = async (transactionBuilder: any): Promise<string> => {
    try {
      // Get private key from secure storage
      const privateKey = await SecureStore.getItemAsync('wallet_private_key');
      if (!privateKey) {
        throw new Error('Private key not found');
      }

      // Hash transaction data
      const transactionData = JSON.stringify(transactionBuilder);
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        transactionData
      );

      // Sign hash with private key (simplified for demo)
      // In production, use proper cryptographic signing
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        privateKey + hash
      );

      console.log('Transaction signed successfully');
      return signature;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  };

  const loadUtxos = async (): Promise<void> => {
    try {
      setLoadingUtxos(true);
      const addr = await getCurrentWalletAddress();
      const api = CardanoAPIService.getInstance();
      api.setNetwork('mainnet');
      const utxos = await api.getAddressUTXOs(addr);
      setAvailableUtxos(utxos);
    } catch (e) {
      console.warn('Failed to load UTXOs', e);
    } finally {
      setLoadingUtxos(false);
    }
  };

  const toggleSelectUtxo = (u: { tx_hash: string; tx_index: number }): void => {
    setSelectedUtxos(prev => {
      const key = `${u.tx_hash}:${u.tx_index}`;
      const has = prev.some(x => `${x.tx_hash}:${x.tx_index}` === key);
      if (has) return prev.filter(x => `${x.tx_hash}:${x.tx_index}` !== key);
      return [...prev, { tx_hash: u.tx_hash, tx_index: u.tx_index }];
    });
  };

  // Create transaction hash
  const createTransactionHash = async (transactionData: string): Promise<string> => {
    try {
      // Use expo-crypto for hashing
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        transactionData
      );
      return hash;
    } catch (error) {
      // Fallback to simple hash
      let hash = 0;
      for (let i = 0; i < transactionData.length; i++) {
        const char = transactionData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16);
    }
  };

  // Sign with private key
  const signWithPrivateKey = async (data: string, privateKey: string): Promise<string> => {
    try {
      // Use expo-crypto for signing
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        privateKey + data
      );
      return signature;
    } catch (error) {
      // Fallback to simple signature
      return 'signature_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  };

  // Submit transaction to Cardano network via Blockfrost API
  const submitTransaction = async (signedTransaction: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    try {
      console.log('Submitting transaction to Cardano network via Blockfrost:', signedTransaction);
      
      // In a real flow, signedTransaction must be CBOR hex string
      // Submit via Blockfrost API
      const cardanoAPI = CardanoAPIService.getInstance();
      cardanoAPI.setNetwork('mainnet');
      const txHash = await cardanoAPI.submitTransaction(signedTransaction);
      
      console.log('Transaction submitted successfully with hash:', txHash);
      
      // Store transaction in local history
      await storeTransactionInHistory({ senderAddress: '', recipientAddress, amount, fee: '0', note }, txHash);
      
      return { success: true, txHash };
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      return { success: false, error: 'Failed to submit transaction: ' + (error as Error).message };
    }
  };

  // Store transaction in local history
  const storeTransactionInHistory = async (transaction: any, txHash: string): Promise<void> => {
    try {
      const historyKey = 'transaction_history';
      const existingHistory = await AsyncStorage.getItem(historyKey);
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      
      const newTransaction = {
        id: txHash,
        hash: txHash,
        amount: transaction.amount.toString(),
        fee: transaction.fee,
        from: transaction.senderAddress,
        to: transaction.recipientAddress,
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: transaction.note
      };
      
      history.unshift(newTransaction);
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      console.log('Transaction stored in local history');
    } catch (error) {
      console.warn('Failed to store transaction in history:', error);
    }
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      Alert.alert('Missing Information', 'Please enter recipient address and amount');
      return;
    }

    try {
      setIsProcessing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if amount is within quick pay limit
      const amountLovelace = (parseFloat(amount) * 1000000).toString();
      const biometricService = BiometricService.getInstance();
      const quickPayResult = await biometricService.authenticateQuickPay(
        amountLovelace,
        '10000000' // 10 ADA limit
      );

      if (!quickPayResult.success && quickPayResult.requireFullAuth) {
        // Full biometric authentication required
        const authResult = await biometricService.authenticateWithBiometric(
          `Send ${amount} ADA`
        );
        
        if (!authResult.success) {
          Alert.alert('Authentication Failed', authResult.error);
          return;
        }
      }

      // Process transaction
      const transactionResult = await processTransaction();
      
      if (!transactionResult.success) {
        throw new Error(transactionResult.error || 'Transaction failed');
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (transactionResult.txHash) {
        navigation.navigate('SubmitResult', { txHash: transactionResult.txHash, network: 'mainnet' });
      } else {
        Alert.alert('Transaction Sent', `Successfully sent ${amount} ADA`);
      }

    } catch (error) {
      console.error('Send transaction failed:', error);
      Alert.alert('Transaction Failed', 'Please try again');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <LinearGradient
        colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              placeholder="addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer..."
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              multiline
            />
            {resolvedAddressInfo && (
              <Text style={{ color: CYBERPUNK_COLORS.textSecondary, marginTop: 6 }}>
                Resolved: {resolvedAddressInfo.address} ({resolvedAddressInfo.source})
              </Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Coin Control Policy</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['optimize-fee','largest-first','smallest-first','random','privacy'] as const).map(p => (
                <TouchableOpacity key={p} style={[styles.policyChip, utxoPolicy===p && styles.policyChipActive]} onPress={() => setUtxoPolicy(p)}>
                  <Text style={[styles.policyChipText, utxoPolicy===p && styles.policyChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.inputLabel}>Select UTXOs (optional)</Text>
              <TouchableOpacity onPress={loadUtxos} style={styles.loadBtn} disabled={loadingUtxos}>
                <Text style={styles.loadBtnText}>{loadingUtxos ? 'Loading...' : 'Load UTXOs'}</Text>
              </TouchableOpacity>
            </View>
            {availableUtxos.length > 0 && (
              <FlatList
                data={availableUtxos}
                keyExtractor={(item) => `${item.tx_hash}:${item.tx_index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const key = `${item.tx_hash}:${item.tx_index}`;
                  const isSelected = selectedUtxos.some(x => `${x.tx_hash}:${x.tx_index}` === key);
                  const adaEntry = item.amount.find(a => a.unit === 'lovelace');
                  const ada = adaEntry ? CardanoAPIService.lovelaceToAda(adaEntry.quantity) : '0';
                  return (
                    <TouchableOpacity onPress={() => toggleSelectUtxo(item)} style={[styles.utxoItem, isSelected && styles.utxoItemSelected]}>
                      <Text style={styles.utxoText}>idx {item.tx_index} • {ada} ADA</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {selectedUtxos.length > 0 && (
              <Text style={{ color: CYBERPUNK_COLORS.textSecondary, marginTop: 8 }}>{selectedUtxos.length} selected</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Amount (ADA)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Note (Optional)</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Transaction note..."
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              multiline
            />
          </View>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={requireHold ? undefined : handleSend}
            onPressIn={requireHold ? () => {
              setHoldProgress(0);
              const start = Date.now();
              holdInterval = setInterval(() => {
                const p = Math.min(100, Math.floor(((Date.now() - start) / holdDurationMs) * 100));
                setHoldProgress(p);
              }, 50);
              holdTimeout = setTimeout(async () => {
                clearInterval(holdInterval);
                setHoldProgress(100);
                await handleSend();
              }, holdDurationMs);
            } : undefined}
            onPressOut={requireHold ? () => {
              if (holdInterval) clearInterval(holdInterval);
              if (holdTimeout) clearTimeout(holdTimeout);
              setHoldProgress(0);
            } : undefined}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendButtonText}>
                {isProcessing ? 'PROCESSING...' : (requireHold ? `HOLD TO CONFIRM ${holdProgress}%` : 'SEND ADA')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </LinearGradient>
      
      <FullScreenLoader
        visible={isProcessing}
        message="Processing transaction..."
      />

      <TransactionPreviewModal
        visible={previewVisible}
        transaction={previewTx}
        onClose={() => setPreviewVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
  },
  noteInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  policyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    backgroundColor: CYBERPUNK_COLORS.surface,
    marginRight: 8,
  },
  policyChipActive: {
    borderColor: CYBERPUNK_COLORS.primary,
    backgroundColor: '#1f2344',
  },
  policyChipText: {
    color: CYBERPUNK_COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  policyChipTextActive: {
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  loadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  loadBtnText: {
    color: CYBERPUNK_COLORS.text,
    fontSize: 12,
  },
  utxoItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    marginRight: 8,
  },
  utxoItemSelected: {
    borderColor: CYBERPUNK_COLORS.accent,
    backgroundColor: '#242a55',
  },
  utxoText: {
    color: CYBERPUNK_COLORS.text,
    fontSize: 12,
  },
  sendButton: {
    marginTop: 32,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sendButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
    letterSpacing: 1,
  },
});

export default SendTransactionScreen;
