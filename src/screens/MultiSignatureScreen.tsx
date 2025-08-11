import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { MultiSignatureService, MultiSigWallet, MultiSigTransaction } from '../services/MultiSignatureService';
import { CyberpunkCard, CyberpunkButton, LoadingSpinner } from '../components/index';

type MultiSignatureScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MultiSignature'>;

interface Props {
  navigation: MultiSignatureScreenNavigationProp;
}

const MultiSignatureScreen: React.FC<Props> = ({ navigation }) => {
  const [wallets, setWallets] = useState<MultiSigWallet[]>([]);
  const [transactions, setTransactions] = useState<MultiSigTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<MultiSigWallet | null>(null);

  // Form states
  const [walletName, setWalletName] = useState('');
  const [walletDescription, setWalletDescription] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerPublicKey, setSignerPublicKey] = useState('');
  const [signerWeight, setSignerWeight] = useState('1');
  const [quorum, setQuorum] = useState('2');

  const multiSigService = MultiSignatureService.getInstance();

  useEffect(() => {
    loadMultiSigData();
  }, []);

  const loadMultiSigData = async () => {
    try {
      setIsLoading(true);
      const [walletsData, transactionsData] = await Promise.all([
        multiSigService.getMultiSigWallets(),
        multiSigService.getMultiSigTransactions()
      ]);
      setWallets(walletsData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Failed to load multi-sig data:', error);
      Alert.alert('Error', 'Failed to load multi-signature data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    if (!walletName.trim() || !signerName.trim() || !signerPublicKey.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const signers = [{
        name: signerName,
        publicKey: signerPublicKey,
        weight: parseInt(signerWeight),
        isActive: true
      }];

      await multiSigService.createMultiSigWallet(
        walletName,
        signers,
        parseInt(quorum),
        'mainnet',
        walletDescription
      );

      Alert.alert('Success', 'Multi-signature wallet created successfully');
      setShowCreateModal(false);
      resetForm();
      loadMultiSigData();
    } catch (error) {
      Alert.alert('Error', `Failed to create wallet: ${error}`);
    }
  };

  const handleAddSigner = async () => {
    if (!selectedWallet || !signerName.trim() || !signerPublicKey.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      await multiSigService.addSigner(selectedWallet.id, {
        name: signerName,
        publicKey: signerPublicKey,
        weight: parseInt(signerWeight),
        isActive: true
      });

      Alert.alert('Success', 'Signer added successfully');
      setShowSignerModal(false);
      resetForm();
      loadMultiSigData();
    } catch (error) {
      Alert.alert('Error', `Failed to add signer: ${error}`);
    }
  };

  const handleRemoveSigner = async (walletId: string, signerId: string) => {
    Alert.alert(
      'Remove Signer',
      'Are you sure you want to remove this signer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await multiSigService.removeSigner(walletId, signerId);
              Alert.alert('Success', 'Signer removed successfully');
              loadMultiSigData();
            } catch (error) {
              Alert.alert('Error', `Failed to remove signer: ${error}`);
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setWalletName('');
    setWalletDescription('');
    setSignerName('');
    setSignerPublicKey('');
    setSignerWeight('1');
    setQuorum('2');
  };

  const renderWalletCard = (wallet: MultiSigWallet) => (
    <CyberpunkCard key={wallet.id} style={styles.walletCard}>
      <View style={styles.walletHeader}>
        <View style={styles.walletInfo}>
          <Text style={styles.walletName}>{wallet.name}</Text>
          <Text style={styles.walletDescription}>{wallet.description || 'No description'}</Text>
          <Text style={styles.walletAddress}>{wallet.address.slice(0, 20)}...</Text>
        </View>
        <View style={styles.walletStats}>
          <Text style={styles.statLabel}>Signers</Text>
          <Text style={styles.statValue}>{wallet.signers.length}</Text>
          <Text style={styles.statLabel}>Quorum</Text>
          <Text style={styles.statValue}>{wallet.quorum}</Text>
        </View>
      </View>

      <View style={styles.signersList}>
        <Text style={styles.signersTitle}>Signers:</Text>
        {wallet.signers.map((signer) => (
          <View key={signer.id} style={styles.signerItem}>
            <View style={styles.signerInfo}>
              <Text style={styles.signerName}>{signer.name}</Text>
              <Text style={styles.signerKey}>{signer.publicKey.slice(0, 16)}...</Text>
              <Text style={styles.signerWeight}>Weight: {signer.weight}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeSignerButton}
              onPress={() => handleRemoveSigner(wallet.id, signer.id)}
            >
              <Text style={styles.removeSignerText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.walletActions}>
        <CyberpunkButton
          title="Add Signer"
          onPress={() => {
            setSelectedWallet(wallet);
            setShowSignerModal(true);
          }}
          variant="outline"
          style={styles.actionButton}
        />
        <CyberpunkButton
          title="Create Transaction"
          onPress={() => navigation.navigate('CreateMultiSigTransaction', { walletId: wallet.id })}
          style={styles.actionButton}
        />
      </View>
    </CyberpunkCard>
  );

  const renderTransactionCard = (tx: MultiSigTransaction) => (
    <CyberpunkCard key={tx.id} style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionId}>TX: {tx.id.slice(0, 8)}...</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tx.status) }]}>
          <Text style={styles.statusText}>{tx.status}</Text>
        </View>
      </View>

      <View style={styles.transactionDetails}>
        <Text style={styles.transactionAmount}>{parseFloat(tx.amount) / 1000000} ADA</Text>
        <Text style={styles.transactionRecipient}>
          To: {tx.recipient ? `${tx.recipient.slice(0, 20)}...` : 'Unknown'}
        </Text>
        <Text style={styles.transactionDate}>
          {new Date(tx.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.signaturesInfo}>
        <Text style={styles.signaturesText}>
          Signatures: {tx.signatures.length}/{tx.quorum}
        </Text>
        <Text style={styles.signaturesProgress}>
          {((tx.signatures.length / tx.quorum) * 100).toFixed(0)}% Complete
        </Text>
      </View>

      {tx.status === 'pending' && (
        <CyberpunkButton
          title="Sign Transaction"
          onPress={() => navigation.navigate('SignMultiSigTransaction', { transactionId: tx.id })}
          variant="outline"
          style={styles.signButton}
        />
      )}
    </CyberpunkCard>
  );

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return CYBERPUNK_COLORS.warning;
      case 'partially_signed': return CYBERPUNK_COLORS.primary;
      case 'fully_signed': return CYBERPUNK_COLORS.success;
      case 'submitted': return CYBERPUNK_COLORS.accent;
      case 'confirmed': return CYBERPUNK_COLORS.success;
      case 'failed': return CYBERPUNK_COLORS.error;
      default: return CYBERPUNK_COLORS.border;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading multi-signature data..." />;
  }

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Multi-Signature Wallets</Text>
          <Text style={styles.subtitle}>
            Manage shared wallets with multiple signers
          </Text>
        </View>

        {/* Create Wallet Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]}
            style={styles.createButtonGradient}
          >
            <Text style={styles.createButtonText}>+ CREATE NEW WALLET</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Wallets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Multi-Sig Wallets</Text>
          {wallets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No multi-signature wallets yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first shared wallet to get started
              </Text>
            </View>
          ) : (
            wallets.map(renderWalletCard)
          )}
        </View>

        {/* Transactions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Transactions</Text>
          {transactions.filter(tx => tx.status === 'pending' || tx.status === 'signed').length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No pending transactions</Text>
              <Text style={styles.emptySubtext}>
                All transactions are fully signed or completed
              </Text>
            </View>
          ) : (
            transactions
              .filter(tx => tx.status === 'pending' || tx.status === 'signed')
              .map(renderTransactionCard)
          )}
        </View>
      </ScrollView>

      {/* Create Wallet Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Multi-Sig Wallet</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Wallet Name"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={walletName}
              onChangeText={setWalletName}
            />

            <TextInput
              style={styles.input}
              placeholder="Description (Optional)"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={walletDescription}
              onChangeText={setWalletDescription}
            />

            <TextInput
              style={styles.input}
              placeholder="Signer Name"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerName}
              onChangeText={setSignerName}
            />

            <TextInput
              style={styles.input}
              placeholder="Public Key"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerPublicKey}
              onChangeText={setSignerPublicKey}
            />

            <TextInput
              style={styles.input}
              placeholder="Signer Weight"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerWeight}
              onChangeText={setSignerWeight}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Quorum Required"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={quorum}
              onChangeText={setQuorum}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <CyberpunkButton
                title="Cancel"
                onPress={() => setShowCreateModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <CyberpunkButton
                title="Create Wallet"
                onPress={handleCreateWallet}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Signer Modal */}
      <Modal
        visible={showSignerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSignerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Signer</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Signer Name"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerName}
              onChangeText={setSignerName}
            />

            <TextInput
              style={styles.input}
              placeholder="Public Key"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerPublicKey}
              onChangeText={setSignerPublicKey}
            />

            <TextInput
              style={styles.input}
              placeholder="Signer Weight"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              value={signerWeight}
              onChangeText={setSignerWeight}
              keyboardType="numeric"
            />

            <View style={styles.modalActions}>
              <CyberpunkButton
                title="Cancel"
                onPress={() => setShowSignerModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <CyberpunkButton
                title="Add Signer"
                onPress={handleAddSigner}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 22,
  },
  createButton: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 16,
  },
  walletCard: {
    marginBottom: 16,
    padding: 20,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  walletDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontFamily: 'monospace',
  },
  walletStats: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 8,
  },
  signersList: {
    marginBottom: 16,
  },
  signersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 12,
  },
  signerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CYBERPUNK_COLORS.border,
  },
  signerInfo: {
    flex: 1,
  },
  signerName: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
  },
  signerKey: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  signerWeight: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
  },
  removeSignerButton: {
    backgroundColor: CYBERPUNK_COLORS.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeSignerText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
  },
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  transactionCard: {
    marginBottom: 12,
    padding: 16,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: CYBERPUNK_COLORS.background,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  transactionDetails: {
    marginBottom: 12,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 4,
  },
  transactionRecipient: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  signaturesInfo: {
    marginBottom: 12,
  },
  signaturesText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  signaturesProgress: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
  },
  signButton: {
    alignSelf: 'flex-end',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    opacity: 0.7,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: CYBERPUNK_COLORS.background,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default MultiSignatureScreen;
